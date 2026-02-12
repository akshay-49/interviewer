"""Azure Blob Storage utilities for managing interview recordings"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, BlobClient
from datetime import datetime, timedelta

# Load environment variables from .env file
root_dir = Path(__file__).parent.parent.parent
load_dotenv(root_dir / '.env')

logger = logging.getLogger(__name__)

class BlobStorageManager:
    def __init__(self, connection_string=None):
        """Initialize blob storage client"""
        self.connection_string = connection_string or os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        self.container_name = "interview-recordings"
        
        if not self.connection_string:
            logger.warning("Azure Storage connection string not configured. Blob storage disabled.")
            self.client = None
            return
        
        try:
            self.client = BlobServiceClient.from_connection_string(self.connection_string)
            # Ensure container exists
            self._ensure_container()
        except Exception as e:
            logger.error(f"Failed to initialize blob storage: {e}")
            self.client = None
    
    def _ensure_container(self):
        """Ensure the container exists"""
        try:
            container_client = self.client.get_container_client(self.container_name)
            container_client.get_container_properties()
        except Exception:
            try:
                self.client.create_container(name=self.container_name)
                logger.info(f"Created blob container: {self.container_name}")
            except Exception as e:
                logger.error(f"Failed to create blob container: {e}")
    
    def upload_recording(self, user_id: str, session_id: str, file_data: bytes, file_name: str = None):
        """
        Upload a recording to blob storage
        
        Args:
            user_id: User ID (organizes recordings by user)
            session_id: Interview session ID
            file_data: Binary file data
            file_name: Optional file name (defaults to timestamp)
        
        Returns:
            Blob URL or None if storage not available
        """
        if not self.client:
            logger.warning("Blob storage not available")
            return None
        
        try:
            if not file_name:
                file_name = f"recording_{datetime.utcnow().isoformat()}.wav"
            
            # Organize as: user_id/session_id/file_name
            blob_path = f"{user_id}/{session_id}/{file_name}"
            
            container_client = self.client.get_container_client(self.container_name)
            blob_client = container_client.get_blob_client(blob_path)
            
            blob_client.upload_blob(file_data, overwrite=True)
            logger.info(f"Uploaded recording: {blob_path}")
            
            return blob_client.url
        except Exception as e:
            logger.error(f"Failed to upload recording: {e}")
            return None
    
    def download_recording(self, user_id: str, session_id: str, file_name: str):
        """
        Download a recording from blob storage
        
        Args:
            user_id: User ID
            session_id: Interview session ID
            file_name: File name to download
        
        Returns:
            Binary file data or None if not found
        """
        if not self.client:
            logger.warning("Blob storage not available")
            return None
        
        try:
            blob_path = f"{user_id}/{session_id}/{file_name}"
            container_client = self.client.get_container_client(self.container_name)
            blob_client = container_client.get_blob_client(blob_path)
            
            return blob_client.download_blob().readall()
        except Exception as e:
            logger.error(f"Failed to download recording: {e}")
            return None
    
    def list_user_recordings(self, user_id: str):
        """
        List all recordings for a user
        
        Args:
            user_id: User ID
        
        Returns:
            List of blob names and metadata
        """
        if not self.client:
            return []
        
        try:
            container_client = self.client.get_container_client(self.container_name)
            blobs = container_client.list_blobs(name_starts_with=f"{user_id}/")
            
            recordings = []
            for blob in blobs:
                recordings.append({
                    "name": blob.name,
                    "size": blob.size,
                    "created": blob.creation_time,
                    "modified": blob.last_modified
                })
            
            return recordings
        except Exception as e:
            logger.error(f"Failed to list recordings: {e}")
            return []
    
    def delete_recording(self, user_id: str, session_id: str, file_name: str):
        """Delete a recording from blob storage"""
        if not self.client:
            return False
        
        try:
            blob_path = f"{user_id}/{session_id}/{file_name}"
            container_client = self.client.get_container_client(self.container_name)
            blob_client = container_client.get_blob_client(blob_path)
            
            blob_client.delete_blob()
            logger.info(f"Deleted recording: {blob_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete recording: {e}")
            return False
    
    def get_sas_url(self, user_id: str, session_id: str, file_name: str, expiry_hours: int = 24):
        """
        Generate a shared access signature URL for a recording
        
        Args:
            user_id: User ID
            session_id: Interview session ID
            file_name: File name
            expiry_hours: URL expiry time in hours
        
        Returns:
            SAS URL or None
        """
        if not self.client:
            logger.warning("❌ Blob client not available for SAS URL generation")
            return None
        
        try:
            from azure.storage.blob import generate_blob_sas, BlobSasPermissions
            
            account_name = self.client.account_name
            account_key = os.getenv('AZURE_STORAGE_ACCOUNT_KEY')
            
            logger.info(f"📝 SAS URL Generation: account_name={account_name}, has_key={bool(account_key)}")
            
            if not account_key:
                logger.error("❌ AZURE_STORAGE_ACCOUNT_KEY environment variable not set!")
                return None
            
            blob_path = f"{user_id}/{session_id}/{file_name}"
            
            sas_token = generate_blob_sas(
                account_name=account_name,
                container_name=self.container_name,
                blob_name=blob_path,
                account_key=account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
            )
            
            sas_url = f"https://{account_name}.blob.core.windows.net/{self.container_name}/{blob_path}?{sas_token}"
            logger.info(f"✅ SAS URL generated successfully")
            logger.debug(f"   SAS URL: {sas_url[:100]}...")  # Log first 100 chars for privacy
            return sas_url
        except Exception as e:
            logger.error(f"❌ Failed to generate SAS URL: {e}", exc_info=True)
            return None


# Global blob storage manager instance
blob_manager = BlobStorageManager()

def get_blob_manager():
    """Get the global blob storage manager"""
    return blob_manager
