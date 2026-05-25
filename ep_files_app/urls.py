"""URL configuration for ep_files_app."""
from django.urls import path

from .api import views
from .api.views import (
    ChangePasswordView, RegisterView, LoginView, MeView, protected_test_view,
    upload_file, list_files, download_file, delete_file,
    file_move, file_detail, report_file, user_storage_stats, search_files,
    folder_tree, folder_create, folder_rename, folder_move, folder_delete,
    file_history, user_activity_history, recent_activity,
    admin_list_users, admin_stats, admin_block_user,
    admin_unblock_user, admin_update_user_storage_limit,
    admin_delete_user_files, admin_delete_user,
    admin_list_file_reports, admin_resolve_file_report,
    admin_download_reported_file,
    save_text_file, read_text_file, toggle_favorite,
    download_folder, get_user_favorites, get_files,
    trash_list, trash_restore, trash_delete, trash_clear,
    trash_restore_folder, trash_delete_folder,
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
    report_public_file,
    enable_folder_public_link,
    disable_folder_public_link,
    public_folder_detail,
    public_folder_file_download,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("auth/avatar/", views.avatar_view, name="avatar"),
    path("test-auth/", protected_test_view, name="test_auth"),

    path("upload/", upload_file, name="file_upload"),
    path("files/", get_files, name="get_files"),
    path("files/accessible/", accessible_files, name="accessible_files"),
    path("download/<int:file_id>/", download_file, name="download_file"),
    path("files/<int:file_id>/download/", download_file, name="download_file_alt"),
    path("files/<int:file_id>/", delete_file, name="delete_file"),
    path("files/<int:file_id>/move/", file_move, name="file_move"),
    path("files/<int:file_id>/detail/", file_detail, name="file_detail"),
    path("files/<int:file_id>/report/", report_file, name="report_file"),
    path("files/<int:file_id>/content/", read_text_file, name="read_text_file"),
    path("files/<int:file_id>/save/", save_text_file, name="save_text_file"),
    path("trash/", trash_list, name="trash_list"),
    path("trash/clear/", trash_clear, name="trash_clear"),
    path("trash/folders/<int:folder_id>/restore/", trash_restore_folder, name="trash_restore_folder"),
    path("trash/folders/<int:folder_id>/", trash_delete_folder, name="trash_delete_folder"),
    path("trash/<int:file_id>/restore/", trash_restore, name="trash_restore"),
    path("trash/<int:file_id>/", trash_delete, name="trash_delete"),

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
        "admin/users/<int:user_id>/storage-limit/",
        admin_update_user_storage_limit,
        name="admin_update_user_storage_limit",
    ),
    path(
        "admin/users/<int:user_id>/files/delete/",
        admin_delete_user_files,
        name="admin_delete_user_files",
    ),
    path("admin/users/<int:user_id>/delete/", admin_delete_user, name="admin_delete_user"),
    path("admin/reports/", admin_list_file_reports, name="admin_list_file_reports"),
    path("admin/reports/<int:report_id>/resolve/", admin_resolve_file_report, name="admin_resolve_file_report"),
    path("admin/reports/<int:report_id>/download/", admin_download_reported_file, name="admin_download_reported_file"),
    path("files/<int:file_id>/public-link/", enable_file_public_link, name="enable_file_public_link"),
    path("files/<int:file_id>/public-link/disable/", disable_file_public_link, name="disable_file_public_link"),

    path("folders/<int:folder_id>/public-link/", enable_folder_public_link, name="enable_folder_public_link"),
    path("folders/<int:folder_id>/public-link/disable/", disable_folder_public_link, name="disable_folder_public_link"),

    path("public/files/<str:token>/", public_download_file, name="public_download_file"),
    path("public/files/<str:token>/report/", report_public_file, name="report_public_file"),
    path("public/folders/<str:token>/", public_folder_detail, name="public_folder_detail"),
    path(
        "public/folders/<str:token>/files/<int:file_id>/",
        public_folder_file_download,
        name="public_folder_file_download",
),

]
