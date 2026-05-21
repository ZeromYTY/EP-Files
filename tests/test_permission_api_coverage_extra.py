import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from ep_files_app.models import File, Folder, Permission, User


def make_user(email, password="password123", name="Test User"):
    user = User(email=email, name=name)
    user.set_password(password)
    user.save()
    return user


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_file(owner, name="shared.txt", content=b"hello", folder=None):
    return File.objects.create(
        name=name,
        owner=owner,
        folder=folder,
        file=SimpleUploadedFile(name, content),
        size=len(content),
    )


@pytest.mark.django_db
def test_file_permission_grant_list_revoke(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("perm_owner@example.com")
    target = make_user("perm_target@example.com")
    file_obj = make_file(owner)

    client = auth_client(owner)

    response = client.post(
        f"/api/files/{file_obj.id}/permissions/grant/",
        {
            "user_email": target.email,
            "permission_type": Permission.READ_WRITE,
            "inherit": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert Permission.objects.filter(user=target, file=file_obj).exists()

    response = client.get(f"/api/files/{file_obj.id}/permissions/")
    assert response.status_code == 200
    assert len(response.data["permissions"]) == 1

    response = auth_client(target).get("/api/permissions/my/")
    assert response.status_code == 200
    assert response.data["count"] == 1

    response = auth_client(target).get("/api/files/accessible/")
    assert response.status_code == 200
    assert response.data["count"] == 1

    response = client.delete(
        f"/api/files/{file_obj.id}/permissions/revoke/",
        {"user_email": target.email},
        format="json",
    )
    assert response.status_code == 200
    assert not Permission.objects.filter(user=target, file=file_obj).exists()


@pytest.mark.django_db
def test_file_permission_errors(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("perm_errors_owner@example.com")
    target = make_user("perm_errors_target@example.com")
    stranger = make_user("perm_errors_stranger@example.com")
    file_obj = make_file(owner)

    owner_client = auth_client(owner)
    stranger_client = auth_client(stranger)

    response = owner_client.post("/api/files/999999/permissions/grant/", {"user_email": target.email}, format="json")
    assert response.status_code == 404

    response = stranger_client.post(f"/api/files/{file_obj.id}/permissions/grant/", {"user_email": target.email}, format="json")
    assert response.status_code == 403

    response = owner_client.post(f"/api/files/{file_obj.id}/permissions/grant/", {}, format="json")
    assert response.status_code == 400

    response = owner_client.post(f"/api/files/{file_obj.id}/permissions/grant/", {"user_email": "missing@example.com"}, format="json")
    assert response.status_code == 404

    response = owner_client.post(f"/api/files/{file_obj.id}/permissions/grant/", {"user_email": owner.email}, format="json")
    assert response.status_code == 400

    response = stranger_client.get(f"/api/files/{file_obj.id}/permissions/")
    assert response.status_code == 403

    response = owner_client.get("/api/files/999999/permissions/")
    assert response.status_code == 404

    response = owner_client.delete(f"/api/files/{file_obj.id}/permissions/revoke/", {"user_email": target.email}, format="json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_folder_permission_grant_list_accessible_revoke():
    owner = make_user("folder_perm_owner@example.com")
    target = make_user("folder_perm_target@example.com")

    folder = Folder.objects.create(name="Shared Folder", owner=owner)
    client = auth_client(owner)

    response = client.post(
        f"/api/folders/{folder.id}/permissions/grant/",
        {
            "user_email": target.email,
            "permission_type": Permission.READ,
            "inherit": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert Permission.objects.filter(user=target, folder=folder).exists()

    response = client.get(f"/api/folders/{folder.id}/permissions/")
    assert response.status_code == 200
    assert len(response.data["permissions"]) == 1

    response = auth_client(target).get("/api/folders/accessible/")
    assert response.status_code == 200
    assert response.data["count"] == 1

    response = client.delete(
        f"/api/folders/{folder.id}/permissions/revoke/",
        {"user_email": target.email},
        format="json",
    )
    assert response.status_code == 200
    assert not Permission.objects.filter(user=target, folder=folder).exists()


@pytest.mark.django_db
def test_folder_permission_errors():
    owner = make_user("folder_perm_errors_owner@example.com")
    target = make_user("folder_perm_errors_target@example.com")
    stranger = make_user("folder_perm_errors_stranger@example.com")

    folder = Folder.objects.create(name="Private Folder", owner=owner)

    owner_client = auth_client(owner)
    stranger_client = auth_client(stranger)

    response = owner_client.post("/api/folders/999999/permissions/grant/", {"user_email": target.email}, format="json")
    assert response.status_code == 404

    response = stranger_client.post(f"/api/folders/{folder.id}/permissions/grant/", {"user_email": target.email}, format="json")
    assert response.status_code == 403

    response = owner_client.post(f"/api/folders/{folder.id}/permissions/grant/", {}, format="json")
    assert response.status_code == 400

    response = owner_client.post(f"/api/folders/{folder.id}/permissions/grant/", {"user_email": "missing@example.com"}, format="json")
    assert response.status_code == 404

    response = owner_client.post(f"/api/folders/{folder.id}/permissions/grant/", {"user_email": owner.email}, format="json")
    assert response.status_code == 400

    response = stranger_client.get(f"/api/folders/{folder.id}/permissions/")
    assert response.status_code == 403

    response = owner_client.get("/api/folders/999999/permissions/")
    assert response.status_code == 404

    response = owner_client.delete(f"/api/folders/{folder.id}/permissions/revoke/", {"user_email": target.email}, format="json")
    assert response.status_code == 404
