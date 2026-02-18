"""Authentication API endpoints - Invite-based only (Auth0 removed)"""
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from backend.core.cosmos import users_container, serialize_for_cosmos
from backend.auth.auth0_utils import verify_entra_id_token
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import os


def _get_dev_user(request: Request) -> dict:
    """Development mode user - always admin in dev, requires auth in production"""
    if os.getenv("ENVIRONMENT", "development") != "production":
        return {
            "user_id": "dev|admin",
            "email": "admin@dev.local",
            "is_admin": True
        }
    # In production, would need real auth
    raise HTTPException(status_code=401, detail="Authentication required")
import uuid
import requests
import os
import time
import secrets

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Environment check for secure cookies
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

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


def _is_dev_mode() -> bool:
    """Check if running in development mode"""
    return os.getenv("ENVIRONMENT", "development") != "production"


@router.get("/login")
def login(request: Request):
    """Auth0 login disabled - Use invite system instead."""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Auth0 login is not supported. Please use the invite system."
    )


@router.get("/callback")
def auth_callback(request: Request):
    """Auth0 callback disabled - Use invite system instead."""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Auth0 is not supported. Please use the invite system."
    )


@router.get("/logout")
def logout(request: Request):
    """Logout and clear session cookie"""
    response = RedirectResponse("http://localhost:5173/auth/silent-logout")
    response.delete_cookie("access_token", path="/")
    return response


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(_get_dev_user)):
    """Return current user from session - Development mode only."""
    return {
        "id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "full_name": current_user.get("email"),
        "picture": None,
        "is_admin": current_user.get("is_admin", False),
        "is_active": True
    }

