from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from ep_files_app.api import views

def home_view(request):
    """Главная страница API"""
    return JsonResponse({
        'message': 'EP-Files API',
        'version': '1.0',
        'endpoints': {
            'admin': '/admin/',
            'api': '/api/',
            'auth': {
                'register': '/api/auth/register/',
                'login': '/api/auth/login/',
                'me': '/api/auth/me/',
            },
            'files': {
                'upload': '/api/upload/',
                'list': '/api/files/',
                'download': '/api/files/<id>/download/',
            },
            'frontend': 'http://localhost:5173'
        }
    })

urlpatterns = [
    path('', home_view, name='home'),
    path('admin/', admin.site.urls),
    path('api/', include('ep_files_app.urls')),
    path('api/upload/', views.upload_file, name='file_upload'),
    path('api/download/<int:file_id>/', views.download_file, name='file_download'),
    path('api/preview/<int:file_id>/', views.file_preview, name='file_preview'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
