"""Auth0 Management API integration for creating and managing users"""
import os
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class Auth0Manager:
    """Manages Auth0 user creation and updates via Management API"""
    
    def __init__(self):
        self.domain = os.getenv("AUTH0_DOMAIN", "")
        self.client_id = os.getenv("AUTH0_MGMT_CLIENT_ID", "")
        self.client_secret = os.getenv("AUTH0_MGMT_CLIENT_SECRET", "")
        self.access_token = None
        self.token_expiry = None
        
        if not all([self.domain, self.client_id, self.client_secret]):
            logger.warning("Auth0 Management API credentials not fully configured")
    
    def get_access_token(self):
        """Get M2M access token from Auth0"""
        if self.access_token and self.token_expiry and datetime.utcnow() < self.token_expiry:
            return self.access_token
        
        try:
            url = f"https://{self.domain}/oauth/token"
            payload = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "audience": f"https://{self.domain}/api/v2/",
                "grant_type": "client_credentials"
            }
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            self.access_token = data["access_token"]
            
            # Token expires in ~24 hours, refresh after 23 hours
            self.token_expiry = datetime.utcnow() + \
                                __import__('datetime').timedelta(seconds=data.get("expires_in", 86400) - 3600)
            
            return self.access_token
        except requests.exceptions.HTTPError as e:
            if "unauthorized_client" in str(e):
                logger.error(
                    "Auth0 M2M not properly configured. "
                    "Make sure AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET use a Machine-to-Machine application "
                    "with 'client_credentials' grant type enabled. "
                    "User creation in Auth0 will be skipped."
                )
            else:
                logger.error(f"Failed to get Auth0 access token: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to get Auth0 access token: {e}")
            raise
    
    def create_user(self, email, password, user_metadata=None, app_metadata=None):
        """
        Create a user in Auth0
        
        Args:
            email: User email
            password: User password
            user_metadata: Custom user data (job_title, company, etc.)
            app_metadata: Application-specific data
        
        Returns:
            Dict with user_id and other Auth0 user info
        """
        if not all([self.domain, self.client_id, self.client_secret]):
            logger.warning("Auth0 credentials not configured, skipping user creation")
            return {"user_id": None, "email": email}
        
        try:
            token = self.get_access_token()
            url = f"https://{self.domain}/api/v2/users"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "email": email,
                "password": password,
                "connection": "Username-Password-Authentication",
                "email_verified": False,
                "user_metadata": user_metadata or {},
                "app_metadata": app_metadata or {}
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            user = response.json()
            logger.info(f"✅ Created Auth0 user: {user.get('user_id')} ({email})")
            
            return user
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 409:
                logger.warning(f"Auth0 user already exists: {email}")
                # Try to get existing user
                return self.get_user_by_email(email)
            elif "unauthorized_client" in str(e.response.text):
                logger.warning(
                    f"Auth0 M2M not configured properly for user creation. "
                    f"Skipping Auth0 user creation for {email}. "
                    f"Please configure a Machine-to-Machine application in Auth0."
                )
                return {"user_id": None, "email": email}
            else:
                logger.error(f"Failed to create Auth0 user: {e.response.text}")
                raise
        except Exception as e:
            # If it's an unauthorized_client error from get_access_token, handle gracefully
            if "unauthorized_client" in str(e):
                logger.warning(
                    f"Auth0 M2M not configured properly. "
                    f"Skipping Auth0 user creation for {email}. "
                    f"Configure a Machine-to-Machine application with client_credentials grant enabled."
                )
                return {"user_id": None, "email": email}
            logger.error(f"Error creating Auth0 user: {e}")
            raise
    
    def get_user_by_email(self, email):
        """Get user from Auth0 by email"""
        try:
            token = self.get_access_token()
            url = f"https://{self.domain}/api/v2/users-by-email"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            params = {"email": email}
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            users = response.json()
            if users:
                logger.info(f"Found Auth0 user: {users[0].get('user_id')}")
                return users[0]
            
            return None
        except Exception as e:
            logger.error(f"Error fetching Auth0 user: {e}")
            return None
    
    def update_user(self, user_id, updates):
        """
        Update user data in Auth0
        
        Args:
            user_id: Auth0 user_id
            updates: Dict of fields to update
        
        Returns:
            Updated user data
        """
        if not all([self.domain, self.client_id, self.client_secret]):
            logger.warning("Auth0 credentials not configured, skipping user update")
            return {}
        
        try:
            token = self.get_access_token()
            url = f"https://{self.domain}/api/v2/users/{user_id}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            response = requests.patch(url, json=updates, headers=headers, timeout=10)
            response.raise_for_status()
            
            logger.info(f"✅ Updated Auth0 user: {user_id}")
            return response.json()
        except Exception as e:
            logger.error(f"Failed to update Auth0 user: {e}")
            raise
