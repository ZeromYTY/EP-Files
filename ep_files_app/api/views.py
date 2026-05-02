import logging
import os

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import File, Folder, User
from main import settings
from .serializers import UserRegistrationSerializer

file_log = logging.getLogger("file_ops")


def _username(request):
    """Return username string from request."""
    return str(request.user.username) if request.user.is_authenticated else "anonymous"


def _json_folder(f):
    """Serialize a Folder instance to a dict."""
    return {
        "id": f.id,
        "name": f.name,
        "parent_id": f.parent_id,
        "path": f.get_full_path(),
        "created_at": f.created_at.isoformat(),
        "updated_at": f.updated_at.isoformat(),
    }


def _json_file(f):
    """Serialize a File instance to a dict."""
    return {"id": f.id, "name": f.name, "folder_id": f.folder_id, "size": f.size}


# --- Auth (JWT) ---

class RegisterView(generics.CreateAPIView):
    """API view for user registration."""

    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


class LoginView(APIView):
    """API view for JWT login."""

    permission_classes = (AllowAny,)

    def post(self, request):
        """Handle POST login request and return JWT tokens."""
        email = request.data.get("email")
        password = request.data.get("password")
        user = User.objects.filter(email=email).first()
        if user and check_password(password, user.password_hash):
            refresh = RefreshToken.for_user(user)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            })
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    """Test endpoint to verify JWT authentication."""
    return Response({"message": "Access granted. JWT is working."})


# --- Session Auth ---

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """Log in a user via session authentication."""
    username = request.POST.get("username")
    password = request.POST.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({"status": "ok", "username": user.username})
    return JsonResponse({"error": "Invalid credentials"}, status=401)


@require_http_methods(["POST"])
def logout_view(request):
    """Log out the current user."""
    logout(request)
    return JsonResponse({"status": "logged out"})


# --- Files ---

@login_required
def upload_file(request):
    """Upload a file for the authenticated user."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "No such file"}, status=400)
    if uploaded_file.size > settings.MAX_FILE_SIZE:
        return JsonResponse({"error": "File is too large"}, status=400)
    folder_id = request.POST.get("folder_id")
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user) if folder_id else None
    file = File(file=uploaded_file, owner=request.user, folder=folder)
    file.save()
    file_log.info("File uploaded: '%s' size=%dB", file.name, uploaded_file.size,
                  extra={"user": _username(request)})
    return JsonResponse({"message": "File uploaded successfully", "file_id": file.id}, status=201)


def download_file(request, file_id):
    """Download a file by its ID."""
    try:
        file_rec = File.objects.get(id=file_id)
    except File.DoesNotExist as exc:
        raise Http404 from exc
    file_log.info("File downloaded: id=%d", file_id, extra={"user": _username(request)})
    response = FileResponse(file_rec.file.open("rb"))
    filename = os.path.basename(file_rec.file.name)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@login_required
@require_http_methods(["GET"])
def file_list(request):
    """Return a list of files for the authenticated user."""
    username = _username(request)
    try:
        folder_id = request.GET.get("folder_id")
        qs = File.objects.filter(owner=request.user)
        if folder_id:
            qs = qs.filter(folder_id=folder_id)
        data = [_json_file(f) for f in qs]
        file_log.debug("File list fetched: %d file(s)", len(data), extra={"user": username})
        return JsonResponse({"files": data})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("File list failed: %s", exc, extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to fetch files"}, status=500)


file_upload = upload_file


@login_required
@require_http_methods(["POST"])
def file_delete(request, file_id):
    """Delete a file by its ID."""
    username = _username(request)
    f = get_object_or_404(File, id=file_id, owner=request.user)
    try:
        name = f.name
        f.file.delete(save=False)
        f.delete()
        file_log.warning("File deleted: '%s' id=%d", name, file_id, extra={"user": username})
        return JsonResponse({"status": "deleted", "id": file_id})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("File delete failed id=%d: %s", file_id, exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to delete file"}, status=500)


@login_required
@require_http_methods(["POST"])
def file_move(request, file_id):
    """Move a file to a different folder."""
    username = _username(request)
    f = get_object_or_404(File, id=file_id, owner=request.user)
    try:
        old_location = str(f)
        folder_id = request.POST.get("folder_id")
        f.folder = (
            get_object_or_404(Folder, id=folder_id, owner=request.user) if folder_id else None
        )
        f.save(update_fields=["folder"])
        file_log.info("File moved: '%s' -> '%s'", old_location, f, extra={"user": username})
        return JsonResponse({"status": "moved", "file": _json_file(f)})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("File move failed id=%d: %s", file_id, exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "File move failed"}, status=500)


# --- Folders ---

@login_required
@require_http_methods(["GET"])
def folder_tree(request):
    """Return all folders for the authenticated user."""
    username = _username(request)
    try:
        folders = Folder.objects.filter(owner=request.user).select_related("parent")
        data = [_json_folder(f) for f in folders]
        file_log.debug("Folder tree fetched: %d folder(s)", len(data), extra={"user": username})
        return JsonResponse({"folders": data})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("Failed to fetch folder tree: %s", exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to fetch folders"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_create(request):
    """Create a new folder for the authenticated user."""
    username = _username(request)
    name = request.POST.get("name", "").strip()
    parent_id = request.POST.get("parent_id")
    if not name:
        return JsonResponse({"error": "Folder name is required"}, status=400)
    try:
        parent = (
            get_object_or_404(Folder, id=parent_id, owner=request.user) if parent_id else None
        )
        folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
        file_log.info("Folder created: '%s'", folder.get_full_path(), extra={"user": username})
        return JsonResponse({"status": "created", "folder": _json_folder(folder)}, status=201)
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("Folder create failed: %s", exc, extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to create folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_rename(request, folder_id):
    """Rename a folder by its ID."""
    username = _username(request)
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    new_name = request.POST.get("name", "").strip()
    if not new_name:
        return JsonResponse({"error": "New name is required"}, status=400)
    try:
        old_path = folder.get_full_path()
        folder.name = new_name
        folder.save(update_fields=["name", "updated_at"])
        file_log.info("Folder renamed: '%s' -> '%s'", old_path, folder.get_full_path(),
                      extra={"user": username})
        return JsonResponse({"status": "renamed", "folder": _json_folder(folder)})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("Folder rename failed id=%d: %s", folder_id, exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to rename folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_move(request, folder_id):
    """Move a folder to a new parent."""
    username = _username(request)
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    new_parent_id = request.POST.get("parent_id")
    try:
        old_path = folder.get_full_path()
        new_parent = None
        if new_parent_id:
            new_parent = get_object_or_404(Folder, id=new_parent_id, owner=request.user)
            if new_parent.id == folder.id or new_parent.id in folder.get_all_descendant_ids():
                return JsonResponse({"error": "Cannot move folder into its own subtree"}, status=400)
        folder.parent = new_parent
        folder.save(update_fields=["parent", "updated_at"])
        file_log.info("Folder moved: '%s' -> '%s'", old_path, folder.get_full_path(),
                      extra={"user": username})
        return JsonResponse({"status": "moved", "folder": _json_folder(folder)})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("Folder move failed id=%d: %s", folder_id, exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to move folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_delete(request, folder_id):
    """Delete a folder and all its contents."""
    username = _username(request)
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    try:
        path = folder.get_full_path()
        descendant_count = len(folder.get_all_descendant_ids())
        file_count = File.objects.filter(folder=folder).count()
        folder.delete()
        file_log.warning("Folder deleted: '%s' (+%d subfolder(s), +%d file(s))",
                         path, descendant_count, file_count, extra={"user": username})
        return JsonResponse({"status": "deleted", "id": folder_id})
    except Exception as exc:  # pylint: disable=broad-except
        file_log.error("Folder delete failed id=%d: %s", folder_id, exc,
                       extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to delete folder"}, status=500)