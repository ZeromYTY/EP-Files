"""Custom access permissions for files and admin operations."""
from rest_framework import permissions
from ep_files_app.services.permission_service import permission_service


class IsFileOwner(permissions.BasePermission):
    """Класс ограничения доступа для проверки владельца файла.

    Разрешает выполнение операций с объектом только в том случае, если
    авторизованный пользователь является создателем (владельцем) этого файла.
    Используется в механизме авторизации Django REST Framework (DRF).

    Methods:
        has_object_permission(request, view, obj): Проверяет права доступа
            к конкретному экземпляру объекта (файла).
    """

    def has_object_permission(self, request, view, obj):
        """Проверяет, является ли текущий пользователь владельцем объекта.

        Сравнивает объект пользователя из входящего запроса с атрибутом
        владельца у проверяемого объекта.

        Args:
            request (Request): Объект входящего запроса Django REST Framework,
                содержащий данные о пользователе в ``request.user``.
            view (APIView): Экземпляр текущего представления (View),
                обрабатывающего запрос.
            obj (Model): Экземпляр модели (файла), для которого проверяются
                права доступа.

        Returns:
            bool: True, если пользователь является владельцем объекта,
            иначе False.

        Examples:
            >>> class MockUser: pass
            >>> class MockRequest: user = MockUser()
            >>> class MockObject: owner = MockRequest.user
            >>> permission = IsFileOwner()
            >>> permission.has_object_permission(MockRequest(), None, MockObject())
            True
        """
        return obj.owner == request.user


class IsFileOwnerOrReadOnly(permissions.BasePermission):
    """Класс ограничения доступа, разрешающий редактирование только владельцу.

    Обеспечивает доступ на чтение для всех пользователей (включая неавторизованных)
    через безопасные HTTP-методы. Изменение или удаление объекта разрешено
    только пользователю, который является его владельцем. Используется в Django REST Framework.

    Methods:
        has_object_permission(request, view, obj): Проверяет права доступа
            к конкретному экземпляру объекта в зависимости от HTTP-метода.
    """

    def has_object_permission(self, request, view, obj):
        """Проверяет права доступа к объекту на основе HTTP-метода и авторства.

        Если метод запроса безопасный (GET, HEAD, OPTIONS), доступ предоставляется автоматически.
        Для деструктивных методов (POST, PUT, PATCH, DELETE) выполняется проверка владельца.

        Args:
            request (Request): Объект входящего запроса Django REST Framework,
                содержащий HTTP-метод в ``request.method`` и пользователя в ``request.user``.
            view (APIView): Экземпляр представления, обрабатывающего запрос.
            obj (Model): Экземпляр проверяемой модели, содержащий атрибут ``owner``.

        Returns:
            bool: True, если метод безопасен или пользователь является владельцем объекта,
            иначе False.

        Examples:
            >>> class MockRequest: method = 'GET'; user = 'any_user'
            >>> class MockObject: owner = 'owner_user'
            >>> perm = IsFileOwnerOrReadOnly()
            >>> perm.has_object_permission(MockRequest(), None, MockObject())
            True

            >>> class WriteRequest: method = 'DELETE'; user = 'intruder'
            >>> perm.has_object_permission(WriteRequest(), None, MockObject())
            False
        """
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user


class CanUploadFiles(permissions.BasePermission):
    """Класс ограничения доступа для проверки прав на загрузку файлов.

    Определяет глобальные права доступа на уровне всего запроса (до проверки прав
    на уровне конкретных объектов). Разрешает выполнение действий только тем
    пользователям, которые успешно прошли аутентификацию и имеют активный статус.

    Methods:
        has_permission(request, view): Проверяет общие права пользователя
            на доступ к эндпоинту.
    """

    def has_permission(self, request, view):
        """Проверяет, является ли пользователь аутентифицированным и активным.

        Анализирует объект пользователя в запросе. Если пользователь отсутствует,
        не авторизован или его аккаунт деактивирован, доступ блокируется.

        Args:
            request (Request): Объект входящего запроса Django REST Framework,
                содержащий данные пользователя в ``request.user``.
            view (APIView): Экземпляр представления, к которому выполняется запрос.

        Returns:
            bool: True, если пользователь успешно авторизован и активен,
            иначе False.

        Examples:
            >>> class ActiveUser: is_authenticated = True; is_active = True
            >>> class MockRequest: user = ActiveUser()
            >>> perm = CanUploadFiles()
            >>> perm.has_permission(MockRequest(), None)
            True

            >>> class GuestUser: is_authenticated = False
            >>> class GuestRequest: user = GuestUser()
            >>> perm.has_permission(GuestRequest(), None)
            False
        """
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(request.user, "is_active") and not request.user.is_active:
            return False
        return True


