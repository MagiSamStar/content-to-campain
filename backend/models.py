from pydantic import BaseModel, Field, field_validator


MAX_SOURCE_MATERIAL_LENGTH = 20_000
MAX_DRAFT_CONTENT_LENGTH = 20_000


def reject_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must contain non-whitespace characters")
    return value

class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source_material: str = Field(
        min_length=1,
        max_length=MAX_SOURCE_MATERIAL_LENGTH,
    )
    audience: str = Field(min_length=1, max_length=200)
    objective: str = Field(min_length=1, max_length=200)

    _name_not_blank = field_validator("name")(reject_blank)
    _source_not_blank = field_validator("source_material")(reject_blank)
    _audience_not_blank = field_validator("audience")(reject_blank)
    _objective_not_blank = field_validator("objective")(reject_blank)

class DraftCreate(BaseModel):
    platform: str = Field(
        pattern="^(linkedin|x|newsletter)$"
    )
    content: str = Field(
        min_length=1,
        max_length=MAX_DRAFT_CONTENT_LENGTH,
    )

    _content_not_blank = field_validator("content")(reject_blank)

class DraftUpdate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=MAX_DRAFT_CONTENT_LENGTH,
    )

    _content_not_blank = field_validator("content")(reject_blank)

    
class GenerateDraftRequest(BaseModel):
    platform: str = Field(
        pattern="^(linkedin|x|newsletter)$"
    )

