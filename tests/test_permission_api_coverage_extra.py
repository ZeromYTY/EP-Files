from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
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

    response = auth_client(target).get("/api/files/")
    assert response.status_code == 200
    shared_file = next(item for item in response.data if item["id"] == file_obj.id)
    assert shared_file["can_write"] is True

    response = auth_client(target).get(f"/api/files/{file_obj.id}/download/")
    assert response.status_code == 200

    response = auth_client(target).get(f"/api/files/{file_obj.id}/content/")
    assert response.status_code == 200
    assert response.data["content"] == "hello"

    response = auth_client(target).post(
        f"/api/files/{file_obj.id}/save/",
        {"content": "updated by collaborator"},
        format="json",
    )
    assert response.status_code == 200
    file_obj.refresh_from_db()
    assert file_obj.size == len(b"updated by collaborator")

    response = client.delete(
        f"/api/files/{file_obj.id}/permissions/revoke/",
        {"user_email": target.email},
        format="json",
    )
    assert response.status_code == 200
    assert not Permission.objects.filter(user=target, file=file_obj).exists()

    response = auth_client(target).get(f"/api/files/{file_obj.id}/content/")
    assert response.status_code == 403

    response = auth_client(target).post(
        f"/api/files/{file_obj.id}/save/",
        {"content": "should stay blocked"},
        format="json",
    )
    assert response.status_code == 403

    response = auth_client(target).get("/api/files/")
    assert response.status_code == 200
    assert all(item["id"] != file_obj.id for item in response.data)


