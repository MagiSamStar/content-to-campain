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
            for _ in range(6)
        ]

        self.assertEqual([response.status_code for response in responses[:5]], [404] * 5)
        limited = responses[5]
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.json()["detail"], "Rate limit reached. Try again in 60 seconds.")
        self.assertEqual(limited.headers["Retry-After"], "60")
        self.assertEqual(limited.headers["X-RateLimit-Limit"], "5")
        self.assertEqual(limited.headers["X-RateLimit-Remaining"], "0")


if __name__ == "__main__":
    unittest.main()
