Observers
=========

Модули ``observers`` реализуют паттерн Observer для событий, связанных с файлами.
Это позволяет отделить создание события от реакции на него.

Base observer
-------------

``base.py`` содержит базовые классы события, наблюдателя и субъекта.

Основные классы:

* ``FileEvent`` — объект события файла.
* ``FileObserver`` — базовый интерфейс наблюдателя.
* ``FileSubject`` — хранит наблюдателей и уведомляет их о событиях.

.. automodule:: ep_files_app.observers.base
   :members:
   :undoc-members:
   :show-inheritance:

History observer
----------------

``history_observer.py`` записывает события файлов в историю.

Основной класс:

* ``FileHistoryObserver`` — создаёт записи истории при событиях файла.

.. automodule:: ep_files_app.observers.history_observer
   :members:
   :undoc-members:
   :show-inheritance: