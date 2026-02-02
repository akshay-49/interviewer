"""Authentication API endpoints with Auth0 integration"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from backend.auth.auth0_utils import get_current_user, extract_user_info
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory user storage (primary storage)
in_memory_users = {}

# Pydantic models for request/response
class UserInfo(BaseModel):
    sub: str
    email: str
    name: str
    picture: str = None
    email_verified: bool = False

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    picture: str = None
    is_admin: bool
    is_active: bool

class AuthResponse(BaseModel):
    user: UserResponse

@router.post("/callback", response_model=AuthResponse)
def auth_callback(user_info: UserInfo):
    """
    Handle Auth0 authentication callback
    Create or update user in memory after Auth0 authentication
    """
    # Check for admin based on @accellor.com domain
    is_admin = user_info.email.endswith("@accellor.com")
    
    # Check if user exists in memory
    if user_info.sub in in_memory_users:
        user_data = in_memory_users[user_info.sub]
        user_data.update({
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin or user_data.get("is_admin", False),
            "updated_at": datetime.utcnow()
        })
        logger.info(f"Updated existing user: {user_info.email}")
    else:
        # Create new in-memory user
        user_data = {
            "id": str(uuid.uuid4()),
            "auth0_sub": user_info.sub,
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        in_memory_users[user_info.sub] = user_data
        logger.info(f"Created new user: {user_info.email} (admin={is_admin})")
    
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

@router.post("/microsoft-callback", response_model=AuthResponse)
def microsoft_callback(user_info: UserInfo):
    """
    Handle Microsoft/Azure AD authentication callback
    Create or update user in memory after Microsoft authentication
    """
    # Check for admin based on @accellor.com domain
    is_admin = user_info.email.endswith("@accellor.com")
    
    # Check if user exists in memory
    if user_info.sub in in_memory_users:
        user_data = in_memory_users[user_info.sub]
        user_data.update({
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin or user_data.get("is_admin", False),
            "updated_at": datetime.utcnow()
        })
        logger.info(f"Updated existing Microsoft user: {user_info.email}")
    else:
        # Create new in-memory user
        user_data = {
            "id": str(uuid.uuid4()),
            "auth0_sub": user_info.sub,
            "email": user_info.email,
            "full_name": user_info.name,
            "picture": user_info.picture,
            "is_admin": is_admin,
            "is_active": True,
            "provider": "microsoft",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        in_memory_users[user_info.sub] = user_data
        logger.info(f"Created new Microsoft user: {user_info.email} (admin={is_admin})")
    
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
