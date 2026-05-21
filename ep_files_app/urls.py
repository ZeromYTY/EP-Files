"""URL configuration for ep_files_app."""
from django.urls import path

from .api import views
from .api.views import (
    RegisterView, LoginView, MeView, protected_test_view,
    upload_file, list_files, download_file, delete_file,
    file_move, file_detail, user_storage_stats, search_files,
    folder_tree, folder_create, folder_rename, folder_move, folder_delete,
    file_history, user_activity_history, recent_activity,
    admin_list_users, admin_stats, admin_block_user,
    admin_unblock_user, admin_delete_user_files, admin_delete_user,
    save_text_file, read_text_file, toggle_favorite,
    download_folder, get_user_favorites, get_files,
)
from .api.permission_views import (
    grant_file_permission, revoke_file_permission, list_file_permissions,
    grant_folder_permission, revoke_folder_permission, list_folder_permissions,
    my_permissions, accessible_files, accessible_folders,
)

from .api.public_link_views import (
    enable_file_public_link,
    disable_file_public_link,
    public_download_file,
    enable_folder_public_link,
    disable_folder_public_link,
    public_folder_detail,
    public_folder_file_download,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("test-auth/", protected_test_view, name="test_auth"),

    path("upload/", upload_file, name="file_upload"),
    path("files/", get_files, name="get_files"),
    path("files/accessible/", accessible_files, name="accessible_files"),
    path("download/<int:file_id>/", download_file, name="download_file"),
    path("files/<int:file_id>/download/", download_file, name="download_file_alt"),
    path("files/<int:file_id>/", delete_file, name="delete_file"),
    path("files/<int:file_id>/move/", file_move, name="file_move"),
    path("files/<int:file_id>/detail/", file_detail, name="file_detail"),
    path("files/<int:file_id>/content/", read_text_file, name="read_text_file"),
    path("files/<int:file_id>/save/", save_text_file, name="save_text_file"),

    path("storage/stats/", user_storage_stats, name="storage_stats"),
    path("search/", search_files, name="search_files"),

    path("folders/", folder_tree, name="folder_tree"),
    path("folders/accessible/", accessible_folders, name="accessible_folders"),
    path("folders/create/", folder_create, name="folder_create"),
    path("folders/<int:folder_id>/rename/", folder_rename, name="folder_rename"),
    path("folders/<int:folder_id>/move/", folder_move, name="folder_move"),
    path("folders/<int:folder_id>/delete/", folder_delete, name="folder_delete"),
    path("folders/<int:folder_id>/download/", download_folder, name="download_folder"),

    path("files/<int:file_id>/history/", file_history, name="file_history"),
    path("history/", user_activity_history, name="user_activity_history"),
    path("history/recent/", recent_activity, name="recent_activity"),

    path("files/<int:file_id>/permissions/grant/", grant_file_permission, name="grant_file_permission"),
    path("files/<int:file_id>/permissions/revoke/", revoke_file_permission, name="revoke_file_permission"),
    path("files/<int:file_id>/permissions/", list_file_permissions, name="list_file_permissions"),

    path("folders/<int:folder_id>/permissions/grant/", grant_folder_permission, name="grant_folder_permission"),
    path("folders/<int:folder_id>/permissions/revoke/", revoke_folder_permission, name="revoke_folder_permission"),
    path("folders/<int:folder_id>/permissions/", list_folder_permissions, name="list_folder_permissions"),

    path("permissions/my/", my_permissions, name="my_permissions"),

    path("favorites/all/", get_user_favorites, name="get_user_favorites"),
    path("favorites/<int:item_id>/toggle/", toggle_favorite, name="toggle_favorite"),

    path("admin/users/", admin_list_users, name="admin_list_users"),
    path("admin/stats/", admin_stats, name="admin_stats"),
    path("admin/users/<int:user_id>/block/", admin_block_user, name="admin_block_user"),
    path("admin/users/<int:user_id>/unblock/", admin_unblock_user, name="admin_unblock_user"),
    path(
        "admin/users/<int:user_id>/files/delete/",
        admin_delete_user_files,
        name="admin_delete_user_files",
    ),
    path("admin/users/<int:user_id>/delete/", admin_delete_user, name="admin_delete_user"),
    path("files/<int:file_id>/public-link/", enable_file_public_link, name="enable_file_public_link"),
    path("files/<int:file_id>/public-link/disable/", disable_file_public_link, name="disable_file_public_link"),

    path("folders/<int:folder_id>/public-link/", enable_folder_public_link, name="enable_folder_public_link"),
    path("folders/<int:folder_id>/public-link/disable/", disable_folder_public_link, name="disable_folder_public_link"),

    path("public/files/<str:token>/", public_download_file, name="public_download_file"),
    path("public/folders/<str:token>/", public_folder_detail, name="public_folder_detail"),
    path(
        "public/folders/<str:token>/files/<int:file_id>/",
        public_folder_file_download,
        name="public_folder_file_download",
),

]