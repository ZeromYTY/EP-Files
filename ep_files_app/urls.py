from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from ep_files_app.api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('ep_files_app.urls')),
    path('download/<int:file_id>/', views.download_file, name='file_download'),

    path('login/',  views.login_view,  name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('folders/',                            views.folder_tree,   name='folder_tree'),
    path('folders/create/',                     views.folder_create, name='folder_create'),
    path('folders/<int:folder_id>/rename/',     views.folder_rename, name='folder_rename'),
    path('folders/<int:folder_id>/move/',       views.folder_move,   name='folder_move'),
    path('folders/<int:folder_id>/delete/',     views.folder_delete, name='folder_delete'),

    path('files/',                          views.file_list,   name='file_list'),
    path('files/upload/',                   views.file_upload, name='file_upload'),
    path('files/<int:file_id>/move/',       views.file_move,   name='file_move'),
    path('files/<int:file_id>/delete/',     views.file_delete, name='file_delete'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)