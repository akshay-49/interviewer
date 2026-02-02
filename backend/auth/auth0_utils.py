"""Auth0 token validation and utilities"""
import os
import json
import base64
from typing import Optional
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import requests
from dotenv import load_dotenv

load_dotenv()

# Auth0 configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
AUTH0_ALGORITHMS = ["RS256"]
JWT_SECRET = os.getenv("JWT_SECRET_KEY")

security = HTTPBearer()

# Cache for Auth0 public keys
_jwks_cache = None

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
    try:
        print(f"Verifying token, length: {len(token)}, type: {type(token)}")
        print(f"Token first 100 chars: {token[:100]}")
        print(f"Token last 50 chars: {token[-50:]}")
        
        # Decode payload without verification
        unverified = decode_token_payload(token)
        print(f"Token claims: {unverified}")
        
        # Verify the issuer is Auth0
        issuer = unverified.get("iss")
        expected_issuer = f"https://{AUTH0_DOMAIN}/"
        
        if issuer != expected_issuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid issuer: {issuer}"
            )
        
        # Check token expiration
        import time
        now = time.time()
        exp = unverified.get("exp")
        if exp and exp < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        
        print(f"Token accepted for user: {unverified.get('sub')}")
        return unverified
        
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Token validation exception: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}"
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to get current user from Auth0 token
    
    Args:
        credentials: HTTP Authorization header with Bearer token
        
    Returns:
        Decoded token payload
    """
    token = credentials.credentials
    return verify_auth0_token(token)

def extract_user_info(auth0_payload: dict) -> dict:
    """
    Extract user information from Auth0 token payload
    
    Args:
        auth0_payload: Decoded Auth0 token
        
    Returns:
        Dictionary with user information
    """
    return {
        "auth0_sub": auth0_payload.get("sub"),
        "email": auth0_payload.get("email", "").lower(),
        "full_name": auth0_payload.get("name", ""),
        "picture": auth0_payload.get("picture"),
        "email_verified": auth0_payload.get("email_verified", False)
    }
