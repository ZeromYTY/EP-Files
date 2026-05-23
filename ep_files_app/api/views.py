"""Compatibility exports for EP Files API views."""
from .auth_views import RegisterView, LoginView, MeView, protected_test_view
from .favorite_views import toggle_favorite, get_user_favorites
from .folder_views import (add_folder_to_zip, download_folder, folder_tree, get_files, folder_create, folder_rename, folder_move, folder_delete)
from .file_views import (upload_file, list_files, download_file, delete_file, file_move, file_detail, report_file, file_preview, search_files, user_storage_stats)
from .history_views import file_history, user_activity_history, recent_activity
from .admin_views import (
    admin_list_users,
    admin_stats,
    admin_block_user,
    admin_unblock_user,
    admin_update_user_storage_limit,
    admin_delete_user_files,
    admin_delete_user,
    admin_list_file_reports,
    admin_resolve_file_report,
    admin_download_reported_file,
)
from .text_file_views import save_text_file, read_text_file
