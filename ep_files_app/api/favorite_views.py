"""API-представления для работы с избранными файлами и папками."""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.models.models import File, Folder, FavoriteFile

logger = logging.getLogger(__name__)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_favorite(request, item_id):
    item_type = request.data.get("type", "file")

    if item_type == "folder":
        try:
            item_obj = Folder.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, folder=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Папка удалена из избранного"})
            FavoriteFile.objects.create(user=request.user, folder=item_obj)
            return Response({"is_favorite": True, "message": "Папка добавлена в избранное"})
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)
    else:
        try:
            item_obj = File.objects.get(id=item_id, owner=request.user)
            fav_queryset = FavoriteFile.objects.filter(user=request.user, file=item_obj)
            if fav_queryset.exists():
                fav_queryset.delete()
                return Response({"is_favorite": False, "message": "Файл удален из избранного"})
            FavoriteFile.objects.create(user=request.user, file=item_obj)
            return Response({"is_favorite": True, "message": "Файл добавлен в избранное"})
        except File.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_favorites(request):
    favs = FavoriteFile.objects.filter(user=request.user)

    result = []
    for f in favs:
        if f.file:
            result.append({"id": f.file.id, "name": f.file.name, "type": "file", "size": f.file.size})
        elif f.folder:
            result.append({"id": f.folder.id, "name": f.folder.name, "type": "folder", "size": 0})

    return Response({
        "file_ids": list(favs.filter(file__isnull=False).values_list('file_id', flat=True)),
        "folder_ids": list(favs.filter(folder__isnull=False).values_list('folder_id', flat=True)),
        "items": result
    })
