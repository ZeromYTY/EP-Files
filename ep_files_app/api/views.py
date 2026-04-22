import os

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.http import FileResponse, Http404, HttpResponse
from ep_files_app.models.models import File, PreviewFactory, TextPreview, ImagePreview
from main import settings


# Create your views here.

@login_required
def upload_file(request):
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "No such file"}, status=400)
        if uploaded_file.size > settings.MAX_FILE_SIZE:
            return JsonResponse({'error': 'Файл слишком большой!'}, status=400)
        else:
            file = File(file=uploaded_file, owner=request.user)

            file.save()
            return JsonResponse({
                'message': 'Файл успешно загружен!',
                'file_id': file.id
            }, status=201)

def download_file(request, file_id):
    try:
        file_rec = File.objects.get(id=file_id)
    except File.DoesNotExist:
        raise Http404

    response = FileResponse(file_rec.file.open('rb'))
    
    filename = os.path.basename(file_rec.file.name)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    return response


def file_preview(request, file_id):
    """
    Отображает превью файла по его идентификатору.

    Функция получает файл из базы данных, определяет стратегию генерации
    превью в зависимости от расширения и возвращает HTTP-ответ с контентом.

    Args:
        request: Объект HTTP-запроса.
        file_id (int): Идентификатор файла в базе данных.

    Returns:
        HttpResponse: Ответ с содержимым превью (изображение или текст).

    Raises:
        Http404: Если файл с указанным ID не найден.
    """
    file = get_object_or_404(File, id=file_id)
    with file.file.open('rb') as f:
        data = f.read()

    strategy = PreviewFactory.get_strategy(file.name)
    preview = strategy.preview(data)

    if isinstance(strategy, ImagePreview):
        if not preview:
            return HttpResponse("Ошибка обработки изображения", status=500)
        return HttpResponse(preview, content_type="image/jpeg")

    if isinstance(preview, bytes):
        preview = preview.decode('utf-8', errors='replace')
    return HttpResponse(preview, content_type="text/plain; charset=utf-8")
