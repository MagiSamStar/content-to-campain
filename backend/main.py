from contextlib import asynccontextmanager
from models import CampaignCreate, DraftCreate, DraftUpdate, GenerateDraftRequest
from fastapi import FastAPI
from database import get_connection, initialize_database
from models import CampaignCreate
from fastapi import FastAPI, HTTPException
from ollama_service import generate_text
from sent_service import send_content_notification
from datetime import datetime
from zoneinfo import ZoneInfo

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield

app = FastAPI(
    title="Content-to-Campaign Pipeline",
    lifespan=lifespan,
)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "project": "Content-to-Campaign Pipeline",
    }


@app.post("/api/campaigns", status_code=201)
def create_campaign(campaign: CampaignCreate):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO campaigns (
                name,
                source_material,
                audience,
                objective
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                campaign.name,
                campaign.source_material,
                campaign.audience,
                campaign.objective,
            ),
        )

        campaign_id = cursor.lastrowid
        saved_campaign = connection.execute(
            "SELECT * FROM campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()

    return dict(saved_campaign)

@app.get("/api/campaigns")
def list_campaigns():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM campaigns ORDER BY id DESC"
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: int):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()

    if row is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    return dict(row)


@app.post("/api/campaigns/{campaign_id}/drafts", status_code=201)
def create_draft(campaign_id: int, draft: DraftCreate):
    with get_connection() as connection:
        campaign = connection.execute(
            "SELECT id FROM campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()

        if campaign is None:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=404,
                detail="Campaign not found",
            )

        cursor = connection.execute(
            """
            INSERT INTO drafts (campaign_id, platform, content)
            VALUES (?, ?, ?)
            """,
            (campaign_id, draft.platform, draft.content),
        )

        draft_id = cursor.lastrowid

        saved_draft = connection.execute(
            "SELECT * FROM drafts WHERE id = ?",
            (draft_id,),
        ).fetchone()

    return dict(saved_draft)

@app.get("/api/campaigns/{campaign_id}/drafts")
def list_drafts(campaign_id: int):
    with get_connection() as connection:
        campaign = connection.execute(
            "SELECT id FROM campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()

        if campaign is None:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=404,
                detail="Campaign not found",
            )

        rows = connection.execute(
            """
            SELECT * FROM drafts
            WHERE campaign_id = ?
            ORDER BY id DESC
            """,
            (campaign_id,),
        ).fetchall()

    return [dict(row) for row in rows]

@app.patch("/api/drafts/{draft_id}")
def update_draft(draft_id: int, draft: DraftUpdate):
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT * FROM drafts WHERE id = ?",
            (draft_id,),
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Draft not found",
            )

        connection.execute(
            """
            UPDATE drafts
            SET content = ?, revision = revision + 1,
                approval_status = 'draft', approved_at = NULL
            WHERE id = ?
            """,
            (draft.content, draft_id),
        )

        updated = connection.execute(
            "SELECT * FROM drafts WHERE id = ?",
            (draft_id,),
        ).fetchone()


   
    notification_status = "not_sent"
    sent_message_id = None

    try:
        notification = send_content_notification(
            f"Your {updated['platform']} draft was updated. "
            f"Revision {updated['revision']} is ready for review."
        )
        notification_status = notification["status"].lower()
        sent_message_id = notification["message_id"]
    except Exception as error:
        print(
            f"Sent notification failed for draft {draft_id}: "
            f"{type(error).__name__}"
        )

    if sent_message_id:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE drafts
                SET sent_message_id = ?
                WHERE id = ?
                """,
                (sent_message_id, draft_id),
            )

    result = dict(updated)
    result["sent_message_id"] = sent_message_id
    result["notification_status"] = notification_status

    return result


@app.post("/api/drafts/{draft_id}/approve")
def approve_draft(draft_id: int):
    """Approve a draft and notify Sent once when it first becomes approved."""
    with get_connection() as connection:
        existing = connection.execute(
        """
        SELECT drafts.*, campaigns.name AS campaign_name
        FROM drafts
        JOIN campaigns ON drafts.campaign_id = campaigns.id
        WHERE drafts.id = ?
        """,
        (draft_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        was_already_approved = existing["approval_status"] == "approved"
        approval_timestamp = None
        formatted_time = None
        if not was_already_approved:
            approval_time = datetime.now(ZoneInfo("America/New_York"))
            approval_timestamp = approval_time.isoformat(timespec="seconds")
            formatted_time = approval_time.strftime("%B %d, %Y at %I:%M %p %Z")
            connection.execute(
                """
                UPDATE drafts
                SET approval_status = 'approved', approved_at = ?
                WHERE id = ?
                """,
                (approval_timestamp, draft_id),
            )
        approved = connection.execute(
            """
                   SELECT drafts.*, campaigns.name AS campaign_name
                   FROM drafts
                   JOIN campaigns ON drafts.campaign_id = campaigns.id
                   WHERE drafts.id = ?
                   """, (draft_id,)
        ).fetchone()
    result = dict(approved)
    result["notification_status"] = "not_sent"
    result["approval_timestamp"] = approved["approved_at"]

    if was_already_approved:
        return result

    try:
        notification = send_content_notification(
            f'Your campaign "{approved["campaign_name"]}" '
            f'was approved on {formatted_time} and is ready '
            f'for the next step.'
        )
        result["notification_status"] = notification["status"].lower()
        result["sent_message_id"] = notification["message_id"]
        if notification["message_id"]:
            with get_connection() as connection:
                connection.execute(
                    "UPDATE drafts SET sent_message_id = ? WHERE id = ?",
                    (notification["message_id"], draft_id),
                )
    except Exception as error:
        print(
            f"Sent approval notification failed for draft {draft_id}: "
            f"{type(error).__name__}"
        )
        result["notification_status"] = "failed"
        result["sent_message_id"] = approved["sent_message_id"]

    return result


@app.post("/api/campaigns/{campaign_id}/generate", status_code=201)
def generate_campaign_draft(
    campaign_id: int,
    request: GenerateDraftRequest,
):
    with get_connection() as connection:
        campaign = connection.execute(
            "SELECT * FROM campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    prompt = f"""
