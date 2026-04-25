import logging
import os

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt

from ep_files_app.models.models import File, Folder, User
from .serializers import UserRegistrationSerializer
from main import settings

file_log = logging.getLogger("file_ops")


def _username(request):
    return str(request.user.username) if request.user.is_authenticated else "anonymous"

def _json_folder(f):
    return {"id": f.id, "name": f.name, "parent_id": f.parent_id,
            "path": f.get_full_path(), "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat()}

def _json_file(f):
    return {"id": f.id, "name": f.name, "folder_id": f.folder_id, "size": f.size}


# --- Auth (JWT) ---

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = User.objects.filter(email=email).first()
        if user and check_password(password, user.password_hash):
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })
        return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    return Response({"message": "Доступ разрешён! JWT работает."})


# --- Session Auth ---

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    username = request.POST.get("username")
    password = request.POST.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({"status": "ok", "username": user.username})
    return JsonResponse({"error": "Invalid credentials"}, status=401)


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({"status": "logged out"})


# --- Files ---

@login_required
def upload_file(request):
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "No such file"}, status=400)
        if uploaded_file.size > settings.MAX_FILE_SIZE:
            return JsonResponse({'error': 'Файл слишком большой!'}, status=400)
        folder_id = request.POST.get("folder_id")
        folder = get_object_or_404(Folder, id=folder_id, owner=request.user) if folder_id else None
        file = File(file=uploaded_file, owner=request.user, folder=folder)
        file.save()
        file_log.info(f"File uploaded: '{file.name}' size={uploaded_file.size}B", extra={"user": _username(request)})
        return JsonResponse({'message': 'Файл успешно загружен!', 'file_id': file.id}, status=201)


def download_file(request, file_id):
    try:
        file_rec = File.objects.get(id=file_id)
    except File.DoesNotExist:
        raise Http404
    file_log.info(f"File downloaded: id={file_id}", extra={"user": _username(request)})
    response = FileResponse(file_rec.file.open('rb'))
    filename = os.path.basename(file_rec.file.name)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@login_required
@require_http_methods(["GET"])
def file_list(request):
    username = _username(request)
    try:
        folder_id = request.GET.get("folder_id")
        qs = File.objects.filter(owner=request.user)
        if folder_id:
            qs = qs.filter(folder_id=folder_id)
        data = [_json_file(f) for f in qs]
        file_log.debug(f"File list fetched — {len(data)} file(s)", extra={"user": username})
        return JsonResponse({"files": data})
    except Exception as exc:
        file_log.error(f"File list failed: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to fetch files"}, status=500)


file_upload = upload_file


@login_required
@require_http_methods(["POST"])
def file_delete(request, file_id):
    username = _username(request)
    f = get_object_or_404(File, id=file_id, owner=request.user)
    try:
        name = f.name
        f.file.delete(save=False)
        f.delete()
        file_log.warning(f"File deleted: '{name}' id={file_id}", extra={"user": username})
        return JsonResponse({"status": "deleted", "id": file_id})
    except Exception as exc:
        file_log.error(f"File delete failed id={file_id}: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to delete file"}, status=500)


@login_required
@require_http_methods(["POST"])
def file_move(request, file_id):
    username = _username(request)
    f = get_object_or_404(File, id=file_id, owner=request.user)
    try:
        old_location = str(f)
        folder_id = request.POST.get("folder_id")
        f.folder = get_object_or_404(Folder, id=folder_id, owner=request.user) if folder_id else None
        f.save(update_fields=["folder"])
        file_log.info(f"File moved: '{old_location}' → '{f}'", extra={"user": username})
        return JsonResponse({"status": "moved", "file": _json_file(f)})
    except Exception as exc:
        file_log.error(f"File move failed id={file_id}: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "File move failed"}, status=500)


# --- Folders ---

@login_required
@require_http_methods(["GET"])
def folder_tree(request):
    username = _username(request)
    try:
        folders = Folder.objects.filter(owner=request.user).select_related("parent")
        data = [_json_folder(f) for f in folders]
        file_log.debug(f"Folder tree fetched — {len(data)} folder(s)", extra={"user": username})
        return JsonResponse({"folders": data})
    except Exception as exc:
        file_log.error(f"Failed to fetch folder tree: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to fetch folders"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_create(request):
    username = _username(request)
    name = request.POST.get("name", "").strip()
    parent_id = request.POST.get("parent_id")
    if not name:
        return JsonResponse({"error": "Folder name is required"}, status=400)
    try:
        parent = get_object_or_404(Folder, id=parent_id, owner=request.user) if parent_id else None
        folder = Folder.objects.create(name=name, owner=request.user, parent=parent)
        file_log.info(f"Folder created: '{folder.get_full_path()}'", extra={"user": username})
        return JsonResponse({"status": "created", "folder": _json_folder(folder)}, status=201)
    except Exception as exc:
        file_log.error(f"Folder create failed: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to create folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_rename(request, folder_id):
    username = _username(request)
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    new_name = request.POST.get("name", "").strip()
    if not new_name:
        return JsonResponse({"error": "New name is required"}, status=400)
    try:
        old_path = folder.get_full_path()
        folder.name = new_name
        folder.save(update_fields=["name", "updated_at"])
        file_log.info(f"Folder renamed: '{old_path}' → '{folder.get_full_path()}'", extra={"user": username})
        return JsonResponse({"status": "renamed", "folder": _json_folder(folder)})
    except Exception as exc:
        file_log.error(f"Folder rename failed id={folder_id}: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to rename folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_move(request, folder_id):
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
        file_log.info(f"Folder moved: '{old_path}' → '{folder.get_full_path()}'", extra={"user": username})
        return JsonResponse({"status": "moved", "folder": _json_folder(folder)})
    except Exception as exc:
        file_log.error(f"Folder move failed id={folder_id}: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to move folder"}, status=500)


@login_required
@require_http_methods(["POST"])
def folder_delete(request, folder_id):
    username = _username(request)
    folder = get_object_or_404(Folder, id=folder_id, owner=request.user)
    try:
        path = folder.get_full_path()
        descendant_count = len(folder.get_all_descendant_ids())
        file_count = File.objects.filter(folder=folder).count()
        folder.delete()
        file_log.warning(
            f"Folder deleted: '{path}' (+{descendant_count} subfolder(s), +{file_count} file(s))",
            extra={"user": username},
        )
        return JsonResponse({"status": "deleted", "id": folder_id})
    except Exception as exc:
        file_log.error(f"Folder delete failed id={folder_id}: {exc}", extra={"user": username}, exc_info=True)
        return JsonResponse({"error": "Failed to delete folder"}, status=500)