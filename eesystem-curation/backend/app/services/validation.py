"""
Validation service for settings and configurations
"""
import re
from typing import Any, Dict, List, Tuple, Union
import json
from datetime import datetime
import ipaddress
import logging

logger = logging.getLogger(__name__)


class ValidationService:
    """Service for validating settings and configuration values"""
    
    @staticmethod
    def validate_string(value: Any, rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate string value"""
        errors = []
        
        if not isinstance(value, str):
            errors.append("Value must be a string")
            return False, errors
        
        # Length validation
        if "min_length" in rules and len(value) < rules["min_length"]:
            errors.append(f"String must be at least {rules['min_length']} characters")
        
        if "max_length" in rules and len(value) > rules["max_length"]:
            errors.append(f"String must be at most {rules['max_length']} characters")
        
        # Pattern validation
        if "pattern" in rules:
            if not re.match(rules["pattern"], value):
                errors.append(f"String must match pattern: {rules['pattern']}")
        
        # Enum validation
        if "enum" in rules:
            if value not in rules["enum"]:
                errors.append(f"Value must be one of: {', '.join(rules['enum'])}")
        
        # Custom validations
        if "format" in rules:
            format_type = rules["format"]
            
            if format_type == "email":
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, value):
                    errors.append("Invalid email format")
            
            elif format_type == "url":
                url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
                if not re.match(url_pattern, value):
                    errors.append("Invalid URL format")
            
            elif format_type == "uuid":
                uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                if not re.match(uuid_pattern, value.lower()):
                    errors.append("Invalid UUID format")
            
            elif format_type == "ipv4":
                try:
                    ipaddress.IPv4Address(value)
                except ValueError:
                    errors.append("Invalid IPv4 address")
            
            elif format_type == "ipv6":
                try:
                    ipaddress.IPv6Address(value)
                except ValueError:
                    errors.append("Invalid IPv6 address")
            
            elif format_type == "jwt":
                # Basic JWT format validation
                parts = value.split('.')
                if len(parts) != 3:
                    errors.append("Invalid JWT format")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_number(value: Any, rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate number value"""
        errors = []
        
        if not isinstance(value, (int, float)):
            try:
                value = float(value) if isinstance(value, str) else value
            except (ValueError, TypeError):
                errors.append("Value must be a number")
                return False, errors
        
        # Range validation
        if "minimum" in rules and value < rules["minimum"]:
            errors.append(f"Number must be at least {rules['minimum']}")
        
        if "maximum" in rules and value > rules["maximum"]:
            errors.append(f"Number must be at most {rules['maximum']}")
        
        # Exclusive range validation
        if "exclusive_minimum" in rules and value <= rules["exclusive_minimum"]:
            errors.append(f"Number must be greater than {rules['exclusive_minimum']}")
        
        if "exclusive_maximum" in rules and value >= rules["exclusive_maximum"]:
            errors.append(f"Number must be less than {rules['exclusive_maximum']}")
        
        # Multiple validation
        if "multiple_of" in rules and value % rules["multiple_of"] != 0:
            errors.append(f"Number must be a multiple of {rules['multiple_of']}")
        
        # Integer validation
        if rules.get("integer_only", False) and not isinstance(value, int):
            if isinstance(value, float) and not value.is_integer():
                errors.append("Value must be an integer")
        
        # Positive validation
        if rules.get("positive", False) and value <= 0:
            errors.append("Value must be positive")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_boolean(value: Any, rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate boolean value"""
        errors = []
        
        if not isinstance(value, bool):
            if isinstance(value, str):
                if value.lower() in ['true', '1', 'yes', 'on']:
                    value = True
                elif value.lower() in ['false', '0', 'no', 'off']:
                    value = False
                else:
                    errors.append("Value must be a boolean or boolean string")
            else:
                errors.append("Value must be a boolean")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_json(value: Any, rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate JSON value"""
        errors = []
        
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                errors.append("Invalid JSON format")
                return False, errors
        
        if not isinstance(value, (dict, list)):
            errors.append("Value must be a valid JSON object or array")
            return False, errors
        
        # Schema validation (basic)
        if "schema" in rules:
            schema_errors = ValidationService.validate_json_schema(value, rules["schema"])
            errors.extend(schema_errors)
        
        # Required keys validation
        if isinstance(value, dict) and "required_keys" in rules:
            for key in rules["required_keys"]:
                if key not in value:
                    errors.append(f"Missing required key: {key}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_json_schema(value: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Basic JSON schema validation"""
        errors = []
        
        # Type validation
        if "type" in schema:
            expected_type = schema["type"]
            if expected_type == "object" and not isinstance(value, dict):
                errors.append("Value must be an object")
            elif expected_type == "array" and not isinstance(value, list):
                errors.append("Value must be an array")
        
        # Properties validation
        if "properties" in schema and isinstance(value, dict):
            for prop, prop_schema in schema["properties"].items():
                if prop in value:
                    prop_errors = ValidationService.validate_json_schema(
                        value[prop], prop_schema
                    )
                    errors.extend([f"{prop}: {error}" for error in prop_errors])
        
        # Required properties
        if "required" in schema and isinstance(value, dict):
            for required_prop in schema["required"]:
                if required_prop not in value:
                    errors.append(f"Missing required property: {required_prop}")
        
        return errors
    
    @staticmethod
    def validate_encrypted(value: Any, rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate encrypted value"""
        errors = []
        
        if not isinstance(value, str):
            errors.append("Encrypted value must be a string")
            return False, errors
        
        # Basic base64 validation
        try:
            import base64
            base64.b64decode(value.encode('utf-8'))
        except Exception:
            errors.append("Invalid encrypted format")
        
        return len(errors) == 0, errors


def validate_setting_value(value: Any, validation_rules: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate a setting value against validation rules"""
    if not validation_rules:
        return True, []
    
    data_type = validation_rules.get("type", "string")
    
    try:
        if data_type == "string":
            return ValidationService.validate_string(value, validation_rules)
        elif data_type == "number":
            return ValidationService.validate_number(value, validation_rules)
        elif data_type == "boolean":
            return ValidationService.validate_boolean(value, validation_rules)
        elif data_type == "json":
            return ValidationService.validate_json(value, validation_rules)
        elif data_type == "encrypted":
            return ValidationService.validate_encrypted(value, validation_rules)
        else:
            return False, [f"Unknown data type: {data_type}"]
    
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return False, [f"Validation failed: {str(e)}"]


def validate_database_connection(connection_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate database connection parameters"""
    errors = []
    
    # Required fields
    required_fields = ["connection_name", "connection_type"]
    for field in required_fields:
        if not connection_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    connection_type = connection_data.get("connection_type")
    
    if connection_type == "postgresql":
        if not connection_data.get("host"):
            errors.append("PostgreSQL connection requires host")
        if not connection_data.get("port"):
            errors.append("PostgreSQL connection requires port")
        if not connection_data.get("database_name"):
            errors.append("PostgreSQL connection requires database_name")
    
    elif connection_type == "astradb":
        if not connection_data.get("connection_string"):
            errors.append("AstraDB connection requires connection_string")
    
    elif connection_type == "redis":
        if not connection_data.get("host"):
            errors.append("Redis connection requires host")
        if not connection_data.get("port"):
            errors.append("Redis connection requires port")
    
    # Port validation
    port = connection_data.get("port")
    if port and (not isinstance(port, int) or port < 1 or port > 65535):
        errors.append("Port must be a valid integer between 1 and 65535")
    
    return len(errors) == 0, errors


def validate_environment_variable(env_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate environment variable data"""
    errors = []
    
    # Required fields
    required_fields = ["name", "category", "environment"]
    for field in required_fields:
        if not env_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Name validation
    name = env_data.get("name", "")
    if name:
        # Environment variable names should be uppercase with underscores
        if not re.match(r'^[A-Z][A-Z0-9_]*$', name):
            errors.append("Environment variable name should be uppercase with underscores")
    
    # Pattern validation
    pattern = env_data.get("validation_pattern")
    value = env_data.get("value")
    
    if pattern and value:
        try:
            if not re.match(pattern, value):
                message = env_data.get("validation_message", f"Value doesn't match pattern: {pattern}")
                errors.append(message)
        except re.error:
            errors.append("Invalid validation pattern")
    
    return len(errors) == 0, errors