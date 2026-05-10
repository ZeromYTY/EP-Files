
from ep_files_app.permissions import IsAdminUser
from django.db.models import Count


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
        request.user.email, email, file_count
    )
    return Response({
        "status": "deleted",
        "email": email,
        "files_deleted": file_count,
    })