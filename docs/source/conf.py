import os
import sys
import django

# Путь к корню проекта (docs/source/ -> ../../)
sys.path.insert(0, os.path.abspath("../.."))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings")

try:
    django.setup()
except Exception:
    pass

# -- Project info -------------------------------------------------------------

project = "EP-Files"
author = "EP-Files Team"
release = "1.0"

# -- General ------------------------------------------------------------------

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
]

autodoc_default_options = {
    "members": True,
    "undoc-members": True,
    "show-inheritance": True,
    "private-members": False,
}

napoleon_google_docstring = True
napoleon_numpy_docstring = False

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- HTML output --------------------------------------------------------------

html_theme = "alabaster"
html_static_path = ["_static"]
