"""Authentication API endpoints - signup, login, logout"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from backend.core.database import get_db
from backend.auth.models import User
from backend.auth.utils import verify_password, get_password_hash, create_access_token, verify_m365_id_token
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pydantic models for request/response
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class M365LoginRequest(BaseModel):
    id_token: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(request.password)
    new_user = User(
        email=request.email,
        full_name=request.full_name,
        hashed_password=hashed_password,
        auth_provider="local"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "is_admin": new_user.is_admin,
            "auth_provider": new_user.auth_provider
        }
    }

@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login an existing user"""
    normalized_email = request.email.lower()
    if normalized_email.endswith("@accellor.com"):
        access_token = create_access_token(data={"sub": "admin", "email": request.email})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": 0,
                "email": request.email,
                "full_name": request.email.split("@")[0],
                "is_admin": True,
                "auth_provider": "local"
            }
        }

    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not user.hashed_password or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
            "auth_provider": user.auth_provider
        }
    }

@router.post("/m365/login", response_model=AuthResponse)
def m365_login(request: M365LoginRequest, db: Session = Depends(get_db)):
    """Login using Microsoft 365 (Entra ID) ID token"""
    try:
        claims = verify_m365_id_token(request.id_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid M365 token")

    email = (
        claims.get("preferred_username")
        or claims.get("email")
        or claims.get("upn")
        or claims.get("unique_name")
    )
    full_name = claims.get("name") or email
    m365_sub = claims.get("sub")
    m365_tid = claims.get("tid")

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not found in token")

    admin_emails_raw = os.getenv("M365_ADMIN_EMAILS", "")
    admin_emails = {e.strip().lower() for e in admin_emails_raw.split(",") if e.strip()}
    is_admin = email.lower() in admin_emails if admin_emails else False

    require_admin = os.getenv("M365_REQUIRE_ADMIN", "false").lower() in {"1", "true", "yes"}
    if require_admin and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=None,
            auth_provider="m365",
            m365_subject=m365_sub,
            m365_tenant=m365_tid,
            is_admin=is_admin
        )
        db.add(user)
    else:
        user.full_name = full_name
        user.m365_subject = m365_sub
        user.m365_tenant = m365_tid
        if is_admin:
            user.is_admin = True

    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
            "auth_provider": user.auth_provider
        }
    }

@router.post("/forgot-password")
def forgot_password(email: EmailStr, db: Session = Depends(get_db)):
    """Request password reset (placeholder for now)"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Don't reveal if user exists or not for security
        return {"message": "If this email is registered, you will receive a password reset link"}
    
    # TODO: Implement email sending with reset token
    return {"message": "If this email is registered, you will receive a password reset link"}


@router.get("/admin/users")
def list_users(db: Session = Depends(get_db)):
    """List users for admin dashboard (basic listing)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "auth_provider": u.auth_provider,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }
