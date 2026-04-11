from django.urls import path
from .api.views import RegisterView, LoginView, protected_test_view, upload_file

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('test-auth/', protected_test_view, name='test_auth'),
    path('upload/', upload_file, name='file_upload'),
]