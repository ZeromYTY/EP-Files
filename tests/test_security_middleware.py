import time

import pytest
from django.test import RequestFactory

from ep_files_app.middleware.security import RateLimitMiddleware

pytestmark = pytest.mark.django_db


def limited_request(token):
    return RequestFactory().get(
        "/api/test/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        REMOTE_ADDR="127.0.0.1",
    )


def test_rate_limit_blocks_regular_user_after_limit(user_factory, token_factory):
    user = user_factory(email="limited_user@example.com", password="StrongPass123")
    token = token_factory(user)
    middleware = RateLimitMiddleware(lambda request: None)

    RateLimitMiddleware.request_counts["127.0.0.1"] = (101, time.time())

    response = middleware.process_request(limited_request(token))

    assert response.status_code == 429


def test_rate_limit_allows_staff_user_after_limit(user_factory, token_factory):
    user = user_factory(
        email="staff_user@example.com",
        password="StrongPass123",
        is_staff=True,
    )
    token = token_factory(user)
    middleware = RateLimitMiddleware(lambda request: None)

    RateLimitMiddleware.request_counts["127.0.0.1"] = (101, time.time())

    response = middleware.process_request(limited_request(token))

    assert response is None
    assert RateLimitMiddleware.request_counts["127.0.0.1"][0] == 102
