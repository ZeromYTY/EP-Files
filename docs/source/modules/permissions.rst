Permissions
===========

Модуль ``ep_files_app.permissions`` содержит классы прав доступа для Django REST Framework.
Эти классы используются в API для проверки владельца файла, прав чтения,
прав редактирования и роли администратора.

Основные классы:

* ``IsFileOwner`` — разрешает доступ только владельцу файла.
* ``IsFileOwnerOrReadOnly`` — владельцу разрешает изменение, остальным только чтение.
* ``CanUploadFiles`` — проверяет возможность загрузки файла.
* ``IsAdminUser`` — разрешает доступ только администратору.
* ``HasFileReadPermission`` — проверяет право чтения файла.
* ``HasFileWritePermission`` — проверяет право редактирования файла.
* ``HasFolderReadPermission`` — проверяет право чтения папки.
* ``HasFolderWritePermission`` — проверяет право редактирования папки.

.. automodule:: ep_files_app.permissions
   :members:
   :undoc-members:
   :show-inheritance:

Permission middleware
---------------------

.. automodule:: ep_files_app.middleware.permissions
   :members:
   :undoc-members:
   :show-inheritance: