from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.generic import TemplateView
from ep_files_app.api import views
from ep_files_app.api.views import toggle_favorite


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
    path('api/folders/<int:folder_id>/download/', views.download_folder, name='download_folder'),
    path('api/favorite/<int:item_id>/', views.toggle_favorite, name='toggle_favorite'),
    path('api/favorites/all/', views.get_user_favorites, name='get_user_favorites'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Раздача фронтенда для всех остальных роутов
urlpatterns += [
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='frontend'),
]
