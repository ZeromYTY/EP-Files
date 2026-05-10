"""URL configuration for ep_files_app."""
from django.urls import path

from .api.views import (
    RegisterView, LoginView, MeView, protected_test_view,
    upload_file, list_files, download_file, delete_file,
    file_detail, user_storage_stats, search_files,
    folder_tree, folder_create, folder_rename, folder_move, folder_delete,
    file_history, user_activity_history, recent_activity,
    admin_list_users, admin_stats, admin_block_user,
    admin_unblock_user, admin_delete_user,
)
from .api.permission_views import (
    grant_file_permission, revoke_file_permission, list_file_permissions,
    grant_folder_permission, revoke_folder_permission, list_folder_permissions,
    my_permissions, accessible_files, accessible_folders,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("test-auth/", protected_test_view, name="test_auth"),

    path("upload/", upload_file, name="file_upload"),
    path("files/", list_files, name="list_files"),
    path("files/accessible/", accessible_files, name="accessible_files"),
    path("files/<int:file_id>/download/", download_file, name="download_file"),
    path("files/<int:file_id>/", delete_file, name="delete_file"),
    path("files/<int:file_id>/detail/", file_detail, name="file_detail"),

    path("storage/stats/", user_storage_stats, name="storage_stats"),
    path("search/", search_files, name="search_files"),

    path("folders/", folder_tree, name="folder_tree"),
    path("folders/accessible/", accessible_folders, name="accessible_folders"),
    path("folders/create/", folder_create, name="folder_create"),
    path("folders/<int:folder_id>/rename/", folder_rename, name="folder_rename"),
    path("folders/<int:folder_id>/move/", folder_move, name="folder_move"),
    path("folders/<int:folder_id>/delete/", folder_delete, name="folder_delete"),

    path("files/<int:file_id>/history/", file_history, name="file_history"),
    path("history/", user_activity_history, name="user_activity_history"),
    path("history/recent/", recent_activity, name="recent_activity"),
    
    # Управление правами доступа
    path("files/<int:file_id>/permissions/grant/", grant_file_permission, name="grant_file_permission"),
    path("files/<int:file_id>/permissions/revoke/", revoke_file_permission, name="revoke_file_permission"),
    path("files/<int:file_id>/permissions/", list_file_permissions, name="list_file_permissions"),
    
    path("folders/<int:folder_id>/permissions/grant/", grant_folder_permission, name="grant_folder_permission"),
    path("folders/<int:folder_id>/permissions/revoke/", revoke_folder_permission, name="revoke_folder_permission"),
    path("folders/<int:folder_id>/permissions/", list_folder_permissions, name="list_folder_permissions"),
    
    path("permissions/my/", my_permissions, name="my_permissions"),

    # Admin
    path("admin/users/", admin_list_users, name="admin_list_users"),
    path("admin/stats/", admin_stats, name="admin_stats"),
    path("admin/users/<int:user_id>/block/", admin_block_user, name="admin_block_user"),
    path("admin/users/<int:user_id>/unblock/", admin_unblock_user, name="admin_unblock_user"),
    path("admin/users/<int:user_id>/delete/", admin_delete_user, name="admin_delete_user"),
]
