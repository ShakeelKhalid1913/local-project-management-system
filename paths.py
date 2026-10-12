"""Resolve app / resource paths for normal runs and frozen .exe builds."""

from __future__ import annotations

import sys
from pathlib import Path


def app_dir() -> Path:
    """Writable directory next to the exe (or project root)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def resource_dir() -> Path:
    """Read-only bundled files (templates/static) when frozen."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent
