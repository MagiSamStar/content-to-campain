
from sent_service import send_content_notification


try:
    response = send_content_notification(
        "Test notification from Content-to-Campaign Pipeline"
    )

    print("Sandbox validation completed.")
    print("Status:", response.data.status)

    recipients = response.data.recipients
    if recipients:
        print("Message ID:", recipients[0].message_id)

except Exception as error:
    print("Sent sandbox test failed.")
    print("Error type:", type(error).__name__)
    print("Check your configuration and Sent API response.")
