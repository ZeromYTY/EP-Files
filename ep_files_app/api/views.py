from django.contrib.auth.hashers import check_password
from django.http import FileResponse, Http404, JsonResponse
from django.contrib.auth.decorators import login_required
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ep_files_app.models.models import File, User
from .serializers import UserRegistrationSerializer
from main import settings

import os


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = User.objects.filter(email=email).first()

        if user and check_password(password, user.password_hash):
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })

        return Response(
            {'error': 'Неверные данные'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


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

        file_obj = File(file=uploaded_file, owner=request.user)
        file_obj.save()

        return JsonResponse({
            'message': 'Файл успешно загружен!',
            'file_id': file_obj.id,
        }, status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


def download_file(request, file_id):
    try:
        file_rec = File.objects.get(id=file_id)
    except File.DoesNotExist as exc:
        raise Http404 from exc

    response = FileResponse(file_rec.file.open('rb'))
    filename = os.path.basename(file_rec.file.name)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response