"""
Тесты для системы разграничения прав доступа
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from ep_files_app.models import User, File, Folder, Permission
from ep_files_app.services.permission_service import permission_service


class PermissionServiceTestCase(TestCase):
    """Тесты для PermissionService"""
    
    def setUp(self):
        """Создание тестовых данных"""
        # Создаем пользователей
        self.owner = User.objects.create(
            email='owner@test.com',
            name='Owner User'
        )
        self.owner.set_password('password123')
        self.owner.save()
        
        self.user1 = User.objects.create(
            email='user1@test.com',
            name='User One'
        )
        self.user1.set_password('password123')
        self.user1.save()
        
        self.user2 = User.objects.create(
            email='user2@test.com',
            name='User Two'
        )
        self.user2.set_password('password123')
        self.user2.save()
        
        # Создаем папку
        self.folder = Folder.objects.create(
            name='Test Folder',
            owner=self.owner
        )
        
        # Создаем файл
        self.file = File(
            name='test.txt',
            owner=self.owner,
            folder=self.folder,
            size=100
        )
        self.file.save()
    
    def test_owner_has_full_access(self):
        """Владелец имеет полный доступ к своим ресурсам"""
        self.assertTrue(permission_service.can_read_file(self.owner, self.file))
        self.assertTrue(permission_service.can_write_file(self.owner, self.file))
        self.assertTrue(permission_service.can_read_folder(self.owner, self.folder))
        self.assertTrue(permission_service.can_write_folder(self.owner, self.folder))
    
    def test_no_access_without_permission(self):
        """Пользователь без прав не имеет доступа"""
        self.assertFalse(permission_service.can_read_file(self.user1, self.file))
        self.assertFalse(permission_service.can_write_file(self.user1, self.file))
        self.assertFalse(permission_service.can_read_folder(self.user1, self.folder))
        self.assertFalse(permission_service.can_write_folder(self.user1, self.folder))
    
    def test_grant_read_permission(self):
        """Выдача прав на чтение"""
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            file=self.file,
            permission_type=Permission.READ
        )
        
        self.assertTrue(permission_service.can_read_file(self.user1, self.file))
        self.assertFalse(permission_service.can_write_file(self.user1, self.file))
    
    def test_grant_write_permission(self):
        """Выдача прав на запись"""
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            file=self.file,
            permission_type=Permission.READ_WRITE
        )
        
        self.assertTrue(permission_service.can_read_file(self.user1, self.file))
        self.assertTrue(permission_service.can_write_file(self.user1, self.file))
    
    def test_revoke_permission(self):
        """Отзыв прав доступа"""
        # Выдаем права
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            file=self.file,
            permission_type=Permission.READ
        )
        
        self.assertTrue(permission_service.can_read_file(self.user1, self.file))
        
        # Отзываем права
        permission_service.revoke_permission(user=self.user1, file=self.file)
        
        self.assertFalse(permission_service.can_read_file(self.user1, self.file))
    
    def test_inherited_permissions(self):
        """Наследование прав от родительской папки"""
        # Выдаем права на папку с наследованием
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            folder=self.folder,
            permission_type=Permission.READ_WRITE,
            inherit=True
        )
        
        # Проверяем, что права наследуются на файл
        self.assertTrue(permission_service.can_read_file(self.user1, self.file))
        self.assertTrue(permission_service.can_write_file(self.user1, self.file))
    
    def test_no_inheritance_without_flag(self):
        """Права не наследуются без флага inherit"""
        # Выдаем права на папку БЕЗ наследования
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            folder=self.folder,
            permission_type=Permission.READ_WRITE,
            inherit=False
        )
        
        # Проверяем, что права НЕ наследуются на файл
        self.assertFalse(permission_service.can_read_file(self.user1, self.file))
        self.assertFalse(permission_service.can_write_file(self.user1, self.file))
    
    def test_get_user_permissions(self):
        """Получение всех прав пользователя"""
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            file=self.file,
            permission_type=Permission.READ
        )
        
        permissions = permission_service.get_user_permissions(self.user1)
        self.assertEqual(len(permissions), 1)
        self.assertEqual(permissions[0].file, self.file)
    
    def test_get_accessible_files(self):
        """Получение доступных файлов"""
        # Создаем еще один файл
        file2 = File(
            name='test2.txt',
            owner=self.owner,
            size=100
        )
        file2.save()
        
        # Выдаем права на первый файл
        permission_service.grant_permission(
            granted_by=self.owner,
            user=self.user1,
            file=self.file,
            permission_type=Permission.READ
        )
        
        accessible_files = permission_service.get_accessible_files(self.user1)
        self.assertEqual(len(accessible_files), 1)
        self.assertIn(self.file, accessible_files)
        self.assertNotIn(file2, accessible_files)


class PermissionModelTestCase(TestCase):
    """Тесты для модели Permission"""
    
    def setUp(self):
        """Создание тестовых данных"""
        self.owner = User.objects.create(
            email='owner@test.com',
            name='Owner User'
        )
        self.owner.set_password('password123')
        self.owner.save()
        
        self.user = User.objects.create(
            email='user@test.com',
            name='Test User'
        )
        self.user.set_password('password123')
        self.user.save()
        
        self.file = File(
            name='test.txt',
            owner=self.owner,
            size=100
        )
        self.file.save()
    
    def test_cannot_grant_to_self(self):
        """Нельзя выдать права самому себе"""
        with self.assertRaises(ValidationError):
            permission = Permission(
                user=self.owner,
                granted_by=self.owner,
                file=self.file,
                permission_type=Permission.READ
            )
            permission.full_clean()
    
    def test_permission_type_choices(self):
        """Проверка допустимых типов прав"""
        permission = Permission(
            user=self.user,
            granted_by=self.owner,
            file=self.file,
            permission_type=Permission.READ
        )
        permission.full_clean()  # Должно пройти
        
        permission.permission_type = Permission.READ_WRITE
        permission.full_clean()  # Должно пройти
        
        permission.permission_type = 'invalid'
        with self.assertRaises(ValidationError):
            permission.full_clean()
    
    def test_unique_constraint(self):
        """Проверка уникальности прав"""
        Permission.objects.create(
            user=self.user,
            granted_by=self.owner,
            file=self.file,
            permission_type=Permission.READ
        )
        
        # Попытка создать дубликат
        with self.assertRaises(Exception):
            Permission.objects.create(
                user=self.user,
                granted_by=self.owner,
                file=self.file,
                permission_type=Permission.READ_WRITE
            )


print("✅ Тесты системы прав доступа готовы к запуску")
