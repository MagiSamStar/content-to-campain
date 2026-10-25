import unittest

from rate_limit import SlidingWindowRateLimiter


class SlidingWindowRateLimiterTests(unittest.TestCase):
    def test_allows_requests_until_limit(self):
        now = [100.0]
        limiter = SlidingWindowRateLimiter(2, 60, clock=lambda: now[0])

        self.assertEqual(limiter.check("client"), (True, 1, 0))
        self.assertEqual(limiter.check("client"), (True, 0, 0))
        self.assertEqual(limiter.check("client"), (False, 0, 60))

    def test_requests_are_independent_by_client(self):
        limiter = SlidingWindowRateLimiter(1, 60, clock=lambda: 100.0)

        self.assertEqual(limiter.check("first"), (True, 0, 0))
        self.assertEqual(limiter.check("second"), (True, 0, 0))

    def test_window_expiry_allows_new_request(self):
        now = [100.0]
        limiter = SlidingWindowRateLimiter(1, 60, clock=lambda: now[0])

        self.assertEqual(limiter.check("client"), (True, 0, 0))
        self.assertEqual(limiter.check("client"), (False, 0, 60))
        now[0] = 160.001
        self.assertEqual(limiter.check("client"), (True, 0, 0))

    def test_reset_clears_all_clients(self):
        limiter = SlidingWindowRateLimiter(1, 60, clock=lambda: 100.0)

        limiter.check("client")
        limiter.reset()

        self.assertEqual(limiter.check("client"), (True, 0, 0))


if __name__ == "__main__":
    unittest.main()
