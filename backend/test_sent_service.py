import unittest
from types import SimpleNamespace
from unittest.mock import patch

import sent_service


class SentServiceTests(unittest.TestCase):
    @patch.dict(
        sent_service.os.environ,
        {
            "SENT_TEMPLATE_ID": "template-id",
            "SENT_TEST_PHONE": "+15555555555",
        },
        clear=False,
    )
    @patch("sent_service.Sent")
    def test_notifications_are_always_sandboxed(self, sent_class):
        sent_class.return_value.messages.send.return_value = SimpleNamespace(
            data=SimpleNamespace(
                status="accepted",
                recipients=[SimpleNamespace(message_id="message-id")],
            )
        )

        result = sent_service.send_content_notification("Review this draft")

        self.assertEqual(result, {"status": "accepted", "message_id": "message-id"})
        sent_class.return_value.messages.send.assert_called_once_with(
            to=["+15555555555"],
            template={
                "id": "template-id",
                "parameters": {"contentTitle": "Review this draft"},
            },
            sandbox=True,
        )


if __name__ == "__main__":
    unittest.main()
