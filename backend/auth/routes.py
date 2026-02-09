"""Authentication API endpoints with Auth0 integration"""
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from pydantic import BaseModel
from typing import Optional
from backend.auth.auth0_utils import get_current_user, get_current_user_from_cookie, extract_user_info, verify_entra_id_token
from backend.core.cosmos import users_container, serialize_for_cosmos
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import uuid
import requests
import os
import time
import secrets
import jwt
import bcrypt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Load JWT secret for local auth - MUST be set in production
JWT_SECRET = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET_KEY must be set in environment variables")

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

def _cache_user(user_data: dict) -> None:
    """Cache user data in memory using auth0_sub as key."""
    if not user_data:
        return
    user_sub = user_data.get("auth0_sub")
    if user_sub:
        in_memory_users[user_sub] = user_data

def _find_user_in_memory(email: str) -> Optional[dict]:
    """Find user in memory by email."""
    for user in in_memory_users.values():
        if user.get("email") == email:
            return user
    return None

def _find_user_in_cosmos(email: str) -> Optional[dict]:
    """Find user in Cosmos DB by email and cache result."""
    try:
        query = "SELECT * FROM users u WHERE u.email = @email"
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email}],
            enable_cross_partition_query=True,
            max_item_count=1
        ))
        user = items[0] if items else None
        if user:
            _cache_user(user)
        return user
    except Exception as e:
        logger.error(f"Error querying user by email from Cosmos DB: {e}")
        return None

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

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "Bearer"

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class RegisterResponse(BaseModel):
    user: UserResponse
    message: str = "User registered successfully"

class AcceptInviteRequest(BaseModel):
    invite_code: str

class SyncUserResponse(BaseModel):
    user: UserResponse

@router.post("/register", response_model=RegisterResponse)
def register(request: RegisterRequest, req: Request, response: Response):
    """
    Register a new user without Auth0 - uses in-memory storage only
    """
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip, "register"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later."
        )
    
    try:
        # Check if user already exists in memory or Cosmos DB
        existing_user = _find_user_in_memory(request.email) or _find_user_in_cosmos(request.email)
        
        if existing_user:
            logger.warning(f"User already exists: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Create user in memory
        user_id = str(uuid.uuid4())
        user_sub = f"local|{user_id}"
        
        # Hash password securely with bcrypt
        password_hash = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        user_data = {
            "id": user_id,
            "auth0_sub": user_sub,
            "email": request.email,
            "full_name": request.name or request.email,
            "picture": None,
            "password_hash": password_hash,
            "is_admin": False,
            "is_active": True,
            "provider": "local",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Persist to Cosmos DB and cache in memory
        cosmos_user = {
            **user_data,
            "user_id": user_id,
            "id": user_id
        }
        users_container.upsert_item(serialize_for_cosmos(cosmos_user))
        _cache_user(user_data)
        logger.info(f"✅ Created local user: {user_id} ({request.email})")
        
        # Generate access token
        token_payload = {
            "sub": user_sub,
            "email": request.email,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        # Set httpOnly cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            path="/",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=86400
        )
        
        return RegisterResponse(
            user=UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                picture=user_data.get("picture"),
                is_admin=user_data["is_admin"],
                is_active=user_data["is_active"]
            ),
            message="User registered successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )

@router.post("/accept-invite")
def accept_invite(request: AcceptInviteRequest, auth0_user: dict = Depends(get_current_user)):
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
def sync_user(auth0_user: dict = Depends(get_current_user)):
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

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, req: Request, response: Response):
    """
    Login with email and password using in-memory storage
    Sets httpOnly cookie with access token and returns user info
    """
    # Rate limiting
    client_ip = req.client.host
    if not check_rate_limit(client_ip, "login"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    try:
        # Find user in memory or Cosmos DB
        user_data = _find_user_in_memory(request.email)
        if not user_data:
            user_data = _find_user_in_cosmos(request.email)
        
        if not user_data:
            logger.warning(f"Login failed - user not found: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check password using bcrypt
        stored_hash = user_data.get("password_hash", "").encode('utf-8')
        if not bcrypt.checkpw(request.password.encode('utf-8'), stored_hash):
            logger.warning(f"Login failed - invalid password: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check if user is active
        if not user_data.get("is_active", True):
            logger.warning(f"Inactive user attempted to login: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact an administrator."
            )
        
        logger.info(f"Login successful for {request.email}")
        
        # Generate access token
        token_payload = {
            "sub": user_data["auth0_sub"],
            "email": user_data["email"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        # Set httpOnly cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            path="/",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=86400
        )
        
        return LoginResponse(
            user=UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                picture=user_data.get("picture"),
                is_admin=user_data["is_admin"],
                is_active=user_data["is_active"]
            ),
            access_token=access_token,
            token_type="Bearer"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

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

@router.get("/me", response_model=UserResponse)
def get_current_user_info(auth0_user: dict = Depends(get_current_user)):
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
def list_users(auth0_user: dict = Depends(get_current_user)):
    """List users for admin dashboard (requires authentication)"""
    user_info = extract_user_info(auth0_user)
    
    # Check if user is admin
    user_data = in_memory_users.get(user_info["auth0_sub"])
    if not user_data or not user_data.get("is_admin", False):
        # Allow @accellor.com users
        if not user_info["email"].endswith("@accellor.com"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
    
    # Return all users from memory
    users = list(in_memory_users.values())
    
    return {
        "users": [
            {
                "id": u["id"],
                "email": u["email"],
                "full_name": u["full_name"],
                "is_active": u.get("is_active", True),
                "is_admin": u.get("is_admin", False),
                "auth_provider": "auth0",
                "created_at": u["created_at"].isoformat() if u.get("created_at") else None,
            }
            for u in users
        ]
    }

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
