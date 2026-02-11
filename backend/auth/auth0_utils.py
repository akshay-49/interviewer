"""Auth0 and Entra ID token validation and utilities"""
import os
import json
import base64
from typing import Optional
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
import requests
from dotenv import load_dotenv

load_dotenv()

# Auth0 configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
AUTH0_ALGORITHMS = ["RS256"]

# Entra ID (Azure AD) configuration
AZURE_TENANT_ID = os.getenv("VITE_AZURE_AUTHORITY", "").split("/")[-1] or "f8300747-02c3-470c-a3d6-5a3355e3d77d"
AZURE_CLIENT_ID = os.getenv("VITE_AZURE_CLIENT_ID")
AZURE_ALGORITHMS = ["RS256"]

security = HTTPBearer(auto_error=False)

# Cache for Auth0 public keys
_jwks_cache = None
_azure_jwks_cache = None

def get_auth0_public_key():
    """Fetch Auth0 public keys for JWT validation"""
    global _jwks_cache
    
    if _jwks_cache is None:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url, timeout=10)
            response.raise_for_status()
            _jwks_cache = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to fetch Auth0 public keys: {str(e)}"
            )
    
    return _jwks_cache

def get_azure_public_key():
    """Fetch Azure AD public keys for JWT validation"""
    global _azure_jwks_cache
    
    if _azure_jwks_cache is None:
        jwks_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/discovery/v2.0/keys"
        try:
            response = requests.get(jwks_url, timeout=10)
            response.raise_for_status()
            _azure_jwks_cache = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to fetch Azure AD public keys: {str(e)}"
            )
    
    return _azure_jwks_cache

def decode_token_payload(token: str) -> dict:
    """Manually decode JWT token without verification - extract claims only"""
    try:
        # JWT format: header.payload.signature
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        print(f"Token to decode (first 50 chars): {token[:50]}...")
        
        parts = token.split('.')
        print(f"Token has {len(parts)} parts")
        
        if len(parts) != 3:
            raise ValueError(f"Invalid token format: expected 3 parts, got {len(parts)}")
        
        # Decode payload (add padding if needed)
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_json = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_json)
        return payload
    except Exception as e:
        print(f"Failed to decode token payload: {e}")
        raise

def verify_auth0_token(token: str) -> dict:
    """
    Verify Auth0 JWT token and return decoded payload
    
    Args:
        token: JWT token from Auth0
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.debug(f"Verifying token via /userinfo, length: {len(token)}")
        userinfo_url = f"https://{AUTH0_DOMAIN}/userinfo"
        response = requests.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token"
            )
        return response.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation exception: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed"
        )

def verify_entra_id_token(token: str) -> dict:
    """
    Verify Entra ID (Azure AD) JWT token and return decoded payload
    
    Args:
        token: JWT token from Entra ID
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.debug(f"Verifying Entra ID token, length: {len(token)}")
        
        # Decode payload without verification
        unverified = decode_token_payload(token)
        logger.debug(f"Token claims decoded: sub={unverified.get('sub')}, appid={unverified.get('appid')}")
        
        # Verify the issuer is Entra ID
        issuer = unverified.get("iss")
        allowed_issuers = {
            f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/v2.0",
            f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/",
            f"https://sts.windows.net/{AZURE_TENANT_ID}/",
        }

        logger.debug(f"Issuer check: got={issuer}, allowed={allowed_issuers}")

        if not issuer or issuer not in allowed_issuers:
            logger.error(f"Invalid Entra ID issuer: {issuer}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Entra ID issuer: {issuer}"
            )
        
        # Verify the audience (should be our client ID)
        aud = unverified.get("aud")
        logger.debug(f"Audience check: got={aud}, expected={AZURE_CLIENT_ID}")
        if isinstance(aud, list):
            audience_valid = AZURE_CLIENT_ID in aud
        else:
            audience_valid = aud == AZURE_CLIENT_ID
        if not audience_valid:
            logger.error(f"Invalid audience: {aud}, expected {AZURE_CLIENT_ID}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid audience"
            )
        
        # Check token expiration
        import time
        now = time.time()
        exp = unverified.get("exp")
        logger.debug(f"Expiration check: exp={exp}, now={now}")
        
        if exp and exp < now:
            logger.error(f"Token has expired: exp={exp}, now={now}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        
        logger.info(f"Entra ID token accepted for user: {unverified.get('preferred_username')} (appid={unverified.get('appid')})")
        return unverified
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Entra ID token validation exception: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Entra ID token validation failed: {str(e)}"
        )

def get_current_user(request: Request) -> dict:
    """Dependency to get current user from cookie or Authorization header."""
    return get_current_user_from_cookie(request)

def get_current_user_from_cookie(request: Request) -> dict:
    """
    Dependency to get current user from httpOnly cookie or Authorization header
    Supports both Auth0 and Entra ID tokens
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Decoded token payload
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Try to get token from httpOnly cookie first
    token = request.cookies.get("access_token")
    logger.debug(f"Token from cookie: {'Found' if token else 'Not found'}")
    logger.debug(f"All cookies: {list(request.cookies.keys())}")
    
    # If not in cookie, try Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        logger.debug(f"Auth header: {auth_header[:20] if auth_header else 'None'}")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            logger.debug("Token from Authorization header")
    
    if not token:
        logger.warning("No authentication token found in cookie or header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )
    
    # Try to determine token type by examining the issuer claim
    if token.count('.') == 2:
        try:
            unverified = decode_token_payload(token)
            issuer = unverified.get("iss", "")

            # Check if it's an Entra ID token
            if "login.microsoftonline.com" in issuer or "sts.windows.net" in issuer:
                logger.debug("Detected Entra ID token, verifying with Entra ID rules")
                return verify_entra_id_token(token)
            logger.debug("Detected JWT token, verifying with Auth0 rules")
            return verify_auth0_token(token)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token type detection failed: {e}, trying Auth0 validation")
            return verify_auth0_token(token)

    # Opaque token: treat as Auth0 access token and use /userinfo
    return verify_auth0_token(token)

def extract_user_info(auth0_payload: dict) -> dict:
    """
    Extract user information from Auth0 or Entra ID token payload

    Args:
        auth0_payload: Decoded token payload

    Returns:
        Dictionary with user information
    """
    email = (
        auth0_payload.get("email")
        or auth0_payload.get("preferred_username")
        or auth0_payload.get("upn")
        or auth0_payload.get("unique_name")
        or ""
    )
    full_name = auth0_payload.get("name") or auth0_payload.get("given_name") or ""
    user_sub = auth0_payload.get("sub") or auth0_payload.get("oid")

    return {
        "auth0_sub": user_sub,
        "email": email.lower(),
        "full_name": full_name,
        "picture": auth0_payload.get("picture"),
        "email_verified": auth0_payload.get("email_verified", False)
    }
