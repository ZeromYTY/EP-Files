Models
======

Модели описывают основные сущности проекта: пользователей, файлы, папки,
историю действий, права доступа и избранное.

Main models
-----------

``models.py`` содержит основные модели и вспомогательные классы предпросмотра.

Основные классы:

* ``UserManager`` — создаёт обычных пользователей и суперпользователей.
* ``User`` — пользователь проекта, который входит по email.
* ``Folder`` — папка пользователя с поддержкой вложенности.
* ``File`` — файл пользователя с метаданными, владельцем и папкой.
* ``PreviewFactory`` — выбирает способ предпросмотра файла.
* ``FileOperationFacade`` — упрощает загрузку и удаление файлов.
* ``FavoriteFile`` — связь пользователя с избранным файлом или папкой.

.. automodule:: ep_files_app.models.models
   :members:
   :undoc-members:
   :show-inheritance:

File history
------------

``file_history.py`` хранит историю действий с файлами.

Основной класс:

* ``FileHistory`` — запись о действии пользователя с файлом.

.. automodule:: ep_files_app.models.file_history
   :members:
   :undoc-members:
   :show-inheritance:

Permission model
----------------

``permissions.py`` хранит права доступа к файлам и папкам.

Основной класс:

* ``Permission`` — право пользователя на чтение или редактирование ресурса.

.. automodule:: ep_files_app.models.permissions
   :members:
   :undoc-members:
   :show-inheritance: