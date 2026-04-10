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


def test_login_success_returns_tokens(api_client, user_factory):
    user_factory(email="login@example.com", password="StrongPass123")

    payload = {
        "email": "login@example.com",
        "password": "StrongPass123",
    }

    response = api_client.post(reverse("login"), payload, format="json")

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


def test_login_wrong_password_returns_401(api_client, user_factory):
    user_factory(email="login@example.com", password="StrongPass123")

    payload = {
        "email": "login@example.com",
        "password": "WrongPassword123",
    }

    response = api_client.post(reverse("login"), payload, format="json")

    assert response.status_code == 401
    assert response.data["error"] == "Неверные данные"