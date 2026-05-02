from django.urls import path
from .api.views import (
    RegisterView, LoginView, MeView, protected_test_view, 
    upload_file, list_files, delete_file, user_storage_stats,
    search_files, file_detail
)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('test-auth/', protected_test_view, name='test_auth'),
    
    # Файлы
    path('upload/', upload_file, name='file_upload'),
    path('files/', list_files, name='list_files'),
    path('files/<int:file_id>/', delete_file, name='delete_file'),
    path('files/<int:file_id>/detail/', file_detail, name='file_detail'),
    
    # Статистика и поиск
    path('storage/stats/', user_storage_stats, name='storage_stats'),
    path('search/', search_files, name='search_files'),
]