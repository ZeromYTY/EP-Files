"""API-представления для административного просмотра пользователей и управления контентом."""
import logging
import mimetypes
import os

from django.db.models import Count, Sum
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ep_files_app.core import config as app_config
from ep_files_app.models.models import File, FileReport, User
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
        "pending_reports": FileReport.objects.filter(status=FileReport.STATUS_PENDING).count(),
    })


def _serialize_file_report(report):
    file_obj = report.file
    return {
        "id": report.id,
        "file_id": file_obj.id if file_obj else None,
        "file_name": report.file_name,
        "file_owner_email": report.file_owner_email,
        "file_size": file_obj.size if file_obj else None,
        "file_exists": file_obj is not None,
        "file_is_public": bool(file_obj and file_obj.is_public),
        "public_token": report.public_token,
        "reporter_email": report.reporter_email,
        "reason": report.reason,
        "message": report.message,
        "status": report.status,
        "admin_action": report.admin_action,
        "admin_note": report.admin_note,
        "reviewed_by_email": report.reviewed_by.email if report.reviewed_by else "",
        "created_at": report.created_at.isoformat(),
        "resolved_at": report.resolved_at.isoformat() if report.resolved_at else None,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_list_file_reports(request):
    status_filter = request.GET.get("status")
    reports = FileReport.objects.select_related("file", "reviewed_by").all()
    if status_filter in {FileReport.STATUS_PENDING, FileReport.STATUS_RESOLVED}:
        reports = reports.filter(status=status_filter)
    return Response({
        "reports": [_serialize_file_report(report) for report in reports],
        "pending": FileReport.objects.filter(status=FileReport.STATUS_PENDING).count(),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_resolve_file_report(request, report_id):
    try:
        report = FileReport.objects.select_related("file").get(id=report_id)
    except FileReport.DoesNotExist:
        return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get("action")
    admin_note = (request.data.get("admin_note") or "").strip()
    if action not in {FileReport.ACTION_KEEP, FileReport.ACTION_DISABLE_PUBLIC, FileReport.ACTION_DELETE_FILE}:
        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    file_obj = report.file
    if action in {FileReport.ACTION_DISABLE_PUBLIC, FileReport.ACTION_DELETE_FILE} and file_obj is None:
        return Response({"error": "File already deleted"}, status=status.HTTP_400_BAD_REQUEST)

    if action == FileReport.ACTION_DISABLE_PUBLIC:
        file_obj.is_public = False
        file_obj.public_token = None
        file_obj.public_expires_at = None
        file_obj.save(update_fields=["is_public", "public_token", "public_expires_at"])
        logger.warning("Admin %s disabled public link for reported file %s", request.user.email, report.file_name)
    elif action == FileReport.ACTION_DELETE_FILE:
        try:
            if file_obj.file:
                file_obj.file.delete(save=False)
        except Exception as exc:
            logger.error("Error deleting reported file by admin: %s", str(exc))
        file_obj.delete()
        report.file = None
        logger.warning("Admin %s deleted reported file %s", request.user.email, report.file_name)
    else:
        logger.info("Admin %s kept reported file %s", request.user.email, report.file_name)

    report.status = FileReport.STATUS_RESOLVED
    report.admin_action = action
    report.admin_note = admin_note
    report.reviewed_by = request.user
    report.resolved_at = timezone.now()
    report.save(update_fields=["status", "admin_action", "admin_note", "reviewed_by", "resolved_at"])

    return Response({"status": "resolved", "report": _serialize_file_report(report)})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_download_reported_file(request, report_id):
    try:
        report = FileReport.objects.select_related("file").get(id=report_id)
    except FileReport.DoesNotExist:
        return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)

    file_obj = report.file
    if file_obj is None:
        return Response({"error": "File already deleted"}, status=status.HTTP_404_NOT_FOUND)
    if not file_obj.file or not os.path.exists(file_obj.file.path):
        return Response({"error": "File not found on server"}, status=status.HTTP_404_NOT_FOUND)

    file_handle = file_obj.file.open("rb")
    content_type, _ = mimetypes.guess_type(file_obj.name)
    response = FileResponse(file_handle, content_type=content_type or "application/octet-stream")
    response["Content-Disposition"] = f'attachment; filename="{file_obj.name}"'
    response["Content-Length"] = file_obj.size
    return response

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
