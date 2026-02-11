"""Authentication API endpoints with Auth0 integration"""
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from backend.auth.auth0_utils import get_current_user_from_cookie, extract_user_info, verify_entra_id_token
from backend.core.cosmos import users_container, serialize_for_cosmos
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import uuid
import requests
import os
import time
import secrets

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Environment check for secure cookies
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "")
AUTH0_CALLBACK_URL = os.getenv("AUTH0_CALLBACK_URL", "http://localhost:8000/auth/callback")
AUTH0_DEFAULT_RETURN_TO = os.getenv("AUTH0_DEFAULT_RETURN_TO", "http://localhost:5173/callback")

# Rate limiting
rate_limit_storage = defaultdict(list)
RATE_LIMIT_WINDOW = 300  # 5 minutes
MAX_ATTEMPTS = 5  # 5 attempts per window

def check_rate_limit(ip: str, endpoint: str) -> bool:
    """Check if IP has exceeded rate limit for endpoint"""
    key = f"{ip}:{endpoint}"
    now = time.time()
    
    # Remove old attempts outside the window
    rate_limit_storage[key] = [t for t in rate_limit_storage[key] if now - t < RATE_LIMIT_WINDOW]
    
    # Check if limit exceeded
    if len(rate_limit_storage[key]) >= MAX_ATTEMPTS:
        return False
    
    # Record this attempt
    rate_limit_storage[key].append(now)
    return True

# In-memory user storage (primary storage)
in_memory_users = {}

def _cache_user(user_data: dict) -> None:
    """Cache user data in memory using auth0_sub as key."""
    if not user_data:
        return
    user_sub = user_data.get("auth0_sub")
    if user_sub:
        in_memory_users[user_sub] = user_data

# Pydantic models for request/response
class UserInfo(BaseModel):
    sub: str
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = False

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    picture: Optional[str] = None
    is_admin: bool
    is_active: bool

class AuthResponse(BaseModel):
    user: UserResponse

class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "Bearer"

class AcceptInviteRequest(BaseModel):
    invite_code: str

class SyncUserResponse(BaseModel):
    user: UserResponse


def _require_auth0_config():
    if not AUTH0_DOMAIN or not AUTH0_CLIENT_ID or not AUTH0_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth0 configuration is missing"
        )


@router.get("/login")
def login(request: Request):
    """Start Auth0 login (Regular Web App)."""
    _require_auth0_config()

    screen_hint = request.query_params.get("screen_hint", "login")
    login_hint = request.query_params.get("login_hint")
    return_to = request.query_params.get("return_to", AUTH0_DEFAULT_RETURN_TO)

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    params = {
        "response_type": "code",
        "client_id": AUTH0_CLIENT_ID,
        "redirect_uri": AUTH0_CALLBACK_URL,
        "scope": "openid profile email",
        "state": state,
        "nonce": nonce,
        "screen_hint": screen_hint,
        "prompt": "login",
    }

    if login_hint:
        params["login_hint"] = login_hint

    query = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    authorize_url = f"https://{AUTH0_DOMAIN}/authorize?{query}"

    response = RedirectResponse(authorize_url)
    response.set_cookie(
        key="auth_state",
        value=state,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=600
    )
    response.set_cookie(
        key="auth_nonce",
        value=nonce,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=600
    )
    response.set_cookie(
        key="auth_return_to",
        value=return_to,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=600
    )

    return response


@router.get("/callback")
def auth_callback(request: Request):
    """Handle Auth0 callback, exchange code for tokens, and set session cookie."""
    _require_auth0_config()

    code = request.query_params.get("code")
    state = request.query_params.get("state")
    stored_state = request.cookies.get("auth_state")
    return_to = request.cookies.get("auth_return_to") or AUTH0_DEFAULT_RETURN_TO

    if not code or not state or not stored_state or state != stored_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state")

    token_url = f"https://{AUTH0_DOMAIN}/oauth/token"
    token_payload = {
        "grant_type": "authorization_code",
        "client_id": AUTH0_CLIENT_ID,
        "client_secret": AUTH0_CLIENT_SECRET,
        "code": code,
        "redirect_uri": AUTH0_CALLBACK_URL,
    }

    token_response = requests.post(token_url, json=token_payload, timeout=10)
    if token_response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to exchange code")

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")

    response = RedirectResponse(return_to)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        path="/",
        samesite="lax",
        max_age=3600
    )
    response.delete_cookie("auth_state")
    response.delete_cookie("auth_nonce")
    response.delete_cookie("auth_return_to")

    return response