You are a precise technical content writer.

CAMPAIGN NAME:
{campaign["name"]}

SOURCE MATERIAL:
{campaign["source_material"]}

TARGET AUDIENCE:
{campaign["audience"]}

CAMPAIGN OBJECTIVE:
{campaign["objective"]}

PLATFORM:
{request.platform}

YOUR TASK:
Create exactly ONE finished piece of content for the requested platform.

PLATFORM RULES:
- If the platform is linkedin, write only one LinkedIn post.
- If the platform is x, write only one X post. Keep it concise.
- If the platform is newsletter, write only one newsletter section with a suitable heading.
- Never generate content for any other platform.
- Never include alternate versions or sections for other platforms.

FACTUAL RULES:
- Use only facts supported by the campaign source material.
- Do not invent features, metrics, results, customer claims, or capabilities.
- Do not exaggerate the maturity or readiness of the project.
- Do not claim enterprise readiness, compliance, or production readiness unless explicitly supported.
- Do not use placeholders or ask the user for information.
- If details are missing, omit them rather than inventing them.

STYLE:
- Write naturally and clearly for the target audience.
- Explain a concrete project capability or benefit.
- Avoid generic hype, excessive emojis, and unnecessary jargon.
- Return only the finished content.
- Do not include explanations of these instructions.
"""


    try:
        content = generate_text(prompt)
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Content generation failed: {error}",
        ) from error

    if not content:
        raise HTTPException(
            status_code=502,
            detail="The AI model returned empty content.",
        )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO drafts (campaign_id, platform, content)
            VALUES (?, ?, ?)
            """,
            (campaign_id, request.platform, content),
        )

        draft_id = cursor.lastrowid

        saved_draft = connection.execute(
            "SELECT * FROM drafts WHERE id = ?",
            (draft_id,),
        ).fetchone()

   
    notification_status = "not_sent"
    sent_message_id = None

    try:
        notification = send_content_notification(
            f"New {request.platform} draft ready for review."
        )
        notification_status = notification["status"].lower()
        sent_message_id = notification["message_id"]
    except Exception as error:
        print(
            f"Sent notification failed for draft {draft_id}: "
            f"{type(error).__name__}"
        )

    if sent_message_id:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE drafts
                SET sent_message_id = ?
                WHERE id = ?
                """,
                (sent_message_id, draft_id),
            )

    result = dict(saved_draft)
    result["sent_message_id"] = sent_message_id
    result["notification_status"] = notification_status

    return result


