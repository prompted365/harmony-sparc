"""
Brand profile and compliance API routes
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
import structlog

from core.database import get_db
from core.security import get_current_user_payload, require_permission, Permission
from core.exceptions import NotFoundError, ValidationError, BrandComplianceError
from models.brand import BrandProfile, BrandGuidelines, BrandCompliance

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response models
class BrandProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    brand_colors: Optional[Dict[str, str]] = {}
    fonts: Optional[Dict[str, str]] = {}
    tone: Optional[str] = None
    voice_description: Optional[str] = None
    personality_traits: Optional[List[str]] = []
    target_audience: Optional[Dict[str, Any]] = {}
    mission: Optional[str] = None
    vision: Optional[str] = None
    values: Optional[List[str]] = []
    website: Optional[str] = None
    email: Optional[str] = None
    industry: Optional[str] = None


class BrandProfileResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    tagline: Optional[str]
    tone: Optional[str]
    industry: Optional[str]
    created_by: Optional[int]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class GuidelinesCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    content: str
    rules: Optional[Dict[str, Any]] = {}
    positive_examples: Optional[List[str]] = []
    negative_examples: Optional[List[str]] = []
    enforcement_level: Optional[str] = "warning"


class GuidelinesResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    enforcement_level: str
    usage_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ComplianceCheckRequest(BaseModel):
    content_text: str
    content_type: Optional[str] = None


@router.post("/brand/profiles", response_model=BrandProfileResponse)
async def create_brand_profile(
    profile_data: BrandProfileCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_BRAND)),
    db: AsyncSession = Depends(get_db)
) -> BrandProfileResponse:
    """
    Create a new brand profile
    """
    try:
        user_id = int(current_user["sub"])
        
        # Create brand profile
        profile = BrandProfile(
            name=profile_data.name,
            description=profile_data.description,
            tagline=profile_data.tagline,
            logo_url=profile_data.logo_url,
            brand_colors=profile_data.brand_colors,
            fonts=profile_data.fonts,
            tone=profile_data.tone,
            voice_description=profile_data.voice_description,
            personality_traits=profile_data.personality_traits,
            target_audience=profile_data.target_audience,
            mission=profile_data.mission,
            vision=profile_data.vision,
            values=profile_data.values,
            website=profile_data.website,
            email=profile_data.email,
            industry=profile_data.industry,
            created_by=user_id
        )
        
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
        logger.info(f"Brand profile created: {profile.id} by user {user_id}")
        
        return BrandProfileResponse.from_orm(profile)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Brand profile creation failed: {e}")
        raise


@router.get("/brand/profiles", response_model=List[BrandProfileResponse])
async def list_brand_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    is_active: Optional[bool] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[BrandProfileResponse]:
    """
    List brand profiles
    """
    try:
        query = select(BrandProfile)
        
        if is_active is not None:
            query = query.where(BrandProfile.is_active == is_active)
        
        query = query.offset(skip).limit(limit).order_by(BrandProfile.created_at.desc())
        
        result = await db.execute(query)
        profiles = result.scalars().all()
        
        return [BrandProfileResponse.from_orm(profile) for profile in profiles]
        
    except Exception as e:
        logger.error(f"Brand profile listing failed: {e}")
        raise


@router.get("/brand/profiles/{profile_id}", response_model=Dict[str, Any])
async def get_brand_profile(
    profile_id: int,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get brand profile details
    """
    try:
        result = await db.execute(select(BrandProfile).where(BrandProfile.id == profile_id))
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise NotFoundError("Brand profile not found")
        
        return {
            "id": profile.id,
            "name": profile.name,
            "description": profile.description,
            "tagline": profile.tagline,
            "logo_url": profile.logo_url,
            "brand_colors": profile.brand_colors,
            "fonts": profile.fonts,
            "tone": profile.tone,
            "voice_description": profile.voice_description,
            "personality_traits": profile.personality_traits,
            "target_audience": profile.target_audience,
            "mission": profile.mission,
            "vision": profile.vision,
            "values": profile.values,
            "website": profile.website,
            "email": profile.email,
            "industry": profile.industry,
            "created_by": profile.created_by,
            "is_active": profile.is_active,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at
        }
        
    except Exception as e:
        logger.error(f"Get brand profile failed: {e}")
        raise


