API modules
===========

Модули ``ep_files_app.api`` содержат HTTP API проекта. Они принимают запросы
от frontend-части, проверяют пользователя и права доступа, вызывают сервисную
логику и возвращают JSON-ответы или файлы.

Auth views
----------

``auth_views.py`` отвечает за регистрацию, вход пользователя и получение данных
текущего пользователя.

Основные элементы:

* ``RegisterView`` — создаёт нового пользователя и возвращает JWT-токены.
* ``LoginView`` — проверяет email и пароль, возвращает JWT-токены.
* ``MeView`` — возвращает данные текущего авторизованного пользователя.
* ``protected_test_view`` — тестовый защищённый endpoint.

.. automodule:: ep_files_app.api.auth_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

File views
----------

``file_views.py`` отвечает за загрузку, скачивание, удаление, перемещение,
поиск, предпросмотр файлов и статистику хранилища пользователя.

Основные функции:

* ``upload_file`` — загружает файл и создаёт запись в базе данных.
* ``download_file`` — отдаёт файл пользователю после проверки доступа.
* ``delete_file`` — удаляет файл и его метаданные.
* ``file_move`` — переносит файл в другую папку.
* ``file_preview`` — возвращает безопасный предпросмотр файла.
* ``search_files`` — ищет файлы по имени.
* ``user_storage_stats`` — считает статистику занятого места.

.. automodule:: ep_files_app.api.file_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Folder views
------------

``folder_views.py`` отвечает за работу с папками: создание, переименование,
перемещение, удаление, дерево папок и скачивание папки архивом.

Основные функции:

* ``folder_create`` — создаёт папку.
* ``folder_rename`` — переименовывает папку.
* ``folder_move`` — переносит папку.
* ``folder_delete`` — удаляет папку.
* ``folder_tree`` — возвращает дерево папок пользователя.
* ``download_folder`` — скачивает папку как ZIP-архив.

.. automodule:: ep_files_app.api.folder_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Permission views
----------------

``permission_views.py`` отвечает за выдачу, отзыв и просмотр прав доступа
к файлам и папкам.

Основные функции:

* ``grant_file_permission`` — выдаёт доступ к файлу.
* ``grant_folder_permission`` — выдаёт доступ к папке.
* ``revoke_file_permission`` — отзывает доступ к файлу.
* ``revoke_folder_permission`` — отзывает доступ к папке.
* ``list_file_permissions`` — показывает права на файл.
* ``list_folder_permissions`` — показывает права на папку.
* ``my_permissions`` — показывает права текущего пользователя.
* ``accessible_files`` — возвращает доступные пользователю файлы.
* ``accessible_folders`` — возвращает доступные пользователю папки.

.. automodule:: ep_files_app.api.permission_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Public link views
-----------------

``public_link_views.py`` отвечает за публичные ссылки на файлы и папки.

Основные функции:

* ``enable_file_public_link`` — включает публичную ссылку на файл.
* ``disable_file_public_link`` — отключает публичную ссылку на файл.
* ``public_download_file`` — скачивает файл по публичной ссылке.
* ``enable_folder_public_link`` — включает публичную ссылку на папку.
* ``disable_folder_public_link`` — отключает публичную ссылку на папку.
* ``public_folder_detail`` — показывает содержимое публичной папки.
* ``public_folder_file_download`` — скачивает файл из публичной папки.

.. automodule:: ep_files_app.api.public_link_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Text file views
---------------

``text_file_views.py`` отвечает за чтение и сохранение текстовых файлов
во встроенном редакторе.

Основные функции:

* ``read_text_file`` — читает текстовый файл.
* ``save_text_file`` — сохраняет новое содержимое текстового файла.
* ``_sanitize_text_content`` — очищает текст от небезопасного содержимого.

.. automodule:: ep_files_app.api.text_file_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Admin views
-----------

``admin_views.py`` содержит API для административного управления пользователями
и контентом.

Основные функции:

* ``admin_list_users`` — возвращает список пользователей.
* ``admin_stats`` — возвращает статистику проекта.
* ``admin_block_user`` — блокирует пользователя.
* ``admin_unblock_user`` — разблокирует пользователя.
* ``admin_delete_user_files`` — удаляет файлы пользователя.
* ``admin_delete_user`` — удаляет пользователя.

.. automodule:: ep_files_app.api.admin_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

History views
-------------

``history_views.py`` отвечает за историю действий с файлами.

Основные функции:

* ``file_history`` — показывает историю конкретного файла.
* ``user_activity_history`` — показывает действия пользователя.
* ``recent_activity`` — показывает последние действия.

.. automodule:: ep_files_app.api.history_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Favorite views
--------------

``favorite_views.py`` отвечает за избранные файлы и папки.

Основные функции:

* ``toggle_favorite`` — добавляет или убирает объект из избранного.
* ``get_user_favorites`` — возвращает избранное текущего пользователя.

.. automodule:: ep_files_app.api.favorite_views
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Serializers
-----------

``serializers.py`` преобразует модели проекта в JSON и обратно.

.. automodule:: ep_files_app.api.serializers
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Authentication
--------------

``authentication.py`` содержит JWT-аутентификацию проекта.

.. automodule:: ep_files_app.api.authentication
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:
