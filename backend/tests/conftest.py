"""
conftest.py – Configuración global de pytest para el backend.

Ajusta el PYTHONPATH al raíz del proyecto para que los imports
del tipo `from backend.xxx import yyy` funcionen correctamente
tanto en local como en el pipeline de CI.
"""
import sys
import os

# Agrega el directorio raíz del proyecto (ChessGame/) al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
