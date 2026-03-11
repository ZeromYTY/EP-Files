from django.urls import path
from . import views

urlpatterns = [
    path('', views.file_list, name='file_list'),
    path('api/files/<int:file_id>/content/', views.get_file_content, name='file_content'),
    path('api/files/<int:file_id>/save/', views.save_file_content, name='file_save'),
]