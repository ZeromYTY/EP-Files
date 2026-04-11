from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

from ep_files_app.api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('ep_files_app.urls')),
    path('api/download/<int:file_id>/', views.download_file, name='file_download'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
