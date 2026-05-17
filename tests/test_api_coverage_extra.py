import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from ep_files_app.models import File, FileHistory, Folder, Permission, User


def make_user(email, password="password123", name="Test User", is_staff=False):
    user = User(email=email, name=name, is_staff=is_staff)
    user.set_password(password)
    user.save()
    return user


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_uploaded_file(name="test.txt", content=b"hello"):
    return SimpleUploadedFile(name, content)


def make_file(owner, name="test.txt", content=b"hello", folder=None):
    return File.objects.create(
        name=name,
        owner=owner,
        folder=folder,
        file=make_uploaded_file(name, content),
        size=len(content),
    )


@pytest.mark.django_db
def test_file_detail_download_search_and_stats(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_user("files_api@example.com")
    stranger = make_user("stranger_files_api@example.com")
    client = auth_client(user)

    file_obj = make_file(user, "math_homework.txt", b"hello world")

    response = client.get(f"/api/files/{file_obj.id}/detail/")
    assert response.status_code == 200
    assert response.data["name"] == "math_homework.txt"

    response = auth_client(stranger).get(f"/api/files/{file_obj.id}/detail/")
    assert response.status_code == 403

    response = client.get("/api/files/999999/detail/")
    assert response.status_code == 404

    response = client.get(f"/api/files/{file_obj.id}/download/")
    assert response.status_code == 200

    response = auth_client(stranger).get(f"/api/files/{file_obj.id}/download/")
    assert response.status_code == 403

    response = client.get("/api/search/?q=math")
    assert response.status_code == 200
    assert response.data["count"] == 1

    response = client.get("/api/search/")
    assert response.status_code == 400

    response = client.get("/api/storage/stats/")
    assert response.status_code == 200
    assert response.data["total_files"] >= 1


@pytest.mark.django_db
def test_upload_api_validation(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_user("upload_validation@example.com")
    client = auth_client(user)

    response = client.post("/api/upload/", {}, format="multipart")
    assert response.status_code == 400

    response = client.post(
        "/api/upload/",
        {"file": make_uploaded_file("virus.exe", b"bad")},
        format="multipart",
    )
    assert response.status_code == 400

    response = client.post(
        "/api/upload/",
        {"file": make_uploaded_file("normal.txt", b"ok")},
        format="multipart",
    )
    assert response.status_code == 201
    assert File.objects.filter(owner=user, name="normal.txt").exists()


@pytest.mark.django_db
def test_delete_api_success_forbidden_and_not_found(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("delete_owner@example.com")
    stranger = make_user("delete_stranger@example.com")

    file_obj = make_file(owner, "delete_me.txt", b"delete")
    response = auth_client(stranger).delete(f"/api/files/{file_obj.id}/")
    assert response.status_code == 403
    assert File.objects.filter(id=file_obj.id).exists()

    response = auth_client(owner).delete(f"/api/files/{file_obj.id}/")
    assert response.status_code == 200
    assert not File.objects.filter(id=file_obj.id).exists()

    response = auth_client(owner).delete("/api/files/999999/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_folder_crud_api():
    user = make_user("folders@example.com")
    client = auth_client(user)

    response = client.post("/api/folders/create/", {"name": ""}, format="json")
    assert response.status_code == 400

    response = client.post(
        "/api/folders/create/",
        {"name": "Child", "parent_id": 999999},
        format="json",
    )
    assert response.status_code == 404

    response = client.post("/api/folders/create/", {"name": "Root"}, format="json")
    assert response.status_code == 201
    root_id = response.data["id"]

    response = client.post(
        "/api/folders/create/",
        {"name": "Child", "parent_id": root_id},
        format="json",
    )
    assert response.status_code == 201
    child_id = response.data["id"]

    response = client.get("/api/folders/")
    assert response.status_code == 200
    assert len(response.data["folders"]) == 2

    response = client.patch(f"/api/folders/{root_id}/rename/", {"name": ""}, format="json")
    assert response.status_code == 400

    response = client.patch(
        f"/api/folders/{root_id}/rename/",
        {"name": "Root Renamed"},
        format="json",
    )
    assert response.status_code == 200

    response = client.patch(
        f"/api/folders/{root_id}/move/",
        {"parent_id": child_id},
        format="json",
    )
    assert response.status_code == 400

    response = client.patch(
        f"/api/folders/{child_id}/move/",
        {"parent_id": None},
        format="json",
    )
    assert response.status_code == 200

    response = client.delete(f"/api/folders/{child_id}/delete/")
    assert response.status_code == 200

    response = client.delete("/api/folders/999999/delete/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_history_api(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_user("history@example.com")
    stranger = make_user("history_stranger@example.com")
    client = auth_client(user)

    file_obj = make_file(user, "history.txt", b"content")

    FileHistory.objects.create(
        file=file_obj,
        file_name=file_obj.name,
        event_type=FileHistory.EVENT_UPLOAD,
        user=user,
        details={"size": 7},
        ip_address="127.0.0.1",
    )

    response = client.get(f"/api/files/{file_obj.id}/history/")
    assert response.status_code == 200
    assert len(response.data["history"]) == 1

    response = auth_client(stranger).get(f"/api/files/{file_obj.id}/history/")
    assert response.status_code == 403

    response = client.get("/api/files/999999/history/")
    assert response.status_code == 404

    response = client.get("/api/history/?event_type=upload&days=bad&limit=5")
    assert response.status_code == 200
    assert response.data["count"] == 1

    response = client.get("/api/history/recent/")
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_admin_api(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    admin = make_user("admin@example.com", is_staff=True)
    target = make_user("target@example.com")
    make_file(target, "target.txt", b"content")

    client = auth_client(admin)

    response = client.get("/api/admin/users/")
    assert response.status_code == 200
    assert response.data["total"] >= 2

    response = client.get("/api/admin/stats/")
    assert response.status_code == 200
    assert response.data["total_users"] >= 2

    response = client.patch(f"/api/admin/users/{target.id}/block/")
    assert response.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False

    response = client.patch(f"/api/admin/users/{target.id}/unblock/")
    assert response.status_code == 200
    target.refresh_from_db()
    assert target.is_active is True

    response = client.patch(f"/api/admin/users/{admin.id}/block/")
    assert response.status_code == 400

    response = client.patch("/api/admin/users/999999/block/")
    assert response.status_code == 404

    response = client.delete(f"/api/admin/users/{admin.id}/delete/")
    assert response.status_code == 400

    response = client.delete(f"/api/admin/users/{target.id}/delete/")
    assert response.status_code == 200
    assert not User.objects.filter(id=target.id).exists()


@pytest.mark.django_db
def test_text_editor_api(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("editor@example.com")
    stranger = make_user("editor_stranger@example.com")

    text_file = make_file(owner, "notes.txt", b"old text")
    binary_file = make_file(owner, "image.png", b"not really image")

    client = auth_client(owner)

    response = client.get(f"/api/files/{text_file.id}/content/")
    assert response.status_code == 200
    assert response.data["content"] == "old text"

    response = client.post(
        f"/api/files/{text_file.id}/save/",
        {"content": '<script>alert(1)</script><b onclick="x()">hello</b>'},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["sanitized"] is True

    response = client.post(f"/api/files/{text_file.id}/save/", {}, format="json")
    assert response.status_code == 400

    response = client.get(f"/api/files/{binary_file.id}/content/")
    assert response.status_code == 400

    response = client.post(
        f"/api/files/{binary_file.id}/save/",
        {"content": "bad"},
        format="json",
    )
    assert response.status_code == 400

    response = auth_client(stranger).get(f"/api/files/{text_file.id}/content/")
    assert response.status_code == 403

    response = client.get("/api/files/999999/content/")
    assert response.status_code == 404