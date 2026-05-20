from django.contrib import admin
from .models.models import File
from .models.file_history import FileHistory
from .models.permissions import Permission


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    """Класс настройки административной панели для управления файлами.

    Определяет отображение списка файлов в панели администратора Django,
    скрывает автоматические системные поля из формы редактирования
    и инкапсулирует логику назначения владельца при создании записи.

    Attributes:
        list_display (tuple): Список полей модели, отображаемых в таблице
            административной панели.
        exclude (tuple): Список полей, исключенных из формы создания
            и редактирования объекта.

    Methods:
        save_model(request, obj, form, change): Переопределяет стандартный
            процесс сохранения модели для подстановки текущего пользователя.
    """
    list_display = ('id', 'name', 'size', 'owner')
    exclude = ('owner', 'name', 'size')

    def save_model(self, request, obj, form, change):
        """Сохраняет экземпляр модели файла, автоматически назначая владельца.

                Если объект создается впервые (отсутствует первичный ключ ``pk``),
                в поле ``owner`` записывается авторизованный пользователь, совершивший запрос.

                Args:
                    request (HttpRequest): Объект текущего HTTP-запроса из панели администратора.
                    obj (Model): Экземпляр сохраняемой модели файла.
                    form (ModelForm): Экземпляр формы, использованной для валидации данных.
                    change (bool): Флаг, указывающий на операцию изменения существующего
                        объекта (True) или создание нового (False).

                Examples:
                    >>> class MockUser: pass
                    >>> class MockRequest: user = MockUser()
                    >>> class MockFile: pk = None; owner = None
                    >>> admin_obj = FileAdmin(MockFile, None)
                    >>> # После вызова save_model у нового объекта заполнится владелец
                """
        if not obj.pk:
            obj.owner = request.user
        super().save_model(request, obj, form, change)


@admin.register(FileHistory)
class FileHistoryAdmin(admin.ModelAdmin):
    """Класс настройки административной панели для аудита истории файлов.

    Обеспечивает отображение, фильтрацию и поиск записей логирования событий
    файловой системы (создание, изменение, удаление). Класс полностью блокирует
    возможность ручного добавления или модификации записей через панель администратора,
    гарантируя неизменяемость истории (Read-Only интерфейс).

    Attributes:
        list_display (tuple): Список полей, отображаемых в общей таблице логов.
        list_filter (tuple): Боковые фильтры по типу события и времени создания.
        search_fields (tuple): Поля, по которым доступен текстовый поиск (включая
            связанные связи пользователя).
        readonly_fields (tuple): Список полей, которые отображаются только для
            чтения в детальной карточке записи.
        date_hierarchy (str): Временная навигационная цепочка (таймлайн) по полю даты.

    Methods:
        has_add_permission(request): Блокирует создание записей истории.
        has_change_permission(request, obj): Блокирует редактирование записей истории.
    """
    list_display = ('id', 'file_name', 'event_type', 'user', 'timestamp', 'ip_address')
    list_filter = ('event_type', 'timestamp')
    search_fields = ('file_name', 'user__email', 'user__name')
    readonly_fields = ('file', 'file_name', 'event_type', 'user', 'timestamp', 
                      'old_value', 'new_value', 'details', 'ip_address')
    date_hierarchy = 'timestamp'
    
    def has_add_permission(self, request):
        """Отключает право на добавление новых записей логов через админку.

                Args:
                    request (HttpRequest): Объект текущего HTTP-запроса от администратора.

                Returns:
                    bool: Всегда False, запрещая ручное создание логов.
                """
        return False
    
    def has_change_permission(self, request, obj=None):
        """Отключает право на изменение существующих записей логов через админку.

                Args:
                    request (HttpRequest): Объект текущего HTTP-запроса от администратора.
                    obj (Model, optional): Конкретный экземпляр записи лога.

                Returns:
                    bool: Всегда False, предотвращая редактирование данных аудита.
                """
        return False


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    """Класс настройки административной панели для управления правами доступа.

    Обеспечивает интерфейс для назначения, просмотра и изменения прав доступа
    пользователей к файлам и папкам. Поддерживает группировку полей по блокам,
    фильтрацию по типам разрешений, поиск по email/имени пользователей, а также
    динамическое вычисление целевого ресурса.

    Attributes:
        list_display (tuple): Поля, отображаемые в таблице списка прав доступа.
        list_filter (tuple): Параметры фильтрации записей в боковой панели.
        search_fields (tuple): Поля связанных моделей для полнотекстового поиска.
        readonly_fields (tuple): Поля системных дат, защищенные от изменения ручным вводом.
        date_hierarchy (str): Активирует временную шкалу навигации по дате создания.
        fieldsets (tuple): Структура группировки полей на форме редактирования права.

    Methods:
        resource_display(obj): Вычисляет текстовое представление связанного ресурса.
    """
    list_display = ('id', 'user', 'resource_display', 'permission_type', 'inherit', 'granted_by', 'created_at')
    list_filter = ('permission_type', 'inherit', 'created_at')
    search_fields = ('user__email', 'user__name', 'granted_by__email', 'granted_by__name')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'granted_by', 'permission_type', 'inherit')
        }),
        ('Ресурс', {
            'fields': ('file', 'folder')
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def resource_display(self, obj):
        """Возвращает строковое представление ресурса, к которому выдано право.

        Определяет, к какому типу объекта (файл или папка) относится запись,
        и форматирует строку с указанием его имени для отображения в списке.

        Args:
            obj (Permission): Экземпляр модели права доступа, содержащий
                опциональные связи ``file`` и ``folder``.

        Returns:
            str: Строка вида "Файл: <имя>" или "Папка: <имя>". Если связи
            отсутствуют, возвращает дефис "-".

        Examples:
            >>> class MockFile: name = "photo.png"
            >>> class MockPermission: file = MockFile(); folder = None
            >>> admin_obj = PermissionAdmin(None, None)
            >>> admin_obj.resource_display(MockPermission())
            'Файл: photo.png'
        """
        if obj.file:
            return f"Файл: {obj.file.name}"
        elif obj.folder:
            return f"Папка: {obj.folder.name}"
        return "-"
    resource_display.short_description = 'Ресурс'