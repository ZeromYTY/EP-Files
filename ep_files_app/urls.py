from django.urls import path

from .api.views import (
    RegisterView, LoginView, MeView, protected_test_view,
    upload_file, list_files, download_file, delete_file,
    file_detail, user_storage_stats, search_files,
    folder_tree, folder_create, folder_rename, folder_move, folder_delete,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("test-auth/", protected_test_view, name="test_auth"),

    path("upload/", upload_file, name="file_upload"),
    path("files/", list_files, name="list_files"),
    path("files/<int:file_id>/download/", download_file, name="download_file"),
    path("files/<int:file_id>/", delete_file, name="delete_file"),
    path("files/<int:file_id>/detail/", file_detail, name="file_detail"),

    path("storage/stats/", user_storage_stats, name="storage_stats"),
    path("search/", search_files, name="search_files"),

    path("folders/", folder_tree, name="folder_tree"),
    path("folders/create/", folder_create, name="folder_create"),
    path("folders/<int:folder_id>/rename/", folder_rename, name="folder_rename"),
    path("folders/<int:folder_id>/move/", folder_move, name="folder_move"),
    path("folders/<int:folder_id>/delete/", folder_delete, name="folder_delete"),
]