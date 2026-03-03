"""Shared runtime bootstrap for local vendor overlays."""
import os
import sys


BASE_DIR = os.path.dirname(__file__)
VENDOR_DIR = os.path.join(BASE_DIR, '.vendor')


def configure_local_vendor() -> None:
    """Prefer project-local vendored packages when present."""
    if os.path.isdir(VENDOR_DIR) and VENDOR_DIR not in sys.path:
        sys.path.insert(0, VENDOR_DIR)
