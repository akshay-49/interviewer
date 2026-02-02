"""User authentication models for Cosmos DB (MongoDB) with Auth0"""
from datetime import datetime
from bson import ObjectId
from typing import Optional

class User:
    """User document model for MongoDB with Auth0 integration"""
    
    def __init__(
        self,
        email: str,
        full_name: str,
        auth0_sub: Optional[str] = None,  # Auth0 user ID
        picture: Optional[str] = None,
        is_active: bool = True,
        is_admin: bool = False,
        _id: Optional[ObjectId] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self._id = _id or ObjectId()
        self.email = email
        self.full_name = full_name
        self.auth0_sub = auth0_sub
        self.picture = picture
        self.is_active = is_active
        self.is_admin = is_admin
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self):
        """Convert user to dictionary for MongoDB storage"""
        return {
            "_id": self._id,
            "email": self.email,
            "full_name": self.full_name,
            "auth0_sub": self.auth0_sub,
            "picture": self.picture,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @staticmethod
    def from_dict(data: dict):
        """Create User object from MongoDB document"""
        if "_id" in data:
            data["_id"] = data["_id"]
        return User(**data)
    
    def get_id(self):
        """Get user ID as string for JWT"""
        return str(self._id)
