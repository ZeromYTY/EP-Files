from django.urls import path
from .api.views import RegisterView, LoginView, protected_test_view

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('test-auth/', protected_test_view, name='test_auth'),
]