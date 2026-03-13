from django.http import JsonResponse
from django.shortcuts import render
from django.http import FileResponse, Http404
from ep_files_app.models import File
from main import settings


# Create your views here.


def upload_file(request):
    if request.method == "POST":
        uploaded_file = request.FILES.get["file"]
        if not uploaded_file:
            return JsonResponse({"error": "No such file"}, status=400)
        if uploaded_file.size > settings.MAX_FILE_SIZE:
            return JsonResponse({'error': 'Файл слишком большой!'}, status=400)
        else:
            file = File(file=uploaded_file,
                        original_filename=uploaded_file.name,
                        size=uploaded_file.size
                        # owner = request.user
                        )
            file.save()
            return JsonResponse({
                'message': 'Файл успешно загружен!',
                'id': file.id
            }, status=201)

def download_file(request, id):
    try:
        file_rec = File.objects.get(id=id)
    except File.DoesNotExist:
        raise Http404

    file_file = open(file_rec.file.path, 'rb')

    response = FileResponse(file_file)

    response['Content-Disposition'] = f'attachment; filename="{file_rec.original_name}"'

    return response