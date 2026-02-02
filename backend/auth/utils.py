"""Authentication utilities - password hashing and JWT tokens"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

# Password hashing context - using argon2 (no byte length limitations unlike bcrypt)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Microsoft 365 (Entra ID) settings
M365_TENANT_ID = os.getenv("M365_TENANT_ID")
M365_CLIENT_ID = os.getenv("M365_CLIENT_ID")
M365_ISSUER = (
    f"https://login.microsoftonline.com/{M365_TENANT_ID}/v2.0"
    if M365_TENANT_ID else None
)

_JWKS_CACHE: Dict[str, Any] = {}
_JWKS_CACHE_EXPIRY: float = 0.0

def _get_m365_jwks() -> Dict[str, Any]:
    """Fetch and cache Microsoft 365 JWKS."""
    global _JWKS_CACHE, _JWKS_CACHE_EXPIRY
    if _JWKS_CACHE and time.time() < _JWKS_CACHE_EXPIRY:
        return _JWKS_CACHE

    if not M365_TENANT_ID:
        raise ValueError("M365_TENANT_ID is not configured")

    openid_url = f"https://login.microsoftonline.com/{M365_TENANT_ID}/v2.0/.well-known/openid-configuration"
    config = requests.get(openid_url, timeout=10).json()
    jwks_uri = config.get("jwks_uri")
    if not jwks_uri:
        raise ValueError("Failed to fetch jwks_uri from Microsoft OpenID configuration")

    jwks = requests.get(jwks_uri, timeout=10).json()
    _JWKS_CACHE = jwks
    _JWKS_CACHE_EXPIRY = time.time() + 3600
    return jwks

def verify_m365_id_token(id_token: str) -> Dict[str, Any]:
    """Verify Microsoft 365 ID token and return claims."""
    if not M365_TENANT_ID or not M365_CLIENT_ID or not M365_ISSUER:
        raise ValueError("M365_TENANT_ID and M365_CLIENT_ID must be configured")

    header = jwt.get_unverified_header(id_token)
    kid = header.get("kid")
    if not kid:
        raise ValueError("Invalid token header: missing kid")

    jwks = _get_m365_jwks()
    keys = jwks.get("keys", [])
    key = next((k for k in keys if k.get("kid") == kid), None)
    if not key:
        raise ValueError("Signing key not found in JWKS")

    claims = jwt.decode(
        id_token,
        key,
        algorithms=["RS256"],
        audience=M365_CLIENT_ID,
        issuer=M365_ISSUER,
    )
    return claims

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
