import pytest
from django.contrib.auth.hashers import check_password
from django.urls import reverse

from ep_files_app.models.models import User

pytestmark = pytest.mark.django_db


def test_register_success(api_client):
    payload = {
        "email": "newuser@example.com",
        "password": "StrongPass123",
    }

    response = api_client.post(reverse("register"), payload, format="json")

    assert response.status_code == 201
    assert User.objects.filter(email="newuser@example.com").exists()

    user = User.objects.get(email="newuser@example.com")
    assert user.password_hash != payload["password"]
    assert check_password(payload["password"], user.password_hash)


def test_register_duplicate_email_returns_400(api_client, user_factory):
    user_factory(email="duplicate@example.com", password="StrongPass123")

    payload = {
        "email": "duplicate@example.com",
        "password": "AnotherPass123",
    }

    response = api_client.post(reverse("register"), payload, format="json")

    assert response.status_code == 400
    assert User.objects.filter(email="duplicate@example.com").count() == 1


def test_register_normalizes_email_for_login(api_client):
    register_response = api_client.post(
        reverse("register"),
        {
            "email": "  NewUser@Example.COM  ",
            "password": "StrongPass123",
        },
        format="json",
    )

    assert register_response.status_code == 201
    assert User.objects.filter(email="newuser@example.com").exists()

    login_response = api_client.post(
        reverse("login"),
        {
            "email": "newuser@example.com",
            "password": "StrongPass123",
        },
        format="json",
    )

    assert login_response.status_code == 200
    assert "token" in login_response.data


def test_register_duplicate_email_is_case_insensitive(api_client, user_factory):
    user_factory(email="duplicate@example.com", password="StrongPass123")

    response = api_client.post(
        reverse("register"),
        {
            "email": "Duplicate@Example.com",
            "password": "AnotherPass123",
        },
        format="json",
    )

    assert response.status_code == 400
    assert User.objects.filter(email="duplicate@example.com").count() == 1


def test_login_success_returns_tokens(api_client, user_factory):
    user_factory(email="login@example.com", password="StrongPass123")

    payload = {
        "email": "login@example.com",
        "password": "StrongPass123",
    }

    response = api_client.post(reverse("login"), payload, format="json")

    assert response.status_code == 200
    assert "token" in response.data
    assert "refresh" in response.data


def test_login_accepts_email_case_and_outer_spaces(api_client, user_factory):
    user_factory(email="login@example.com", password="StrongPass123")

    response = api_client.post(
        reverse("login"),
        {
            "email": "  Login@Example.COM  ",
            "password": "StrongPass123",
        },
        format="json",
    )

    assert response.status_code == 200
    assert "token" in response.data


def test_login_wrong_password_returns_401(api_client, user_factory):
    user_factory(email="login@example.com", password="StrongPass123")

    payload = {
        "email": "login@example.com",
        "password": "WrongPassword123",
    }

    response = api_client.post(reverse("login"), payload, format="json")

    assert response.status_code == 401
    assert response.data["error"] == "Invalid credentials"


def test_change_password_success(api_client, user_factory, token_factory):
    user = user_factory(email="change_password@example.com", password="OldPass123")
    access_token = token_factory(user)

    response = api_client.post(
        reverse("change_password"),
        {
            "current_password": "OldPass123",
            "new_password": "NewPass123",
            "confirm_password": "NewPass123",
        },
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert check_password("NewPass123", user.password_hash)
    assert not check_password("OldPass123", user.password_hash)

    login_response = api_client.post(
        reverse("login"),
        {"email": "change_password@example.com", "password": "NewPass123"},
        format="json",
    )
    assert login_response.status_code == 200


def test_change_password_validates_current_password(api_client, user_factory, token_factory):
    user = user_factory(email="change_password_invalid@example.com", password="OldPass123")
    access_token = token_factory(user)

    response = api_client.post(
        reverse("change_password"),
        {
            "current_password": "WrongPass123",
            "new_password": "NewPass123",
            "confirm_password": "NewPass123",
        },
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 400
    user.refresh_from_db()
    assert check_password("OldPass123", user.password_hash)


def test_change_password_requires_matching_confirmation(api_client, user_factory, token_factory):
    user = user_factory(email="change_password_mismatch@example.com", password="OldPass123")
    access_token = token_factory(user)

    response = api_client.post(
        reverse("change_password"),
        {
            "current_password": "OldPass123",
            "new_password": "NewPass123",
            "confirm_password": "OtherPass123",
        },
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 400
    assert "confirm_password" in response.data


def test_login_blocked_user_returns_403(api_client, user_factory):
    user_factory(
        email="blocked_login@example.com",
        password="StrongPass123",
        is_active=False,
    )

    response = api_client.post(
        reverse("login"),
        {"email": "blocked_login@example.com", "password": "StrongPass123"},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["code"] == "user_blocked"


def test_protected_endpoint_without_token_returns_401(api_client):
    response = api_client.get(reverse("test_auth"))

    assert response.status_code == 401


def test_protected_endpoint_with_invalid_token_returns_401(api_client):
    response = api_client.get(
        reverse("test_auth"),
        HTTP_AUTHORIZATION="Bearer definitely.invalid.token",
    )

    assert response.status_code == 401


def test_protected_endpoint_with_valid_token_returns_200(
    api_client,
    user_factory,
    token_factory,
):
    user = user_factory(email="secured@example.com", password="StrongPass123")
    access_token = token_factory(user)

    response = api_client.get(
        reverse("test_auth"),
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 200
    assert response.data["message"] == "Access granted. JWT is working."


def test_blocked_user_token_returns_401(
    api_client,
    user_factory,
    token_factory,
):
    user = user_factory(
        email="blocked_token@example.com",
        password="StrongPass123",
        is_active=False,
    )
    access_token = token_factory(user)

    response = api_client.get(
        reverse("test_auth"),
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 401
    assert response.data["code"] == "user_blocked"