@router.post("/brand/profiles/{profile_id}/guidelines", response_model=GuidelinesResponse)
async def create_guidelines(
    profile_id: int,
    guidelines_data: GuidelinesCreate,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.MANAGE_BRAND)),
    db: AsyncSession = Depends(get_db)
) -> GuidelinesResponse:
    """
    Create brand guidelines
    """
    try:
        user_id = int(current_user["sub"])
        
        # Verify brand profile exists
        result = await db.execute(select(BrandProfile).where(BrandProfile.id == profile_id))
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise NotFoundError("Brand profile not found")
        
        # Create guidelines
        guidelines = BrandGuidelines(
            brand_profile_id=profile_id,
            name=guidelines_data.name,
            description=guidelines_data.description,
            category=guidelines_data.category,
            content=guidelines_data.content,
            rules=guidelines_data.rules,
            positive_examples=guidelines_data.positive_examples,
            negative_examples=guidelines_data.negative_examples,
            enforcement_level=guidelines_data.enforcement_level
        )
        
        db.add(guidelines)
        await db.commit()
        await db.refresh(guidelines)
        
        logger.info(f"Brand guidelines created: {guidelines.id} for profile {profile_id}")
        
        return GuidelinesResponse.from_orm(guidelines)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Brand guidelines creation failed: {e}")
        raise


