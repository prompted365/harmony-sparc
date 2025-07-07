"""
Custom exceptions for the EESystem Content Curation Platform
"""
from typing import Optional, Dict, Any


class CustomException(Exception):
    """Base custom exception class"""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(CustomException):
    """Validation error"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details=details
        )


class AuthenticationError(CustomException):
    """Authentication error"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=401
        )


class AuthorizationError(CustomException):
    """Authorization error"""
    
    def __init__(self, message: str = "Access denied"):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=403
        )


class NotFoundError(CustomException):
    """Resource not found error"""
    
    def __init__(self, message: str = "Resource not found"):
        super().__init__(
            message=message,
            error_code="NOT_FOUND",
            status_code=404
        )


class ConflictError(CustomException):
    """Resource conflict error"""
    
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(
            message=message,
            error_code="CONFLICT",
            status_code=409
        )


class RateLimitError(CustomException):
    """Rate limit exceeded error"""
    
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429
        )


class DatabaseError(CustomException):
    """Database operation error"""
    
    def __init__(self, message: str = "Database operation failed"):
        super().__init__(
            message=message,
            error_code="DATABASE_ERROR",
            status_code=500
        )


class ExternalServiceError(CustomException):
    """External service error"""
    
    def __init__(self, message: str = "External service unavailable", service: str = "unknown"):
        super().__init__(
            message=message,
            error_code="EXTERNAL_SERVICE_ERROR",
            status_code=503,
            details={"service": service}
        )


class FileUploadError(CustomException):
    """File upload error"""
    
    def __init__(self, message: str = "File upload failed"):
        super().__init__(
            message=message,
            error_code="FILE_UPLOAD_ERROR",
            status_code=400
        )


class AIProcessingError(CustomException):
    """AI processing error"""
    
    def __init__(self, message: str = "AI processing failed"):
        super().__init__(
            message=message,
            error_code="AI_PROCESSING_ERROR",
            status_code=500
        )


class ContentGenerationError(CustomException):
    """Content generation error"""
    
    def __init__(self, message: str = "Content generation failed"):
        super().__init__(
            message=message,
            error_code="CONTENT_GENERATION_ERROR",
            status_code=500
        )


class PublishingError(CustomException):
    """Publishing error"""
    
    def __init__(self, message: str = "Publishing failed"):
        super().__init__(
            message=message,
            error_code="PUBLISHING_ERROR",
            status_code=500
        )


class BrandComplianceError(CustomException):
    """Brand compliance error"""
    
    def __init__(self, message: str = "Brand compliance check failed"):
        super().__init__(
            message=message,
            error_code="BRAND_COMPLIANCE_ERROR",
            status_code=422
        )


class MemoryError(CustomException):
    """Memory management error"""
    
    def __init__(self, message: str = "Memory operation failed"):
        super().__init__(
            message=message,
            error_code="MEMORY_ERROR",
            status_code=500
        )


class AgentCoordinationError(CustomException):
    """Agent coordination error"""
    
    def __init__(self, message: str = "Agent coordination failed"):
        super().__init__(
            message=message,
            error_code="AGENT_COORDINATION_ERROR",
            status_code=500
        )


class SearchError(CustomException):
    """Search operation error"""
    
    def __init__(self, message: str = "Search operation failed"):
        super().__init__(
            message=message,
            error_code="SEARCH_ERROR",
            status_code=500
        )


class AnalyticsError(CustomException):
    """Analytics error"""
    
    def __init__(self, message: str = "Analytics operation failed"):
        super().__init__(
            message=message,
            error_code="ANALYTICS_ERROR",
            status_code=500
        )