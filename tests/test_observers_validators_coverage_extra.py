from datetime import datetime

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from ep_files_app.models import File, FileHistory, User
from ep_files_app.observers import FileEvent, FileSubject
from ep_files_app.observers.history_observer import FileHistoryObserver
from ep_files_app.services.file_event_service import FileEventService
from ep_files_app.validators import (
    sanitize_filename,
    validate_file_extension,
    validate_file_size,
    validate_filename,
)


def make_user(email):
    user = User(email=email, name="Observer User")
    user.set_password("password123")
    user.save()
    return user


def make_file(owner, name="observer.txt", content=b"hello"):
    return File.objects.create(
        name=name,
        owner=owner,
        file=SimpleUploadedFile(name, content),
        size=len(content),
    )


class DummyObserver:
    def __init__(self):
        self.events = []

    def update(self, event):
        self.events.append(event)


class BrokenObserver:
    def update(self, event):
        raise RuntimeError("observer failed")


def make_event(file_obj=None, user=None, event_type="upload"):
    return FileEvent(
        event_type=event_type,
        file_id=file_obj.id if file_obj else None,
        file_name=file_obj.name if file_obj else "missing.txt",
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        timestamp=datetime.now(),
    )


def test_file_event_defaults():
    event = FileEvent(
        event_type="upload",
        file_id=None,
        file_name="a.txt",
        user_id=None,
        user_email=None,
        timestamp=None,
        details=None,
    )

    assert event.details == {}
    assert event.timestamp is not None


def test_file_subject_attach_detach_and_notify():
    subject = FileSubject()
    observer = DummyObserver()
    event = make_event()

    subject.attach(observer)
    subject.attach(observer)
    subject.notify(event)

    assert len(observer.events) == 1

    subject.detach(observer)
    subject.notify(event)

    assert len(observer.events) == 1


def test_file_subject_ignores_broken_observer():
    subject = FileSubject()
    broken = BrokenObserver()
    normal = DummyObserver()
    event = make_event()

    subject.attach(broken)
    subject.attach(normal)
    subject.notify(event)

    assert len(normal.events) == 1


@pytest.mark.django_db
def test_history_observer_creates_history(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_user("history_observer@example.com")
    file_obj = make_file(user)

    observer = FileHistoryObserver()
    event = make_event(file_obj=file_obj, user=user, event_type="upload")

    history = observer.update(event)

    assert history.file == file_obj
    assert history.user == user
    assert history.event_type == "upload"


@pytest.mark.django_db
def test_history_observer_handles_missing_file_and_user():
    observer = FileHistoryObserver()
    event = FileEvent(
        event_type="delete",
        file_id=999999,
        file_name="deleted.txt",
        user_id=999999,
        user_email="missing@example.com",
        timestamp=datetime.now(),
        ip_address="127.0.0.1",
    )

    observer.update(event)

    history = FileHistory.objects.get(file_name="deleted.txt")
    assert history.file is None
    assert history.user is None
    assert history.event_type == "delete"


@pytest.mark.django_db
def test_file_event_service_singleton_and_emit_events(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    service_one = FileEventService()
    service_two = FileEventService()
    assert service_one is service_two

    user = make_user("event_service@example.com")
    file_obj = make_file(user, "events.txt", b"content")

    service_one.emit_upload_event(file_obj, user, details={"size": file_obj.size})
    service_one.emit_download_event(file_obj, user)
    service_one.emit_rename_event(file_obj, "old.txt", "events.txt", user)
    service_one.emit_move_event(file_obj, "/old", "/new", user)
    service_one.emit_update_event(file_obj, user)
    service_one.emit_delete_event(file_obj.id, file_obj.name, user)

    assert FileHistory.objects.filter(user=user).count() >= 6


@pytest.mark.django_db
def test_file_history_event_display_all_types(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_user("display@example.com")
    file_obj = make_file(user, "display.txt")

    event_types = [
        FileHistory.EVENT_UPLOAD,
        FileHistory.EVENT_DOWNLOAD,
        FileHistory.EVENT_RENAME,
        FileHistory.EVENT_MOVE,
        FileHistory.EVENT_DELETE,
        FileHistory.EVENT_UPDATE,
    ]

    for event_type in event_types:
        history = FileHistory.objects.create(
            file=file_obj,
            file_name=file_obj.name,
            event_type=event_type,
            user=user,
            old_value="old",
            new_value="new",
        )
        assert file_obj.name in history.event_display or "old" in history.event_display


def test_validators_success_cases():
    good_file = SimpleUploadedFile("safe.txt", b"hello")

    assert validate_file_extension("safe.txt") is True
    assert validate_file_size(good_file, max_size=100) is True
    assert validate_filename("safe.txt") is True


def test_validators_error_cases():
    big_file = SimpleUploadedFile("big.txt", b"1234567890")

    with pytest.raises(ValidationError):
        validate_file_extension("bad.exe")

    with pytest.raises(ValidationError):
        validate_file_size(big_file, max_size=2)

    with pytest.raises(ValidationError):
        validate_filename("../bad.txt")


def test_sanitize_filename():
    assert sanitize_filename('bad<name>.txt') == "bad_name_.txt"

    long_name = "a" * 300 + ".txt"
    sanitized = sanitize_filename(long_name)

    assert len(sanitized) <= 255
    assert sanitized.endswith(".txt")