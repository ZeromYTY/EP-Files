# Проверка критериев 6 и 7

Дата актуальной проверки: 22.05.2026.

## Критерий 6: структура проекта

### Файлы объемом более 500 строк кода

**Результат: 0 файлов**

- Проверено 55 Python-файлов проекта.
- Файлов длиннее 500 строк не найдено.

### Классы объемом более 300 строк кода

**Результат: 0 классов**

- Классов длиннее 300 строк не найдено.

### Функции объемом более 50 строк кода

**Результат: 0 функций**

- Функций длиннее 50 строк не найдено.

### Команда проверки

```powershell
python - <<'PY'
import ast
from pathlib import Path

root = Path(r"D:\ep-files")
paths = [
    p for p in root.rglob("*.py")
    if ".venv" not in p.parts and "migrations" not in p.parts
]

long_files = []
long_classes = []
long_functions = []

for path in paths:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if len(lines) > 500:
        long_files.append((path, len(lines)))

    tree = ast.parse(text)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and hasattr(node, "end_lineno"):
            length = node.end_lineno - node.lineno + 1
            if length > 300:
                long_classes.append((path, node.name, length))
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and hasattr(node, "end_lineno"):
            length = node.end_lineno - node.lineno + 1
            if length > 50:
                long_functions.append((path, node.name, length))

print("python_files_checked", len(paths))
print("long_files_over_500", len(long_files))
print("long_classes_over_300", len(long_classes))
print("long_functions_over_50", len(long_functions))
PY
```

### Итог по критерию 6

**8 баллов из 8**: структура проекта соответствует требованиям, перегруженных файлов, классов и функций не обнаружено.

---

## Критерий 7: соблюдение стандартов PEP8

### Результат Pylint

**Pylint: 8.28/10**

Команда проверки:

```powershell
$env:DJANGO_SETTINGS_MODULE = "main.settings"
python -m pylint ep_files_app main
```

Результат:

```text
Your code has been rated at 8.28/10
```

### Что уже соответствует критерию

- Pylint выше требуемого порога 8.0.
- Используется `.pylintrc` с настройкой `pylint_django` и `django-settings-module=main.settings`.
- Ложные срабатывания Django ORM и импортов окружения отключены через конфигурацию.
- Имена функций, классов и переменных в основном отражают назначение сущностей.

### Оставшиеся замечания Pylint

Оставшиеся предупреждения не опускают оценку ниже 8.0. Основные категории:

- `C0303` trailing whitespace;
- `C0301` отдельные строки длиннее 100 символов;
- `C0304` отсутствие финального перевода строки в отдельных файлах;
- `W0718` перехват общего `Exception` в обработчиках API;
- `C0415` локальные импорты внутри некоторых функций;
- `W0611` отдельные неиспользуемые импорты.

### Итог по критерию 7

**8 баллов из 8**: Pylint показывает `8.28/10`, значит проект проходит требование `Pylint >= 8`.
