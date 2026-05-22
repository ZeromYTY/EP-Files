Services
========

Сервисы содержат бизнес-логику проекта, которая вынесена из API-представлений.
Так API-функции остаются короче, а основную логику проще тестировать и объяснять.

File service
------------

``file_service.py`` содержит обработку файлов и паттерны, связанные с файлами.

Основные классы:

* ``ImageProcessingStrategy`` — стратегия обработки изображений.
* ``DocumentProcessingStrategy`` — стратегия обработки документов.
* ``FileActivityLogger`` — наблюдатель для логирования действий с файлами.
* ``FileService`` — сервис загрузки и обработки файла.

.. automodule:: ep_files_app.services.file_service
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Permission service
------------------

``permission_service.py`` содержит основную логику проверки, выдачи и отзыва
прав доступа.

Основные методы:

* ``can_read_file`` — проверяет право чтения файла.
* ``can_write_file`` — проверяет право редактирования файла.
* ``can_read_folder`` — проверяет право чтения папки.
* ``can_write_folder`` — проверяет право редактирования папки.
* ``grant_permission`` — выдаёт право доступа.
* ``revoke_permission`` — отзывает право доступа.
* ``get_user_permissions`` — возвращает права пользователя.
* ``get_resource_permissions`` — возвращает права на ресурс.
* ``get_accessible_files`` — возвращает доступные пользователю файлы.
* ``get_accessible_folders`` — возвращает доступные пользователю папки.

.. automodule:: ep_files_app.services.permission_service
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

File event service
------------------

``file_event_service.py`` создаёт события для истории действий с файлами.

Основные методы:

* ``emit_upload_event`` — фиксирует загрузку файла.
* ``emit_download_event`` — фиксирует скачивание файла.
* ``emit_rename_event`` — фиксирует переименование файла.
* ``emit_move_event`` — фиксирует перемещение файла.
* ``emit_delete_event`` — фиксирует удаление файла.
* ``emit_update_event`` — фиксирует редактирование файла.

.. automodule:: ep_files_app.services.file_event_service
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Base service
------------

.. automodule:: ep_files_app.services.base
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:
