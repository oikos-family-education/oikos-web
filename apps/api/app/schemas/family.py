from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class FaithTradition(str, Enum):
    CHRISTIAN = "christian"
    JEWISH = "jewish"
    MUSLIM = "muslim"
    SECULAR = "secular"
    OTHER = "other"
    NONE = "none"

class ScreenPolicy(str, Enum):
    SCREEN_FREE = "screen_free"
    MINIMAL = "minimal"
    MODERATE = "moderate"
    OPEN = "open"

class FamilyVisibility(str, Enum):
    PRIVATE = "private"
    LOCAL = "local"
    PUBLIC = "public"

class EducationMethod(str, Enum):
    CLASSICAL = "classical"
    CHARLOTTE_MASON = "charlotte_mason"
    MONTESSORI = "montessori"
    UNSCHOOLING = "unschooling"
    STRUCTURED = "structured"
    ECLECTIC = "eclectic"
    WALDORF = "waldorf"
    UNIT_STUDY = "unit_study"
    ONLINE = "online"
    OTHER = "other"

class ShieldConfig(BaseModel):
    initials: str = Field(..., min_length=1, max_length=3)
    shape: str = Field("heater", pattern="^(heater|rounded|kite|swiss|french|polish|lozenge|oval)$")
    primary_color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    secondary_color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    accent_color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    symbol_color: str = Field("#FFFFFF", pattern="^#[0-9A-Fa-f]{6}$")
    division: str = Field("none", pattern="^(none|chess|stripes_h|stripes_v|stripes_d|dots|diamonds|stars|crosses|leaves|scales|waves|fleur)$")
    crest_animal: str = Field("none")
    flourish: str = Field("none")
    center_symbol: str = Field("none")
    motto: str = Field("", max_length=60)
    font_style: str = Field("serif", pattern="^(serif|sans|script|gothic|classic)$")


class FamilyCreate(BaseModel):
    family_name: str = Field(..., min_length=2, max_length=80)
    shield_config: Optional[ShieldConfig] = None
    location_city: Optional[str] = Field(None, max_length=100)
    location_region: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    location_country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    faith_tradition: Optional[str] = None
    faith_denomination: Optional[str] = Field(None, max_length=80)
    faith_community_name: Optional[str] = Field(None, max_length=120)
    worldview_notes: Optional[str] = Field(None, max_length=300)
    education_purpose: Optional[str] = Field(None, pattern="^(full_homeschool|school_supplement|family_routine)$")
    education_methods: list[str] = Field(default_factory=list)
    current_curriculum: list[str] = Field(default_factory=list)
    diet: Optional[str] = None
    screen_policy: Optional[str] = None
    outdoor_orientation: Optional[str] = None
    home_languages: list[str] = Field(default_factory=lambda: ["en"])
    family_culture: Optional[str] = Field(None, max_length=2000)
    visibility: Optional[FamilyVisibility] = FamilyVisibility.LOCAL

    @field_validator("family_name")
    @classmethod
    def validate_family_name(cls, v: str) -> str:
        import re
        if not re.match(r"^[\w\s'\-]+$", v):
            raise ValueError("Family name contains invalid characters")
        return v.strip()


class FamilyUpdate(FamilyCreate):
    family_name: Optional[str] = Field(None, min_length=2, max_length=80)


class FamilyResponse(BaseModel):
    id: UUID
    family_name: str
    family_name_slug: str
    shield_config: Optional[dict] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    faith_tradition: Optional[str] = None
    education_purpose: Optional[str] = None
    education_methods: list[str] = []
    visibility: str = "private"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
