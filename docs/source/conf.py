import os
import sys
import django

# Путь к корню проекта (docs/source/ -> ../../)
sys.path.insert(0, os.path.abspath("../.."))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings")

from django.conf import settings

# Sphinx imports Django modules only to read docstrings. Disabling Django logging
# here prevents documentation builds from depending on local log-file access.
settings.LOGGING_CONFIG = None
django.setup()

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
suppress_warnings = ["autodoc.duplicate_object"]

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- HTML output --------------------------------------------------------------

html_theme = "alabaster"
html_static_path = ["_static"]
