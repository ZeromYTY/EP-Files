import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import File

def file_list(request):
    files = File.objects.all()
    return render(request, 'file_list.html', {'files': files})

@require_http_methods(["GET"])
def get_file_content(request, file_id):
    file_obj = get_object_or_404(File, id=file_id)
    try:
        with open(file_obj.file.path, 'r', encoding='utf-8') as f:
            content = f.read()
        return JsonResponse({'content': content, 'name': file_obj.name})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def save_file_content(request, file_id):
    file_obj = get_object_or_404(File, id=file_id)
    try:
        data = json.loads(request.body)
        new_content = data.get('content', '')
        with open(file_obj.file.path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