class IsAdminUser(permissions.BasePermission):
    """Класс ограничения доступа для проверки административных прав пользователя.

    Разрешает глобальный доступ к эндпоинту только тем пользователям, которые
    обладают статусом персонала (is_staff) или правами суперпользователя (is_superuser).
    Используется для защиты административных панелей и служебных методов API.

    Methods:
        has_permission(request, view): Проверяет наличие административных прав
            у текущего пользователя.
    """

    def has_permission(self, request, view):
        """Проверяет, является ли пользователь аутентифицированным администратором.

        Убеждается, что пользователь прошел аутентификацию, после чего проверяет
        флаги ``is_staff`` или ``is_superuser``.

        Args:
            request (Request): Объект входящего запроса Django REST Framework,
                содержащий данные пользователя в ``request.user``.
            view (APIView): Экземпляр представления, к которому выполняется запрос.

        Returns:
            bool: True, если пользователь авторизован и является сотрудником
            или суперпользователем, иначе False.

        Examples:
            >>> class AdminUser: is_authenticated = True; is_staff = True; is_superuser = False
            >>> class MockRequest: user = AdminUser()
            >>> perm = IsAdminUser()
            >>> perm.has_permission(MockRequest(), None)
            True

            >>> class CommonUser: is_authenticated = True; is_staff = False; is_superuser = False
            >>> class UserRequest: user = CommonUser()
            >>> perm.has_permission(UserRequest(), None)
            False
        """
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.is_staff or request.user.is_superuser)


class HasFileReadPermission(permissions.BasePermission):
    """Класс ограничения доступа для проверки прав на чтение файла.

    Делегирует логику проверки специализированному сервису прав доступа.
    Разрешает просмотр или скачивание файла, если пользователь является
    его владельцем или имеет явное разрешение на чтение.

    Methods:
        has_object_permission(request, view, obj): Проверяет права доступа
            к конкретному файлу через сервис авторизации.
    """

    def has_object_permission(self, request, view, obj):
        """Проверяет возможность чтения конкретного объекта файла пользователем.

                Перенаправляет запрос в ``permission_service.can_read_file`` для выполнения
                комплексной проверки прав (учитывая владение, общие ссылки или группы доступа).

                Args:
                    request (Request): Объект входящего запроса Django REST Framework,
                        содержащий данные пользователя в ``request.user``.
                    view (APIView): Экземпляр представления, обрабатывающего запрос.
                    obj (Model): Экземпляр модели файла, к которому запрашивается доступ.

                Returns:
                    bool: True, если сервис подтвердил права на чтение, иначе False.

                Examples:
                    >>> class MockUser: pass
                    >>> class MockFile: pass
                    >>> class MockRequest: user = MockUser()
                    >>> perm = HasFileReadPermission()
                    >>> # Предполагается, что permission_service вернет True для этих объектов
                    >>> perm.has_object_permission(MockRequest(), None, MockFile())
                    True
                """
        return permission_service.can_read_file(request.user, obj)


class HasFileWritePermission(permissions.BasePermission):
    """
    Проверяет права на запись файла (владелец или есть права доступа)
    """

    def has_object_permission(self, request, view, obj):
        return permission_service.can_write_file(request.user, obj)


class HasFolderReadPermission(permissions.BasePermission):
    """Класс ограничения доступа для проверки прав на изменение файла.

    Делегирует логику проверки специализированному сервису прав доступа.
    Разрешает модификацию, перезапись или удаление файла, если пользователь
    является его владельцем или имеет явное разрешение на запись.

    Methods:
        has_object_permission(request, view, obj): Проверяет права доступа
            к конкретному файлу на изменение через сервис авторизации.
    """

    def has_object_permission(self, request, view, obj):
        """Проверяет возможность записи в конкретный объект файла пользователем.

                Перенаправляет запрос в ``permission_service.can_write_file`` для выполнения
                проверки прав на редактирование или удаление данного файла.

                Args:
                    request (Request): Объект входящего запроса Django REST Framework,
                        содержащий данные пользователя в ``request.user``.
                    view (APIView): Экземпляр представления, обрабатывающего запрос.
                    obj (Model): Экземпляр модели файла, для которого проверяются права.

                Returns:
                    bool: True, если сервис подтвердил права на запись, иначе False.

                Examples:
                    >>> class MockUser: pass
                    >>> class MockFile: pass
                    >>> class MockRequest: user = MockUser()
                    >>> perm = HasFileWritePermission()
                    >>> # Предполагается, что permission_service вернет True для этих объектов
                    >>> perm.has_object_permission(MockRequest(), None, MockFile())
                    True
                """
        return permission_service.can_read_folder(request.user, obj)


class HasFolderWritePermission(permissions.BasePermission):
    """Класс ограничения доступа для проверки прав на изменение папки.

    Делегирует логику проверки специализированному сервису прав доступа.
    Разрешает модификацию, переименование, удаление или создание подэлементов
    в папке, если пользователь является её владельцем или имеет явное разрешение на запись.

    Methods:
        has_object_permission(request, view, obj): Проверяет права доступа
            к конкретной папке на изменение через сервис авторизации.
    """

    def has_object_permission(self, request, view, obj):
        """Проверяет возможность записи в конкретный объект папки пользователем.

                Перенаправляет запрос в ``permission_service.can_write_folder`` для выполнения
                проверки прав на редактирование, управление или удаление данной папки.

                Args:
                    request (Request): Объект входящего запроса Django REST Framework,
                        содержащий данные пользователя в ``request.user``.
                    view (APIView): Экземпляр представления, обрабатывающего запрос.
                    obj (Model): Экземпляр модели папки, для которой проверяются права.

                Returns:
                    bool: True, если сервис подтвердил права на запись, иначе False.

                Examples:
                    >>> class MockUser: pass
                    >>> class MockFolder: pass
                    >>> class MockRequest: user = MockUser()
                    >>> perm = HasFolderWritePermission()
                    >>> # Предполагается, что permission_service вернет True для этих объектов
                    >>> perm.has_object_permission(MockRequest(), None, MockFolder())
                    True
                """
        return permission_service.can_write_folder(request.user, obj)
