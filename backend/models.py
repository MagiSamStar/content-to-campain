from pydantic import BaseModel, Field

class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source_material: str = Field(min_length=1)
    audience: str = Field(min_length=1, max_length=200)
    objective: str = Field(min_length=1, max_length=200)

class DraftCreate(BaseModel):
    platform: str = Field(
        pattern="^(linkedin|x|newsletter)$"
    )
    content: str = Field(min_length=1)

class DraftUpdate(BaseModel):
    content: str = Field(min_length=1)

    
class GenerateDraftRequest(BaseModel):
    platform: str = Field(
        pattern="^(linkedin|x|newsletter)$"
    )