@router.get("/brand/profiles/{profile_id}/guidelines", response_model=List[GuidelinesResponse])
async def list_guidelines(
    profile_id: int,
    category: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> List[GuidelinesResponse]:
    """
    List brand guidelines for a profile
    """
    try:
        query = select(BrandGuidelines).where(BrandGuidelines.brand_profile_id == profile_id)
        
        if category:
            query = query.where(BrandGuidelines.category == category)
        
        query = query.order_by(BrandGuidelines.created_at.desc())
        
        result = await db.execute(query)
        guidelines = result.scalars().all()
        
        return [GuidelinesResponse.from_orm(guideline) for guideline in guidelines]
        
    except Exception as e:
        logger.error(f"Brand guidelines listing failed: {e}")
        raise


@router.post("/brand/profiles/{profile_id}/check-compliance")
async def check_brand_compliance(
    profile_id: int,
    request: ComplianceCheckRequest,
    current_user: Dict[str, Any] = Depends(require_permission(Permission.READ_CONTENT)),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Check content compliance against brand guidelines
    """
    try:
        user_id = int(current_user["sub"])
        
        # Get brand profile
        result = await db.execute(select(BrandProfile).where(BrandProfile.id == profile_id))
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise NotFoundError("Brand profile not found")
        
        # Get guidelines for this profile
        result = await db.execute(
            select(BrandGuidelines).where(BrandGuidelines.brand_profile_id == profile_id)
        )
        guidelines = result.scalars().all()
        
        # Perform compliance check
        compliance_results = await perform_compliance_check(
            request.content_text, profile, guidelines
        )
        
        # Create compliance record
        compliance = BrandCompliance(
            brand_profile_id=profile_id,
            content_type=request.content_type,
            content_text=request.content_text,
            overall_score=compliance_results["overall_score"],
            compliance_status=compliance_results["status"],
            guideline_scores=compliance_results["guideline_scores"],
            violations=compliance_results["violations"],
            suggestions=compliance_results["suggestions"],
            ai_analysis=compliance_results.get("ai_analysis"),
            confidence_score=compliance_results.get("confidence_score")
        )
        
        db.add(compliance)
        await db.commit()
        await db.refresh(compliance)
        
        logger.info(f"Brand compliance check completed: {compliance.id}")
        
        return {
            "compliance_id": compliance.id,
            "overall_score": compliance.overall_score,
            "status": compliance.compliance_status,
            "guideline_scores": compliance.guideline_scores,
            "violations": compliance.violations,
            "suggestions": compliance.suggestions,
            "checked_at": compliance.created_at.isoformat()
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Brand compliance check failed: {e}")
        raise BrandComplianceError(f"Compliance check failed: {str(e)}")


async def perform_compliance_check(
    content: str, 
    profile: BrandProfile, 
    guidelines: List[BrandGuidelines]
) -> Dict[str, Any]:
    """
    Perform brand compliance analysis
    """
    try:
        # Initialize results
        results = {
            "overall_score": 0.0,
            "status": "compliant",
            "guideline_scores": {},
            "violations": [],
            "suggestions": []
        }
        
        total_score = 0.0
        guideline_count = len(guidelines)
        
        if guideline_count == 0:
            results["overall_score"] = 100.0
            return results
        
        # Check each guideline
        for guideline in guidelines:
            score = await check_guideline_compliance(content, guideline)
            results["guideline_scores"][guideline.name] = score
            total_score += score
            
            # Check for violations
            if score < 70.0:  # Threshold for violation
                violation = {
                    "guideline": guideline.name,
                    "category": guideline.category,
                    "score": score,
                    "enforcement_level": guideline.enforcement_level
                }
                results["violations"].append(violation)
                
                # Add suggestion if available
                if guideline.positive_examples:
                    results["suggestions"].append(
                        f"For {guideline.name}: Consider following examples like {guideline.positive_examples[0]}"
                    )
        
        # Calculate overall score
        results["overall_score"] = total_score / guideline_count
        
        # Determine status
        if results["overall_score"] >= 80.0:
            results["status"] = "compliant"
        elif results["overall_score"] >= 60.0:
            results["status"] = "warning"
        else:
            results["status"] = "non_compliant"
        
        # Check brand voice alignment
        if profile.tone and profile.voice_description:
            voice_score = await check_voice_alignment(content, profile.tone, profile.voice_description)
            results["voice_alignment_score"] = voice_score
        
        return results
        
    except Exception as e:
        logger.error(f"Compliance check processing failed: {e}")
        return {
            "overall_score": 0.0,
            "status": "error",
            "guideline_scores": {},
            "violations": [],
            "suggestions": ["Compliance check failed due to processing error"]
        }


async def check_guideline_compliance(content: str, guideline: BrandGuidelines) -> float:
    """
    Check compliance against a specific guideline
    """
    try:
        # Simple rule-based checking
        score = 100.0
        content_lower = content.lower()
        
        # Check rules if defined
        if guideline.rules:
            for rule_name, rule_config in guideline.rules.items():
                if rule_name == "forbidden_words":
                    forbidden_words = rule_config.get("words", [])
                    for word in forbidden_words:
                        if word.lower() in content_lower:
                            score -= rule_config.get("penalty", 10.0)
                
                elif rule_name == "required_phrases":
                    required_phrases = rule_config.get("phrases", [])
                    for phrase in required_phrases:
                        if phrase.lower() not in content_lower:
                            score -= rule_config.get("penalty", 15.0)
        
        # Check negative examples
        if guideline.negative_examples:
            for negative_example in guideline.negative_examples:
                if negative_example.lower() in content_lower:
                    score -= 20.0
        
        return max(0.0, min(100.0, score))
        
    except Exception as e:
        logger.error(f"Guideline compliance check failed: {e}")
        return 50.0  # Default neutral score


async def check_voice_alignment(content: str, tone: str, voice_description: str) -> float:
    """
    Check alignment with brand voice and tone
    """
    try:
        # TODO: Implement AI-based voice alignment check
        # This would use LLM to analyze if content matches the brand voice
        
        # For now, return a placeholder score
        score = 75.0
        
        # Simple keyword-based check
        if tone:
            tone_keywords = {
                "professional": ["ensure", "provide", "comprehensive", "expertise"],
                "friendly": ["help", "enjoy", "welcome", "happy"],
                "casual": ["hey", "cool", "awesome", "check out"],
                "formal": ["accordingly", "furthermore", "therefore", "consequently"]
            }
            
            if tone.lower() in tone_keywords:
                keywords = tone_keywords[tone.lower()]
                content_lower = content.lower()
                
                keyword_count = sum(1 for keyword in keywords if keyword in content_lower)
                if keyword_count > 0:
                    score += 10.0
        
        return min(100.0, score)
        
    except Exception as e:
        logger.error(f"Voice alignment check failed: {e}")
        return 50.0