"""
Encryption service for sensitive data
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional, Union
import logging
from app.config.settings import settings

logger = logging.getLogger(__name__)


class EncryptionService:
    """Service for encrypting and decrypting sensitive data"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        """Initialize encryption service with key"""
        self.encryption_key = encryption_key or settings.SECRET_KEY
        self._fernet = self._get_fernet()
    
    def _get_fernet(self) -> Fernet:
        """Get Fernet encryption instance"""
        try:
            # Generate key from password
            password = self.encryption_key.encode()
            salt = b'salt_'  # In production, use a proper salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password))
            return Fernet(key)
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise
    
    def encrypt(self, data: Union[str, bytes]) -> str:
        """Encrypt data and return base64 encoded string"""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            encrypted_data = self._fernet.encrypt(data)
            return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded string and return original data"""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode('utf-8'))
            decrypted_data = self._fernet.decrypt(encrypted_bytes)
            return decrypted_data.decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise
    
    def is_encrypted(self, data: str) -> bool:
        """Check if data appears to be encrypted"""
        try:
            # Try to decode as base64 and decrypt
            self.decrypt(data)
            return True
        except:
            return False
    
    @staticmethod
    def generate_key() -> str:
        """Generate a new encryption key"""
        return Fernet.generate_key().decode('utf-8')


# Global encryption service instance
encryption_service = EncryptionService()


def encrypt_value(value: str) -> str:
    """Encrypt a value using the global encryption service"""
    return encryption_service.encrypt(value)


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a value using the global encryption service"""
    return encryption_service.decrypt(encrypted_value)


def is_encrypted_value(value: str) -> bool:
    """Check if a value is encrypted"""
    return encryption_service.is_encrypted(value)