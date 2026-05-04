import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from ep_files_app.core import config as app_config
from ep_files_app.models.models import File
from ep_files_app.services.file_service import FileService

pytestmark = pytest.mark.django_db


def test_file_service_upload_success_creates_file(settings, tmp_path, user_factory):
    settings.MEDIA_ROOT = tmp_path

    service = FileService()
    user = user_factory(email="files@example.com", password="StrongPass123")
    uploaded_file = SimpleUploadedFile(
        "notes.txt",
        b"hello world",
        content_type="text/plain",
    )

    file_obj, message = service.handle_upload(uploaded_file, user)

    assert file_obj is not None
    assert file_obj.owner == user
    assert file_obj.name == "notes.txt"
    assert file_obj.size == len(b"hello world")
    assert "проиндексирован" in message
    assert File.objects.count() == 1


def test_file_service_upload_without_user_returns_error():
    service = FileService()
    uploaded_file = SimpleUploadedFile(
        "notes.txt",
        b"hello world",
        content_type="text/plain",
    )

    file_obj, message = service.handle_upload(uploaded_file, None)

    assert file_obj is None
    assert message == "Ошибка: пользователь не авторизован."
    assert File.objects.count() == 0


def test_file_service_upload_too_large_returns_error(user_factory):
    service = FileService()
    user = user_factory(email="big@example.com", password="StrongPass123")
    uploaded_file = SimpleUploadedFile(
        "big.txt",
        b"x" * (app_config.MAX_FILE_SIZE + 1),
        content_type="text/plain",
    )

    file_obj, message = service.handle_upload(uploaded_file, user)

    assert file_obj is None
    assert message == "Ошибка: Превышен лимит размера файла."
    assert File.objects.count() == 0


def test_file_service_upload_storage_error_returns_error(
    settings,
    tmp_path,
    user_factory,
    monkeypatch,
):
    settings.MEDIA_ROOT = tmp_path

    service = FileService()
    user = user_factory(email="disk@example.com", password="StrongPass123")
    uploaded_file = SimpleUploadedFile(
        "notes.txt",
        b"hello world",
        content_type="text/plain",
    )

    def broken_save(self, *args, **kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(File, "save", broken_save)

    file_obj, message = service.handle_upload(uploaded_file, user)

    assert file_obj is None
    assert message == "Ошибка: не удалось сохранить файл."
    assert File.objects.count() == 0