import unittest

from fastapi.testclient import TestClient

import main


class RateLimitApiTests(unittest.TestCase):
    def setUp(self):
        main.generate_rate_limiter.reset()

    def test_generation_returns_429_after_limit(self):
        client = TestClient(main.app)

        responses = [
            client.post(
                "/api/campaigns/999999/generate",
                json={"platform": "linkedin"},
            )
            for _ in range(4)
        ]

        self.assertEqual([response.status_code for response in responses[:3]], [404] * 3)
        limited = responses[3]
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.json()["detail"], "Rate limit reached. Try again in 86400 seconds.")
        self.assertEqual(limited.headers["Retry-After"], "86400")
        self.assertEqual(limited.headers["X-RateLimit-Limit"], "3")
        self.assertEqual(limited.headers["X-RateLimit-Remaining"], "0")


if __name__ == "__main__":
    unittest.main()
