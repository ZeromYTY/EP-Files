import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.middleware.security import RateLimitMiddleware
from ep_files_app.models.models import User


@pytest.fixture(autouse=True)
def clear_rate_limit_state():
    RateLimitMiddleware.request_counts.clear()
    yield
    RateLimitMiddleware.request_counts.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_factory():
    def create_user(email="user@example.com", password="StrongPass123", **extra_fields):
        user = User(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    return create_user


@pytest.fixture
def token_factory():
    def create_token(user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)

    return create_token
