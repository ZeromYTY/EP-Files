Utilities
=========

Вспомогательные модули содержат настройки, логирование и проверки файлов.

Validators
----------

``validators.py`` проверяет загружаемые файлы.

Основные функции:

* ``validate_file_extension`` — проверяет расширение файла.
* ``validate_file_mime_type`` — проверяет MIME-тип файла.
* ``validate_file_size`` — проверяет размер файла.
* ``validate_filename`` — проверяет имя файла.
* ``sanitize_filename`` — очищает имя файла от опасных символов.

.. automodule:: ep_files_app.validators
   :members:
   :undoc-members:
   :show-inheritance:

Logger
------

``logger.py`` настраивает логирование проекта.

.. automodule:: ep_files_app.logger
   :members:
   :undoc-members:
   :show-inheritance:

Application config
------------------

.. automodule:: ep_files_app.apps
   :members:
   :undoc-members:
   :show-inheritance:

Core config
-----------

.. automodule:: ep_files_app.core.config
   :members:
   :undoc-members:
   :show-inheritance: