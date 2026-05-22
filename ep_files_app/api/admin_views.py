"""API-представления для административного просмотра пользователей и управления контентом."""
import logging

from django.db.models import Count, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.core import config as app_config
from ep_files_app.models.models import File, User
from ep_files_app.permissions import IsAdminUser

logger = logging.getLogger(__name__)

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_list_users(request):
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
            "storage_limit": user.storage_limit,
        })
    return Response({"users": data, "total": len(data)})

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_stats(request):
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
        "max_storage_limit_mb": app_config.ADMIN_MAX_STORAGE_LIMIT_MB,
    })

@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_block_user(request, user_id):
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
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = True
    user.save(update_fields=["is_active"])
    logger.info("Admin %s unblocked user %s (id=%d)", request.user.email, user.email, user.id)
    return Response({"status": "unblocked", "user_id": user_id, "email": user.email})

@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_update_user_storage_limit(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    limit_mb = request.data.get("storage_limit_mb")
    try:
        limit_mb = int(limit_mb)
    except (TypeError, ValueError):
        return Response(
            {"error": "Лимит должен быть целым числом в мегабайтах."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if limit_mb < 1:
        return Response(
            {"error": "Лимит должен быть не меньше 1 МБ."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if limit_mb > app_config.ADMIN_MAX_STORAGE_LIMIT_MB:
        return Response(
            {
                "error": (
                    "Нельзя выдать больше "
                    f"{app_config.ADMIN_MAX_STORAGE_LIMIT_MB} МБ на пользователя."
                ),
                "max_storage_limit_mb": app_config.ADMIN_MAX_STORAGE_LIMIT_MB,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.storage_limit = limit_mb * 1024 * 1024
    user.save(update_fields=["storage_limit"])
    logger.info(
        "Admin %s changed storage limit for user %s (id=%d) to %d MB",
        request.user.email,
        user.email,
        user.id,
        limit_mb,
    )
    return Response({
        "status": "storage_limit_updated",
        "user_id": user.id,
        "email": user.email,
        "storage_limit": user.storage_limit,
        "storage_limit_mb": limit_mb,
    })

@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_delete_user_files(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    files = File.objects.filter(owner=user)
    deleted_count = 0
    deleted_size = 0

    for file_obj in files:
        deleted_size += file_obj.size or 0

        try:
            if file_obj.file:
                file_obj.file.delete(save=False)
        except Exception as exc:
            logger.error("Error deleting user file by admin: %s", str(exc))

        file_obj.delete()
        deleted_count += 1

    logger.warning(
        "Admin %s deleted %d file(s) of user %s",
        request.user.email,
        deleted_count,
        user.email,
    )

    return Response({
        "status": "files_deleted",
        "user_id": user.id,
        "email": user.email,
        "files_deleted": deleted_count,
        "deleted_size": deleted_size,
    })

@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_delete_user(request, user_id):
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
        except Exception as exc:
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