@router.post("/accept-invite")
def accept_invite(request: AcceptInviteRequest):
    """Accept an invite and auto-register user without Auth0."""
    invite_code = request.invite_code
    if not invite_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite_code is required")

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

        candidate_email = (invite.get("candidate_email") or "").lower()
        candidate_name = invite.get("candidate_name") or candidate_email.split("@")[0]
        
        if not candidate_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite missing candidate email")

        # Generate a simple user ID based on email (no Auth0)
        user_id = str(uuid.uuid4())
        now_iso = datetime.utcnow().isoformat()

        # Create or update user record in Cosmos DB
        user_query = "SELECT * FROM users WHERE users.user_email = @email"
        user_items = list(users_container.query_items(
            query=user_query,
            parameters=[{"name": "@email", "value": candidate_email}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))

        user_doc = {
            "id": user_id,
            "user_id": user_id,
            "user_name": candidate_name,
            "user_email": candidate_email,
            "role": invite.get("role"),
            "seniority_level": invite.get("seniority_level"),
            "job_title": invite.get("role"),
            "experience_level": invite.get("seniority_level"),
            "job_description": invite.get("job_description"),
            "invite_code": invite_code,
            "invite_status": "accepted",
            "auth_provider": "invite",  # No Auth0 needed
            "is_admin": False,
            "is_active": True,
            "access_enabled": True,
            "invited_by_admin": True,
            "registered_at": now_iso,
            "updated_at": now_iso
        }

        if user_items:
            # User already exists, update their info
            existing_user = user_items[0]
            user_id = existing_user.get("user_id", user_id)
            user_doc["id"] = user_id
            user_doc["user_id"] = user_id
            user_doc["created_at"] = existing_user.get("created_at") or now_iso
        else:
            user_doc["created_at"] = now_iso

        users_container.upsert_item(serialize_for_cosmos(user_doc))

        try:
            invites_container.delete_item(item=invite["id"], partition_key=invite.get("invite_code"))
        except Exception as delete_error:
            logger.warning(f"Failed to delete used invite {invite_code}: {delete_error}")

        return {
            "success": True,
            "message": "Invite accepted",
            "user_id": user_id,
            "email": candidate_email,
            "user": {
                "id": user_id,
                "email": candidate_email,
                "full_name": candidate_name,
                "is_admin": False,
                "is_active": True
            },
            "recording_mode": invite.get("recording_mode", "audio"),
            "role": invite.get("role"),
            "seniority_level": invite.get("seniority_level")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting invite: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to accept invite")

@router.post("/sync-user", response_model=SyncUserResponse)
def sync_user(current_user: dict = Depends(_get_dev_user)):
    """Sync user profile into Cosmos DB for admin visibility (Auth0 removed - invite-only)."""
    # In invite-only mode, users are already in Cosmos DB from invite acceptance
    # This endpoint is now just for dev/testing purposes
    if not _is_dev_mode():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not available")
    
    user_email = current_user.get("email", "").lower()
    user_name = current_user.get("full_name") or user_email
    user_id = current_user.get("id", "dev-admin")

    try:
        now_iso = datetime.utcnow().isoformat()

        user_query = "SELECT * FROM users WHERE users.user_id = @id"
        user_items = list(users_container.query_items(
            query=user_query,
            parameters=[{"name": "@id", "value": user_id}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))

        user_doc = {
            "id": user_id,
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "auth_provider": "invite-only",
            "is_admin": True,
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

        return {
            "user": {
                "id": user_id,
                "email": user_email,
                "full_name": user_name,
                "is_admin": True,
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
    Auth0 callback disabled - Use invite system instead
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Auth0 is not supported. Please use the invite system."
    )

@router.post("/verify-entra-token", response_model=LoginResponse)
def verify_entra_token(token_request: dict, response: Response):
    """
    Verify Entra ID token and create/update admin session
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
                detail="Entra ID login is for admins only (@accellor.com domain required)"
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
    Handle Microsoft/Azure AD authentication callback for admin login
    Create or update user in memory after Microsoft authentication
    Returns access token for session management
    """
    logger.info(f"Microsoft callback for user: {user_info.email}")
    
    # Check for admin based on @accellor.com domain
    is_admin = user_info.email.endswith("@accellor.com")
    
    if not is_admin:
        logger.warning(f"Non-admin user {user_info.email} attempted Microsoft login")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Microsoft login is for admins only (@accellor.com domain required)"
        )
    
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
                logger.warning(f"Inactive admin attempted Microsoft login: {user_info.email}")
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
            "is_admin": True,
            "is_active": is_active,
            "provider": "microsoft",
            "updated_at": datetime.utcnow()
        })
        if user_id_from_cosmos:
            user_data["id"] = user_id_from_cosmos
        logger.info(f"Updated existing Microsoft admin user: {user_info.email}")
    else:
        # Create new in-memory user
        user_data = {
            "id": user_id_from_cosmos or str(uuid.uuid4()),
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": True,
            "is_active": is_active,
            "provider": "microsoft",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        in_memory_users[user_info.sub] = user_data
        logger.info(f"Created new Microsoft admin user: {user_info.email}")
    
    # Generate access token for session management
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
def get_current_user_info(current_user: dict = Depends(_get_dev_user)):
    """
    Get current user information (Auth0 removed - invite-only mode)
    """
    # In dev mode, return the dev user info
    if not _is_dev_mode():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User authentication required"
        )
    
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "picture": None,
        "is_admin": current_user.get("is_admin", False),
        "is_active": True
    }

@router.get("/admin/users")
def list_users(current_user: dict = Depends(_get_dev_user)):
    """List users for admin dashboard (Auth0 removed - dev-only)"""
    if not _is_dev_mode():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User authentication required"
        )
    
    try:
        from backend.core.cosmos import users_container

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
                "is_admin": item.get("is_admin", False),
                "auth_provider": item.get("auth_provider", "invite-only"),
                "created_at": created_at,
                "job_title": item.get("job_title"),
                "company_name": item.get("company_name"),
                "experience_level": item.get("experience_level")
            })

        return {"users": users}
    except Exception as e:
        logger.error(f"Admin user list error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load users")

@router.delete("/admin/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(_get_dev_user)):
    """Delete a user (admin only - Auth0 removed)"""
    if not _is_dev_mode():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User authentication required"
        )
    
    logger.info(f"Delete user request: user_id={user_id}, requester={current_user['email']}")
    
    # In dev mode, just delete from Cosmos DB
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
            return {"message": "User deleted successfully", "user_id": user_id}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
