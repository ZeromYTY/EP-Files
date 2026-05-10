"""Views for the EP Files API."""
import io
import logging
import mimetypes
import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Sum
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import (
    File, FileOperationFacade, Folder,
    ImagePreview, PreviewFactory, User,
)
from ep_files_app.models.file_history import FileHistory
from ep_files_app.services.file_event_service import file_event_service
from ep_files_app.permissions import IsAdminUser, IsFileOwner, CanUploadFiles
from ep_files_app.validators import (
    sanitize_filename, validate_file_extension,
    validate_file_size, validate_filename,
)
from .serializers import FileSerializer, UserRegistrationSerializer, UserSerializer

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """API view for user registration."""

    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        """Handle registration and return JWT tokens."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        refresh = RefreshToken.for_user(user)
        data = {
            "token": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class LoginView(APIView):
    """API view for JWT login."""

    permission_classes = (AllowAny,)

    def post(self, request):
        """Authenticate user and return JWT tokens."""
        email = request.data.get("email")
        password = request.data.get("password")
        user = User.objects.filter(email=email).first()
        if user and check_password(password, user.password_hash):
            refresh = RefreshToken.for_user(user)
            return Response({
                "token": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            })
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    """API view for retrieving current user info."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Return current authenticated user data."""
        return Response({"user": UserSerializer(request.user).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    """Test endpoint to verify JWT authentication."""
    return Response({"message": "Access granted. JWT is working."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, CanUploadFiles])
def upload_file(request):
    """Upload a file with full validation and security checks."""
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    try:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "File not provided"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_filename(uploaded_file.name)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_file_extension(uploaded_file.name)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_file_size(uploaded_file)
        except ValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        safe_filename = sanitize_filename(uploaded_file.name)
        file_obj = File(
            name=safe_filename,
            size=uploaded_file.size,
            owner=request.user,
            file=uploaded_file,
        )
        file_obj.save()
        file_event_service.emit_upload_event(
            file=file_obj,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            details={"size": uploaded_file.size, "original_name": uploaded_file.name},
        )
        logger.info("File uploaded: %s by user %s", safe_filename, request.user.email)
        return Response({
            "message": "File uploaded successfully",
            "file": FileSerializer(file_obj).data,
        }, status=status.HTTP_201_CREATED)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("File upload error: %s", str(exc))
        return Response({"error": "Upload failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_files(request):
    """Return a list of files for the authenticated user."""
    files = File.objects.filter(owner=request.user).order_by("-date")
    return Response(FileSerializer(files, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_file(request, file_id):
    """Download a file by its ID."""
    try:
        file_rec = File.objects.get(id=file_id)
        if file_rec.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        if not file_rec.file or not os.path.exists(file_rec.file.path):
            return Response({"error": "File not found on server"}, status=status.HTTP_404_NOT_FOUND)
        logger.info("File downloaded: %s by user %s", file_rec.name, request.user.email)
        file_event_service.emit_download_event(
            file=file_rec,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        file_handle = file_rec.file.open("rb")
        content_type, _ = mimetypes.guess_type(file_rec.name)
        if content_type is None:
            content_type = "application/octet-stream"
        response = FileResponse(file_handle, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{file_rec.name}"'
        response["Content-Length"] = file_rec.size
        return response
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Download error: %s", str(exc))
        return Response({"error": "Download failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_file(request, file_id):
    """Delete a file by its ID."""
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        filename = file_obj.name
        file_id_for_event = file_obj.id
        if file_obj.file:
            try:
                file_obj.file.delete(save=False)
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Error deleting physical file: %s", str(exc))
        file_obj.delete()
        file_event_service.emit_delete_event(
            file_id=file_id_for_event,
            file_name=filename,
            user=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        logger.info("File deleted: %s by user %s", filename, request.user.email)
        return Response({"message": f'File "{filename}" deleted successfully'})
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def file_detail(request, file_id):
    """Return detailed info about a file."""
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        return Response(FileSerializer(file_obj).data)
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


def file_preview(request, file_id):
    """Show a preview of a file."""
    file = get_object_or_404(File, id=file_id)
    with file.file.open("rb") as f:
        data = f.read()
    strategy = PreviewFactory.get_strategy(file.name)
    preview = strategy.preview(data)
    if isinstance(strategy, ImagePreview):
        if not preview:
            return HttpResponse("Image processing error", status=500)
        return HttpResponse(preview, content_type="image/jpeg")
    if isinstance(preview, bytes):
        preview = preview.decode("utf-8", errors="replace")
    return HttpResponse(preview, content_type="text/plain; charset=utf-8")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_storage_stats(request):
    """Return storage statistics for the authenticated user."""
    try:
        user = request.user
        total_files = File.objects.filter(owner=user).count()
        total_size = File.objects.filter(owner=user).aggregate(total=Sum("size"))["total"] or 0
        storage_limit = 100 * 1024 * 1024
        usage_percent = (total_size / storage_limit * 100) if storage_limit > 0 else 0
        week_ago = timezone.now() - timedelta(days=7)
        recent_files = File.objects.filter(owner=user, date__gte=week_ago).count()
        file_types = {}
        for file in File.objects.filter(owner=user):
            ext = os.path.splitext(file.name)[1].lower() or "no extension"
            file_types[ext] = file_types.get(ext, 0) + 1
        return Response({
            "total_files": total_files,
            "total_size": total_size,
            "storage_limit": storage_limit,
            "usage_percent": round(usage_percent, 2),
            "available_space": storage_limit - total_size,
            "recent_files_count": recent_files,
            "file_types": file_types,
        })
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Stats error: %s", str(exc))
        return Response({"error": "Failed to get stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_files(request):
    """Search files by name for the authenticated user."""
    try:
        query = request.GET.get("q", "").strip()
        if not query:
            return Response({"error": "Search parameter 'q' is required"},
                            status=status.HTTP_400_BAD_REQUEST)
        files = File.objects.filter(owner=request.user, name__icontains=query).order_by("-date")
        return Response({
            "query": query,
            "count": files.count(),
            "results": FileSerializer(files, many=True).data,
        })
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Search error: %s", str(exc))
        return Response({"error": "Search failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Folders ---

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def folder_tree(request):
    """Return all folders for the authenticated user."""
    folders = Folder.objects.filter(owner=request.user).select_related("parent")
    data = [
        {
            "id": f.id,
            "name": f.name,
            "parent_id": f.parent_id,
            "path": f.get_full_path(),
            "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat(),
        }
        for f in folders
    ]
    return Response({"folders": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def folder_create(request):
    """Create a new folder for the authenticated user."""
    name = request.data.get("name", "").strip()
    parent_id = request.data.get("parent_id")
    if not name:
        return Response({"error": "Folder name is required"}, status=status.HTTP_400_BAD_REQUEST)
    parent = None
    if parent_id:
        try:
            parent = Folder.objects.get(id=parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Parent folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
    return Response({
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "path": folder.get_full_path(),
    }, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_rename(request, folder_id):
    """Rename a folder by its ID."""
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_name = request.data.get("name", "").strip()
    if not new_name:
        return Response({"error": "New name is required"}, status=status.HTTP_400_BAD_REQUEST)
    folder.name = new_name
    folder.save(update_fields=["name", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def folder_move(request, folder_id):
    """Move a folder to a new parent."""
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    new_parent_id = request.data.get("parent_id")
    if new_parent_id:
        try:
            new_parent = Folder.objects.get(id=new_parent_id, owner=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Target folder not found"}, status=status.HTTP_404_NOT_FOUND)
        if new_parent.id == folder.id or new_parent.id in folder.get_all_descendant_ids():
            return Response({"error": "Cannot move folder into its own subtree"},
                            status=status.HTTP_400_BAD_REQUEST)
        folder.parent = new_parent
    else:
        folder.parent = None
    folder.save(update_fields=["parent", "updated_at"])
    return Response({"id": folder.id, "name": folder.name, "path": folder.get_full_path()})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def folder_delete(request, folder_id):
    """Delete a folder and all its contents."""
    try:
        folder = Folder.objects.get(id=folder_id, owner=request.user)
    except Folder.DoesNotExist:
        return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    folder.delete()
    return Response({"status": "deleted", "id": folder_id})


# --- File History ---

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def file_history(request, file_id):
    """Return change history for a specific file."""
    try:
        file_obj = File.objects.get(id=file_id)
        if file_obj.owner != request.user:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
        history = FileHistory.objects.filter(file=file_obj).order_by("-timestamp")
        from .serializers import FileHistorySerializer
        return Response({
            "file_id": file_id,
            "file_name": file_obj.name,
            "history": FileHistorySerializer(history, many=True).data,
        })
    except File.DoesNotExist:
        return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_activity_history(request):
    """Return all activity history for the authenticated user."""
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")
    event_type = request.GET.get("event_type")
    if event_type:
        history = history.filter(event_type=event_type)
    days = request.GET.get("days")
    if days:
        try:
            since = timezone.now() - timedelta(days=int(days))
            history = history.filter(timestamp__gte=since)
        except ValueError:
            pass
    limit = int(request.GET.get("limit", 50))
    history = history[:limit]
    from .serializers import FileHistorySerializer
    return Response({
        "count": len(history),
        "history": FileHistorySerializer(history, many=True).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_activity(request):
    """Return last 10 activity events for the authenticated user."""
    user_files = File.objects.filter(owner=request.user)
    history = FileHistory.objects.filter(file__in=user_files).order_by("-timestamp")[:10]
    from .serializers import FileHistorySerializer
    return Response(FileHistorySerializer(history, many=True).data)


# --- Admin ---

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_list_users(request):
    """Return list of all users with file stats. Admin only."""
    users = User.objects.all().order_by("date_joined")
    data = []
    for user in users:
        file_stats = File.objects.filter(owner=user).aggregate(
            count=Count("id"), total_size=Sum("size")
        )
        data.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined.isoformat(),
            "file_count": file_stats["count"] or 0,
            "total_size": file_stats["total_size"] or 0,
        })
    return Response({"users": data, "total": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_stats(request):
    """Return aggregated file statistics across all users. Admin only."""
    total_files = File.objects.count()
    total_size = File.objects.aggregate(total=Sum("size"))["total"] or 0
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    return Response({
        "total_users": total_users,
        "active_users": active_users,
        "blocked_users": total_users - active_users,
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_block_user(request, user_id):
    """Block a user by setting is_active to False. Admin only."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    if user.id == request.user.id:
        return Response({"error": "Cannot block yourself"}, status=status.HTTP_400_BAD_REQUEST)
    user.is_active = False
    user.save(update_fields=["is_active"])
    logger.warning("Admin %s blocked user %s (id=%d)", request.user.email, user.email, user.id)
    return Response({"status": "blocked", "user_id": user_id, "email": user.email})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_unblock_user(request, user_id):
    """Unblock a user by setting is_active to True. Admin only."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = True
    user.save(update_fields=["is_active"])
    logger.info("Admin %s unblocked user %s (id=%d)", request.user.email, user.email, user.id)
    return Response({"status": "unblocked", "user_id": user_id, "email": user.email})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_delete_user(request, user_id):
    """Delete a user and all their files. Admin only. Logged."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    if user.id == request.user.id:
        return Response({"error": "Cannot delete yourself"}, status=status.HTTP_400_BAD_REQUEST)
    email = user.email
    file_count = File.objects.filter(owner=user).count()
    for f in File.objects.filter(owner=user):
        try:
            f.file.delete(save=False)
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Error deleting file during user deletion: %s", str(exc))
    user.delete()
    logger.warning(
        "Admin %s deleted user %s with %d file(s)",
        request.user.email, email, file_count,
    )
    return Response({
        "status": "deleted",
        "email": email,
        "files_deleted": file_count,
    })