@pytest.mark.django_db
def test_file_access_roles_and_direct_id_bypass_are_blocked(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("roles_owner@example.com")
    invited = make_user("roles_invited@example.com")
    stranger = make_user("roles_stranger@example.com")
    file_obj = make_file(owner, name="roles.txt", content=b"owner secret")
    Permission.objects.create(
        user=invited,
        granted_by=owner,
        file=file_obj,
        permission_type=Permission.READ,
    )

    owner_client = auth_client(owner)
    invited_client = auth_client(invited)
    stranger_client = auth_client(stranger)

    response = owner_client.get(f"/api/files/{file_obj.id}/detail/")
    assert response.status_code == 200
    assert response.data["can_write"] is True

    response = owner_client.post(
        f"/api/files/{file_obj.id}/save/",
        {"content": "owner update"},
        format="json",
    )
    assert response.status_code == 200

    response = invited_client.get(f"/api/files/{file_obj.id}/detail/")
    assert response.status_code == 200
    assert response.data["can_write"] is False

    response = invited_client.get(f"/api/files/{file_obj.id}/content/")
    assert response.status_code == 200
    assert response.data["content"] == "owner update"

    response = invited_client.get(f"/api/files/{file_obj.id}/download/")
    assert response.status_code == 200

    response = invited_client.post(
        f"/api/files/{file_obj.id}/save/",
        {"content": "invited edit"},
        format="json",
    )
    assert response.status_code == 403

    response = invited_client.patch(
        f"/api/files/{file_obj.id}/",
        {"name": "renamed-by-invited.txt"},
        format="json",
    )
    assert response.status_code == 403

    response = invited_client.patch(
        f"/api/files/{file_obj.id}/move/",
        {"folder_id": ""},
        format="json",
    )
    assert response.status_code == 403

    response = invited_client.delete(f"/api/files/{file_obj.id}/")
    assert response.status_code == 403

    blocked_requests = [
        stranger_client.get(f"/api/files/{file_obj.id}/detail/"),
        stranger_client.get(f"/api/files/{file_obj.id}/content/"),
        stranger_client.get(f"/api/files/{file_obj.id}/download/"),
        stranger_client.post(
            f"/api/files/{file_obj.id}/save/",
            {"content": "stranger edit"},
            format="json",
        ),
        stranger_client.patch(
            f"/api/files/{file_obj.id}/",
            {"name": "renamed-by-stranger.txt"},
            format="json",
        ),
        stranger_client.patch(
            f"/api/files/{file_obj.id}/move/",
            {"folder_id": ""},
            format="json",
        ),
        stranger_client.delete(f"/api/files/{file_obj.id}/"),
    ]
    assert [response.status_code for response in blocked_requests] == [403] * len(blocked_requests)

    response = stranger_client.get("/api/files/")
    assert response.status_code == 200
    assert all(item["id"] != file_obj.id for item in response.data)

    file_obj.refresh_from_db()
    assert file_obj.name == "roles.txt"
    with file_obj.file.open("rb") as stored_file:
        assert stored_file.read() == b"owner update"


@pytest.mark.django_db
def test_read_only_file_permission_can_read_but_not_edit(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("readonly_owner@example.com")
    target = make_user("readonly_target@example.com")
    file_obj = make_file(owner, name="readonly.txt", content=b"read only")
    Permission.objects.create(
        user=target,
        granted_by=owner,
        file=file_obj,
        permission_type=Permission.READ,
    )

    target_client = auth_client(target)
    response = target_client.get("/api/files/")
    assert response.status_code == 200
    shared_file = next(item for item in response.data if item["id"] == file_obj.id)
    assert shared_file["can_write"] is False

    response = target_client.get(f"/api/files/{file_obj.id}/content/")
    assert response.status_code == 200
    assert response.data["content"] == "read only"

    response = target_client.post(
        f"/api/files/{file_obj.id}/save/",
        {"content": "blocked"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_non_text_file_cannot_get_write_permission(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("photo_owner@example.com")
    target = make_user("photo_target@example.com")
    file_obj = make_file(owner, name="photo.jpg", content=b"fake image")

    response = auth_client(owner).post(
        f"/api/files/{file_obj.id}/permissions/grant/",
        {
            "user_email": target.email,
            "permission_type": Permission.READ_WRITE,
        },
        format="json",
    )

    assert response.status_code == 400
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
    child = Folder.objects.create(name="Child Folder", owner=owner, parent=folder)
    child_file = make_file(owner, name="child.txt", folder=child)
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
    assert response.data["count"] == 2

    response = auth_client(target).get("/api/folders/")
    assert response.status_code == 200
    assert {item["id"] for item in response.data["folders"]} == {folder.id, child.id}

    response = auth_client(target).get("/api/files/")
    assert response.status_code == 200
    assert any(item["id"] == child_file.id for item in response.data)

    response = client.delete(
        f"/api/folders/{folder.id}/permissions/revoke/",
        {"user_email": target.email},
        format="json",
    )
    assert response.status_code == 200
    assert not Permission.objects.filter(user=target, folder=folder).exists()


@pytest.mark.django_db
def test_user_with_folder_write_permission_can_upload_to_shared_folder(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("shared_upload_owner@example.com")
    target = make_user("shared_upload_target@example.com")
    folder = Folder.objects.create(name="Writable Folder", owner=owner)
    Permission.objects.create(
        user=target,
        granted_by=owner,
        folder=folder,
        permission_type=Permission.READ_WRITE,
        inherit=True,
    )

    response = auth_client(target).post(
        "/api/upload/",
        {"file": SimpleUploadedFile("from_target.txt", b"hello owner"), "folder_id": folder.id},
        format="multipart",
    )

    assert response.status_code == 201
    uploaded = File.objects.get(name="from_target.txt")
    assert uploaded.owner == target
    assert uploaded.folder == folder

    response = auth_client(owner).get("/api/files/")
    assert response.status_code == 200
    assert any(item["id"] == uploaded.id for item in response.data)


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


@pytest.mark.django_db
def test_public_file_metadata_for_ui(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("public_meta_owner@example.com")
    file_obj = make_file(owner, name="public.txt", content=b"public")
    client = auth_client(owner)

    response = client.post(
        f"/api/files/{file_obj.id}/public-link/",
        {"public_expires_in_minutes": 60},
        format="json",
    )
    assert response.status_code == 200
    token = response.data["public_token"]
    assert response.data["public_expires_at"]

    response = APIClient().get(f"/api/public/files/{token}/?meta=1")
    assert response.status_code == 200
    assert response.data["name"] == "public.txt"
    assert response.data["public_expires_at"]
    assert response.data["download_url"].endswith(f"/api/public/files/{token}/")

    file_obj.refresh_from_db()
    file_obj.public_expires_at = timezone.now() - timedelta(minutes=1)
    file_obj.save(update_fields=["public_expires_at"])

    response = APIClient().get(f"/api/public/files/{token}/?meta=1")
    assert response.status_code == 404


@pytest.mark.django_db
def test_public_file_link_active_disabled_and_missing_token(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("public_file_owner@example.com")
    stranger = make_user("public_file_stranger@example.com")
    file_obj = make_file(owner, name="public-link.txt", content=b"public link content")

    response = auth_client(stranger).post(f"/api/files/{file_obj.id}/public-link/", {}, format="json")
    assert response.status_code == 404

    owner_client = auth_client(owner)
    response = owner_client.post(f"/api/files/{file_obj.id}/public-link/", {}, format="json")
    assert response.status_code == 200
    token = response.data["public_token"]

    anonymous_client = APIClient()
    response = anonymous_client.get(f"/api/public/files/{token}/?meta=1")
    assert response.status_code == 200
    assert response.data["name"] == "public-link.txt"

    response = anonymous_client.get(f"/api/public/files/{token}/")
    assert response.status_code == 200

    response = anonymous_client.get("/api/public/files/not-a-real-token/")
    assert response.status_code == 404

    response = auth_client(stranger).delete(f"/api/files/{file_obj.id}/public-link/disable/")
    assert response.status_code == 404

    response = owner_client.delete(f"/api/files/{file_obj.id}/public-link/disable/")
    assert response.status_code == 200

    response = anonymous_client.get(f"/api/public/files/{token}/?meta=1")
    assert response.status_code == 404

    file_obj.refresh_from_db()
    assert file_obj.is_public is False
    assert file_obj.public_token is None


@pytest.mark.django_db
def test_public_folder_link_blocks_file_id_bypass(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    owner = make_user("public_folder_owner@example.com")
    stranger = make_user("public_folder_stranger@example.com")
    shared_folder = Folder.objects.create(name="Shared Public", owner=owner)
    private_folder = Folder.objects.create(name="Private Sibling", owner=owner)
    shared_file = make_file(owner, name="shared.txt", content=b"shared", folder=shared_folder)
    private_file = make_file(owner, name="private.txt", content=b"private", folder=private_folder)

    response = auth_client(stranger).post(f"/api/folders/{shared_folder.id}/public-link/", {}, format="json")
    assert response.status_code == 404

    owner_client = auth_client(owner)
    response = owner_client.post(f"/api/folders/{shared_folder.id}/public-link/", {}, format="json")
    assert response.status_code == 200
    token = response.data["public_token"]

    anonymous_client = APIClient()
    response = anonymous_client.get(f"/api/public/folders/{token}/")
    assert response.status_code == 200
    assert {item["id"] for item in response.data["files"]} == {shared_file.id}

    response = anonymous_client.get(f"/api/public/folders/{token}/files/{shared_file.id}/")
    assert response.status_code == 200

    response = anonymous_client.get(f"/api/public/folders/{token}/files/{private_file.id}/")
    assert response.status_code == 404

    response = anonymous_client.get("/api/public/folders/not-a-real-token/")
    assert response.status_code == 404

    response = owner_client.delete(f"/api/folders/{shared_folder.id}/public-link/disable/")
    assert response.status_code == 200

    response = anonymous_client.get(f"/api/public/folders/{token}/")
    assert response.status_code == 404
