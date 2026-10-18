import os
from pathlib import Path
from dotenv import load_dotenv
from sent_dm import Sent


ENV_PATH = Path(__file__).resolve().parent / ".env"

def send_content_notification(notification_text: str):
    load_dotenv(ENV_PATH)

    template_id = os.getenv("SENT_TEMPLATE_ID")
    test_phone = os.getenv("SENT_TEST_PHONE")

    if not template_id or not test_phone:
        raise ValueError(
            "Missing SENT_TEMPLATE_ID or SENT_TEST_PHONE in .env"
        )

    client = Sent()

    response = client.messages.send(
        to=[test_phone],
        template={
            "id": template_id,
            "parameters": {
                "contentTitle": notification_text
            },
        },
        sandbox=True,
    )

    recipients = response.data.recipients or []

    message_id = (
        recipients[0].message_id
        if recipients
        else None
    )

    return {
        "status": response.data.status,
        "message_id": message_id,
    }