@router.get("/logout")
def logout(request: Request):
    """Logout and clear session cookie."""
    return_to = request.query_params.get("return_to", "http://localhost:5173/login")
    logout_url = f"https://{AUTH0_DOMAIN}/v2/logout?client_id={AUTH0_CLIENT_ID}&returnTo={requests.utils.quote(return_to)}"

    response = RedirectResponse(logout_url)
    response.delete_cookie("access_token", path="/")
    return response


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user_from_cookie)):
    """Return current user from session cookie."""
    user_info = extract_user_info(current_user)
    return {
        "id": user_info.get("auth0_sub"),
        "email": user_info.get("email"),
        "full_name": user_info.get("full_name"),
        "picture": user_info.get("picture"),
        "is_admin": user_info.get("email", "").endswith("@accellor.com"),
        "is_active": True
    }

@router.post("/accept-invite")
def accept_invite(request: AcceptInviteRequest, auth0_user: dict = Depends(get_current_user_from_cookie)):
    """Mark an invite as used and persist the Auth0 user in Cosmos DB."""
    invite_code = request.invite_code
    if not invite_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite_code is required")

    user_info = extract_user_info(auth0_user)
    user_email = user_info.get("email", "").lower()
    user_name = user_info.get("full_name") or user_info.get("email")
    user_sub = user_info.get("auth0_sub")

    if not user_email or not user_sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Auth0 user data")

    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey

        db = client.get_database_client("interviewer")

        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )

        query = "SELECT * FROM invites WHERE invites.invite_code = @code"
        items = list(invites_container.query_items(
            query=query,
            parameters=[{"name": "@code", "value": invite_code}],
            max_item_count=1
        ))

        if not items:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

        invite = items[0]
        if invite.get("status") in {"used", "expired"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite is no longer valid")
        if not invite.get("access_enabled", True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite access disabled")

        invited_email = (invite.get("candidate_email") or "").lower()
        if invited_email and invited_email != user_email:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite email mismatch")

        now_iso = datetime.utcnow().isoformat()

        # Create or update user record in Cosmos DB
        user_query = "SELECT * FROM users WHERE users.user_id = @id"
        user_items = list(users_container.query_items(
            query=user_query,
            parameters=[{"name": "@id", "value": user_sub}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))

        user_doc = {
            "id": user_sub,
            "user_id": user_sub,
            "auth0_sub": user_sub,
            "user_name": user_name,
            "user_email": user_email,
            "role": invite.get("role"),
            "seniority_level": invite.get("seniority_level"),
            "job_description": invite.get("job_description"),
            "invite_code": invite_code,
            "invite_status": "accepted",
            "auth_provider": "auth0",
            "is_admin": user_email.endswith("@accellor.com"),
            "is_active": True,
            "access_enabled": True,
            "invited_by_admin": True,
            "registered_at": now_iso,
            "updated_at": now_iso
        }

        if user_items:
            existing_user = user_items[0]
            user_doc["created_at"] = existing_user.get("created_at") or now_iso
        else:
            user_doc["created_at"] = now_iso

        users_container.upsert_item(serialize_for_cosmos(user_doc))
        _cache_user({
            "id": user_sub,
            "auth0_sub": user_sub,
            "email": user_email,
            "full_name": user_name,
            "picture": user_info.get("picture"),
            "is_admin": user_email.endswith("@accellor.com"),
            "is_active": True,
            "provider": "auth0",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

        invite["status"] = "used"
        invite["access_enabled"] = False
        invite["registered_at"] = now_iso
        invite["user_id"] = user_sub
        invite["auth0_user_id"] = user_sub
        invites_container.replace_item(item=invite["id"], body=invite)

        return {
            "success": True,
            "message": "Invite accepted",
            "user": {
                "id": user_sub,
                "email": user_email,
                "full_name": user_name,
                "is_admin": user_email.endswith("@accellor.com"),
                "is_active": True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting invite: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to accept invite")

@router.post("/sync-user", response_model=SyncUserResponse)
def sync_user(auth0_user: dict = Depends(get_current_user_from_cookie)):
    """Sync Auth0 user profile into Cosmos DB for admin visibility."""
    user_info = extract_user_info(auth0_user)
    user_email = user_info.get("email", "").lower()
    user_name = user_info.get("full_name") or user_info.get("email")
    user_sub = user_info.get("auth0_sub")

    if not user_email or not user_sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Auth0 user data")

    try:
        now_iso = datetime.utcnow().isoformat()

        user_query = "SELECT * FROM users WHERE users.user_id = @id"
        user_items = list(users_container.query_items(
            query=user_query,
            parameters=[{"name": "@id", "value": user_sub}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))

        user_doc = {
            "id": user_sub,
            "user_id": user_sub,
            "auth0_sub": user_sub,
            "user_name": user_name,
            "user_email": user_email,
            "auth_provider": "auth0",
            "is_admin": user_email.endswith("@accellor.com"),
            "is_active": True,
            "access_enabled": True,
            "updated_at": now_iso
        }

        if user_items:
            existing_user = user_items[0]
            user_doc["created_at"] = existing_user.get("created_at") or now_iso
            user_doc["invite_code"] = existing_user.get("invite_code")
            user_doc["invite_status"] = existing_user.get("invite_status")
            user_doc["invited_by_admin"] = existing_user.get("invited_by_admin")
        else:
            user_doc["created_at"] = now_iso

        users_container.upsert_item(serialize_for_cosmos(user_doc))
        _cache_user({
            "id": user_sub,
            "auth0_sub": user_sub,
            "email": user_email,
            "full_name": user_name,
            "picture": user_info.get("picture"),
            "is_admin": user_email.endswith("@accellor.com"),
            "is_active": True,
            "provider": "auth0",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

        return {
            "user": {
                "id": user_sub,
                "email": user_email,
                "full_name": user_name,
                "picture": user_info.get("picture"),
                "is_admin": user_email.endswith("@accellor.com"),
                "is_active": True
            }
        }
    except Exception as e:
        logger.error(f"Error syncing user: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to sync user")

@router.post("/logout")
def logout(response: Response, request: Request):
    """
    Logout user by clearing httpOnly cookie and session data
    """
    # Clear the httpOnly cookie
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax"
    )
    
    # Get user from cookie before clearing
    token = request.cookies.get("access_token")
    if token:
        try:
            # Remove from in-memory storage if present
            from backend.auth.auth0_utils import decode_token_payload
            payload = decode_token_payload(token)
            user_sub = payload.get("sub")
            if user_sub and user_sub in in_memory_users:
                logger.info(f"Removing user {in_memory_users[user_sub].get('email')} from in-memory storage")
                del in_memory_users[user_sub]
        except Exception as e:
            logger.warning(f"Error during logout cleanup: {e}")
    
    return {"message": "Logged out successfully"}

@router.get("/test-cookie")
def test_cookie(request: Request):
    """
    Debug endpoint to test if cookies are being received
    """
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Test cookie endpoint - Token from cookie: {'Found' if token else 'Not found'}")
    logger.info(f"All cookies received: {list(request.cookies.keys())}")
    logger.info(f"Auth header present: {bool(auth_header)}")
    
    return {
        "has_cookie": bool(token),
        "has_auth_header": bool(auth_header),
        "cookies_received": list(request.cookies.keys())
    }

@router.post("/callback", response_model=AuthResponse)
def auth_callback(user_info: UserInfo):
    """
    Handle Auth0 authentication callback
    Create or update user in memory after Auth0 authentication
    """
    # Check for admin based on @accellor.com domain
    is_admin = user_info.email.endswith("@accellor.com")
    
    # Check Cosmos DB for user status
    is_active = True
    user_id_from_cosmos = None
    try:
        from backend.core.cosmos import users_container
        query = "SELECT * FROM users WHERE users.user_email = @email"
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": user_info.email}],
            max_item_count=1
        ))
        if items:
            cosmos_user = items[0]
            is_active = cosmos_user.get("is_active", True)
            user_id_from_cosmos = cosmos_user.get("user_id")
            if cosmos_user.get("is_admin") is not None:
                is_admin = cosmos_user.get("is_admin")
            
            if not is_active:
                logger.warning(f"Inactive user attempted to login: {user_info.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been deactivated. Please contact an administrator."
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Could not check Cosmos DB for user status: {e}")
    
    # Check if user exists in memory
    if user_info.sub in in_memory_users:
        user_data = in_memory_users[user_info.sub]
        user_data.update({
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin or user_data.get("is_admin", False),
            "is_active": is_active,
            "updated_at": datetime.utcnow()
        })
        if user_id_from_cosmos:
            user_data["id"] = user_id_from_cosmos
        logger.info(f"Updated existing user: {user_info.email}")
    else:
        # Create new in-memory user
        user_data = {
            "id": user_id_from_cosmos or str(uuid.uuid4()),
            "auth0_sub": user_info.sub,
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin,
            "is_active": is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        in_memory_users[user_info.sub] = user_data
        logger.info(f"Created new user: {user_info.email} (admin={is_admin}, active={is_active})")
    
    return {
        "user": {
            "id": user_data["id"],
            "email": user_data["email"],
            "full_name": user_data["full_name"],
            "picture": user_data.get("picture"),
            "is_admin": user_data["is_admin"],
            "is_active": user_data["is_active"]
        }
    }

@router.post("/verify-entra-token", response_model=LoginResponse)
def verify_entra_token(token_request: dict, response: Response):
    """
    Verify Entra ID token and create/update user session
    Admin-only endpoint for Microsoft/Entra ID authentication
    
    Args:
        token_request: {"access_token": "...entra_id_token..."}
    """
    logger.info("Entra ID token verification requested")
    
    try:
        # Verify the token
        entra_payload = verify_entra_id_token(token_request.get("access_token", ""))
        
        # Extract user info from Entra ID token
        user_email = (
            entra_payload.get("preferred_username")
            or entra_payload.get("upn")
            or entra_payload.get("email")
            or entra_payload.get("unique_name")
        )
        user_name = entra_payload.get("name", "")
        user_sub = entra_payload.get("sub", entra_payload.get("oid", ""))

        if not user_email:
            logger.error("Entra ID token missing email/UPN claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Entra ID token missing email/UPN claim"
            )
        
        logger.info(f"Entra ID token verified for user: {user_email}")
        
        # Check if it's an @accellor.com admin
        is_admin = user_email.lower().endswith("@accellor.com")
        if not is_admin:
            logger.warning(f"Non-admin user {user_email} attempted Entra ID login")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Entra ID login is for admins only. Please use your regular credentials."
            )
        
        # Check Cosmos DB for user status
        is_active = True
        user_id_from_cosmos = None
        try:
            from backend.core.cosmos import users_container
            query = "SELECT * FROM users WHERE users.user_email = @email"
            items = list(users_container.query_items(
                query=query,
                parameters=[{"name": "@email", "value": user_email}],
                max_item_count=1
            ))
            if items:
                cosmos_user = items[0]
                is_active = cosmos_user.get("is_active", True)
                user_id_from_cosmos = cosmos_user.get("user_id")
                
                if not is_active:
                    logger.warning(f"Inactive admin attempted Entra ID login: {user_email}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your account has been deactivated. Please contact an administrator."
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check Cosmos DB: {e}")
        
        # Create or update user in memory
        if user_sub in in_memory_users:
            user_data = in_memory_users[user_sub]
            user_data.update({
                "email": user_email,
                "full_name": user_name,
                "is_admin": True,
                "is_active": is_active,
                "provider": "entra_id",
                "updated_at": datetime.utcnow()
            })
            if user_id_from_cosmos:
                user_data["id"] = user_id_from_cosmos
            logger.info(f"Updated existing Entra ID user: {user_email}")
        else:
            # Create new user
            user_data = {
                "id": user_id_from_cosmos or str(uuid.uuid4()),
                "auth0_sub": user_sub,
                "email": user_email,
                "full_name": user_name,
                "picture": None,
                "is_admin": True,
                "is_active": is_active,
                "provider": "entra_id",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            in_memory_users[user_sub] = user_data
            logger.info(f"Created new Entra ID user: {user_email} (admin=True)")
        
        # Store the original Entra ID token in the cookie for admin operations
        response.set_cookie(
            key="access_token",
            value=token_request.get("access_token"),
            path="/",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=3600  # 1 hour for Entra ID tokens
        )
        
        return {
            "user": {
                "id": user_data["id"],
                "email": user_data["email"],
                "full_name": user_data["full_name"],
                "picture": user_data.get("picture"),
                "is_admin": user_data["is_admin"],
                "is_active": user_data["is_active"]
            },
            "access_token": token_request.get("access_token"),
            "token_type": "Bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Entra ID token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Entra ID token verification failed"
        )

@router.post("/microsoft-callback", response_model=LoginResponse)
def microsoft_callback(user_info: UserInfo, response: Response):
    """
    Handle Microsoft/Azure AD authentication callback
    Create or update user in memory after Microsoft authentication
    Returns access token for session management
    """
    logger.info(f"Microsoft callback for user: {user_info.email}")
    
    # Check for admin based on @accellor.com domain
    is_admin = user_info.email.endswith("@accellor.com")
    
    # Check Cosmos DB for user status
    is_active = True
    user_id_from_cosmos = None
    try:
        from backend.core.cosmos import users_container
        query = "SELECT * FROM users WHERE users.user_email = @email"
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": user_info.email}],
            max_item_count=1
        ))
        if items:
            cosmos_user = items[0]
            is_active = cosmos_user.get("is_active", True)
            user_id_from_cosmos = cosmos_user.get("user_id")
            if cosmos_user.get("is_admin") is not None:
                is_admin = cosmos_user.get("is_admin")
            
            if not is_active:
                logger.warning(f"Inactive user attempted to login: {user_info.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been deactivated. Please contact an administrator."
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Could not check Cosmos DB for user status: {e}")
    
    # Check if user exists in memory
    if user_info.sub in in_memory_users:
        user_data = in_memory_users[user_info.sub]
        user_data.update({
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin or user_data.get("is_admin", False),
            "is_active": is_active,
            "updated_at": datetime.utcnow()
        })
        if user_id_from_cosmos:
            user_data["id"] = user_id_from_cosmos
        logger.info(f"Updated existing Microsoft user: {user_info.email}")
    else:
        # Create new in-memory user
        user_data = {
            "id": user_id_from_cosmos or str(uuid.uuid4()),
            "auth0_sub": user_info.sub,
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin,
            "is_active": is_active,
            "provider": "microsoft",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        in_memory_users[user_info.sub] = user_data
        logger.info(f"Created new Microsoft user: {user_info.email} (admin={is_admin}, active={is_active})")
    
    # Generate a dummy access token for session management
    # In production, you'd want to use a real JWT token
    import secrets
    access_token = secrets.token_urlsafe(32)
    
    # Set httpOnly cookie with access token
    response.set_cookie(
        key="access_token",
        value=access_token,
        path="/",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=86400
    )
    
    # Return token for sessionStorage fallback
    return {
        "user": {
            "id": user_data["id"],
            "email": user_data["email"],
            "full_name": user_data["full_name"],
            "picture": user_data.get("picture"),
            "is_admin": user_data["is_admin"],
            "is_active": user_data["is_active"]
        },
        "access_token": access_token,
        "token_type": "Bearer"
    }

@router.get("/me-info", response_model=UserResponse)
def get_current_user_info(auth0_user: dict = Depends(get_current_user_from_cookie)):
    """
    Get current user information from Auth0 token
    """
    user_info = extract_user_info(auth0_user)
    
    # Find user in memory
    user_data = in_memory_users.get(user_info["auth0_sub"])
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user_data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    return {
        "id": user_data["id"],
        "email": user_data["email"],
        "full_name": user_data["full_name"],
        "picture": user_data.get("picture"),
        "is_admin": user_data["is_admin"],
        "is_active": user_data["is_active"]
    }

@router.get("/admin/users")
def list_users(auth0_user: dict = Depends(get_current_user_from_cookie)):
    """List users for admin dashboard (requires authentication)"""
    user_info = extract_user_info(auth0_user)

    is_accellor = user_info.get("email", "").endswith("@accellor.com")
    try:
        from backend.core.cosmos import users_container

        # Check admin status in Cosmos if not Accellor domain (skip in dev)
        if IS_PRODUCTION and not is_accellor:
            user_query = "SELECT * FROM users WHERE users.user_id = @id"
            user_items = list(users_container.query_items(
                query=user_query,
                parameters=[{"name": "@id", "value": user_info.get("auth0_sub")}],
                max_item_count=1,
                enable_cross_partition_query=True
            ))
            if not user_items or not user_items[0].get("is_admin", False):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin access required"
                )

        # Return all users from Cosmos
        query = "SELECT * FROM users"
        items = list(users_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        users = []
        for item in items:
            created_at = item.get("created_at")
            users.append({
                "id": item.get("user_id"),
                "email": item.get("user_email"),
                "full_name": item.get("user_name"),
                "is_active": item.get("is_active", True),
                "is_admin": item.get("is_admin", item.get("user_email", "").endswith("@accellor.com")),
                "auth_provider": item.get("auth_provider", "auth0"),
                "created_at": created_at,
                "job_title": item.get("job_title"),
                "company_name": item.get("company_name"),
                "experience_level": item.get("experience_level")
            })

        return {"users": users}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin user list error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load users")

@router.delete("/admin/users/{user_id}")
def delete_user(user_id: str, auth0_user: dict = Depends(get_current_user_from_cookie)):
    """Delete a user (admin only)"""
    user_info = extract_user_info(auth0_user)
    
    logger.info(f"Delete user request: user_id={user_id}, requester={user_info['email']}")
    
    # Check if user is admin
    user_data = in_memory_users.get(user_info["auth0_sub"])
    is_admin = user_data and user_data.get("is_admin", False)
    is_accellor = user_info["email"].endswith("@accellor.com")
    
    logger.info(f"Admin check: is_admin={is_admin}, is_accellor={is_accellor}, has_user_data={bool(user_data)}")
    
    if not user_data or not is_admin:
        if not is_accellor:
            logger.warning(f"Admin access denied for {user_info['email']}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
    
    # Find user to delete
    user_to_delete = None
    for sub, data in in_memory_users.items():
        if data["id"] == user_id:
            user_to_delete = (sub, data)
            break
    
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user_sub, user_data_to_delete = user_to_delete
    
    # Prevent self-deletion
    if user_id == user_data["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    try:
        # Delete from Auth0 if configured
        auth0_domain = os.getenv("AUTH0_DOMAIN", "")
        auth0_mgmt_client_id = os.getenv("AUTH0_MGMT_CLIENT_ID", "")
        auth0_mgmt_client_secret = os.getenv("AUTH0_MGMT_CLIENT_SECRET", "")
        
        if all([auth0_domain, auth0_mgmt_client_id, auth0_mgmt_client_secret]):
            # Get M2M token
            token_response = requests.post(
                f"https://{auth0_domain}/oauth/token",
                json={
                    "client_id": auth0_mgmt_client_id,
                    "client_secret": auth0_mgmt_client_secret,
                    "audience": f"https://{auth0_domain}/api/v2/",
                    "grant_type": "client_credentials"
                },
                timeout=10
            )
            
            if token_response.status_code == 200:
                mgmt_token = token_response.json().get("access_token")
                
                # Delete user from Auth0
                delete_response = requests.delete(
                    f"https://{auth0_domain}/api/v2/users/{user_sub}",
                    headers={"Authorization": f"Bearer {mgmt_token}"},
                    timeout=10
                )
                
                if delete_response.status_code not in [200, 204]:
                    logger.warning(f"Failed to delete user from Auth0: {delete_response.status_code}")
        
        # Delete from Cosmos DB if exists
        try:
            from backend.core.cosmos import users_container
            query = "SELECT * FROM users WHERE users.user_id = @user_id"
            items = list(users_container.query_items(
                query=query,
                parameters=[{"name": "@user_id", "value": user_id}],
                max_item_count=1
            ))
            if items:
                cosmos_user = items[0]
                users_container.delete_item(item=cosmos_user["id"], partition_key=user_id)
                logger.info(f"Deleted user from Cosmos DB: {user_id}")
        except Exception as e:
            logger.warning(f"Could not delete user from Cosmos DB: {e}")
        
        # Delete from in-memory storage
        del in_memory_users[user_sub]
        logger.info(f"Deleted user: {user_data_to_delete['email']} ({user_id})")
        
        return {"message": "User deleted successfully", "user_id": user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
