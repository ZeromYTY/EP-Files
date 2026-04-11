from django.shortcuts import render, get_object_or_404
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
from ep_files_app.models.models import User, File
from ep_files_app.models import PreviewFactory, TextPreview, ImagePreview




# 1. Регистрация
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


# 2. Логин (выдача токена для кастомной модели)
class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = User.objects.filter(email=email).first()

        if user and check_password(password, user.password_hash):
            # Генерируем токены вручную
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })

        return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)


# 3. Тестовый эндпоинт для проверки защиты
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_test_view(request):
    return Response({"message": "Доступ разрешен! JWT работает."})
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
