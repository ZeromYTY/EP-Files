from django.contrib import admin
from django.urls import path
from ep_files_app.api.views import *

from django.conf import settings
from django.conf.urls.static import static

from ep_files_app import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('download/<int:file_id>/', views.download_file, name='file_download'),
    path('upload/', views.upload_file, name='file_upload'),
    path('preview/<int:file_id>/', views.file_preview, name='file_preview'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
