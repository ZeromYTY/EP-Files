Middleware
==========

Middleware выполняет обработку запросов и ответов на уровне всего приложения.

Security middleware
-------------------

``security.py`` добавляет заголовки безопасности и ограничивает частоту запросов.

Основные классы:

* ``SecurityHeadersMiddleware`` — добавляет HTTP-заголовки безопасности.
* ``RateLimitMiddleware`` — ограничивает слишком частые запросы с одного IP.

.. automodule:: ep_files_app.middleware.security
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:

Permission middleware
---------------------

``permissions.py`` содержит middleware для дополнительной проверки доступа
к файлам и папкам.

.. automodule:: ep_files_app.middleware.permissions
   :members:
   :undoc-members:
   :show-inheritance:
   :no-index:
