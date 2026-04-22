from rest_framework import serializers
from ep_files_app.models.models import User, File

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'is_staff', 'is_superuser', 'is_active', 'date_joined']

class UserRegistrationSerializer(serializers.ModelSerializer):
    name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['name', 'email', 'password']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с такой почтой уже есть.")
        return value
    
    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Пароль должен содержать минимум 6 символов.")
        return value

    def create(self, validated_data):
        name = validated_data.pop('name', '')
        password = validated_data.pop('password')
        user = User(name=name, **validated_data)
        user.set_password(password)
        user.save()
        return user


class FileSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    download_url = serializers.SerializerMethodField()
    
    class Meta:
        model = File
        fields = ['id', 'name', 'size', 'date', 'owner_email', 'download_url']
    
    def get_download_url(self, obj):
        return f'/api/download/{obj.id}/'
