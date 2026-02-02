"""Authentication module for user management and JWT tokens"""

from .models import User
from .utils import verify_password, get_password_hash, create_access_token, decode_access_token
from .routes import router

__all__ = [
    "User",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "decode_access_token",
    "router"
]
