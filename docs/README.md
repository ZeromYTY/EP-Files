# EP-Files Documentation

Документация генерируется из docstrings через [Sphinx](https://www.sphinx-doc.org/) с расширениями `autodoc` и `napoleon`.

---

## Покрытые модули

| Модуль | Путь |
|---|---|
| File services (Strategy / Observer / Facade) | `ep_files_app/services/file_service.py` |
| API serializers | `ep_files_app/api/serializers.py` |
| Permissions | `ep_files_app/permissions.py` |

---

## Локальная сборка

### Требования

```bash
pip install sphinx sphinx-rtd-theme
```

### Сборка HTML

```bash
cd docs
make html
```

Результат: `docs/build/html/index.html`

### Открыть в браузере

```bash
# Linux / macOS
open docs/build/html/index.html

# Windows
start docs\build\html\index.html
```

### Очистка

```bash
make clean
```

---

## CI / GitLab Pages

| Ветка | Поведение |
|---|---|
| `feature/ci-cd-docs`, `dev` | Сборка + артефакт (скачать из pipeline → `docs/build/html/`) |
| `main` | Сборка + деплой на **GitLab Pages** |

GitLab Pages URL после мержа в `main`:

```
https://<namespace>.gitlab.io/<project-name>/
```

Артефакты хранятся **30 дней**. Скачать: GitLab → Pipeline → Job `build-docs` → Download artifacts.

---

## Добавление docstrings

Используй Google-style формат (поддерживается `napoleon`):

```python
def handle_upload(self, uploaded_file, user):
    """Краткое описание.

    Args:
        uploaded_file: Загружаемый файл.
        user: Владелец файла.

    Returns:
        tuple[File | None, str]: Объект файла и статус обработки.

    Raises:
        ValueError: Если файл повреждён.
    """
```

После добавления docstring пересобери: `make html`.
