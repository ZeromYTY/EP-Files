from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth import get_user_model
from ep_files_app.models.models import File, FileOperationFacade, User
from django.contrib.auth.hashers import check_password

User = get_user_model()

class FileFacadeTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            email="test@gmail.com",
            password_hash="test1234"
        )
        self.file_obj = SimpleUploadedFile(
            "test_file.txt", b"hello world", content_type="text/plain"
        )

    def test_upload_file_success(self):
        """Проверка успешной загрузки через фасад"""
        file_obj = FileOperationFacade.upload_file(self.file_obj, self.user)
        self.assertIsInstance(file_obj, File)
        self.assertEqual(file_obj.owner, self.user)
        self.assertEqual(file_obj.name, "test_file.txt")
        self.assertTrue(File.objects.filter(id=file_obj.id).exists())

    def test_upload_file_too_large(self):
        """Проверка ограничения по размеру"""
        large_file = SimpleUploadedFile("big.txt", b"too big content")
        large_file.size = settings.MAX_FILE_SIZE + 1
        with self.assertRaises(ValidationError) as cm:
            FileOperationFacade.upload_file(large_file, self.user)

    def test_delete_file_success(self):
        """Проверка удаления файла через фасад"""
        file_obj = FileOperationFacade.upload_file(self.file_obj, self.user)
        result = FileOperationFacade.delete_file(file_obj.id, self.user)
        self.assertTrue(result)
        self.assertFalse(File.objects.filter(id=file_obj.id).exists())

    def test_delete_file_not_found_or_wrong_owner(self):
        """Проверка, что чужой или несуществующий файл не удалится"""
        another_user = User.objects.create(email='other@test.com', password_hash='123')
        file_obj = FileOperationFacade.upload_file(self.file_obj, another_user)
        result = FileOperationFacade.delete_file(file_obj.id, self.user)
        self.assertFalse(result)
        self.assertTrue(File.objects.filter(id=file_obj.id).exists())

class FileTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create(email="owner@mail.com")

    def test_file_auto_fill(self):
        content = b"hello world"
        fake_file = SimpleUploadedFile("my_document.txt", content)
        file_record = File.objects.create(
            file=fake_file,
            owner=self.user
        )
        self.assertEqual(file_record.name, "my_document.txt")
        self.assertEqual(file_record.size, len(content))
        self.assertEqual(str(file_record), "my_document.txt")

    def test_file_str(self):
        file_record = File(name="")
        self.assertEqual(str(file_record), "Unnamed File")

