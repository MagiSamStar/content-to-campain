import os
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable
from typing import Deque

from fastapi import HTTPException, Request


def _read_positive_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


GENERATE_WINDOW_SECONDS = _read_positive_int("RATE_LIMIT_GENERATE_WINDOW_SECONDS", 86400)
GENERATE_LIMIT = _read_positive_int("RATE_LIMIT_GENERATE_PER_WINDOW", 3)
WRITE_WINDOW_SECONDS = _read_positive_int("RATE_LIMIT_WRITE_WINDOW_SECONDS", 60)
WRITE_LIMIT = _read_positive_int("RATE_LIMIT_WRITE_PER_WINDOW", 20)


class SlidingWindowRateLimiter:
    """Thread-safe, per-client sliding-window request limiter."""

    def __init__(self, limit: int, window_seconds: int, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock
        self._requests: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int, int]:
        now = self.clock()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._requests[key]
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            if len(timestamps) >= self.limit:
                retry_after = max(1, int(timestamps[0] + self.window_seconds - now + 0.999))
                return False, 0, retry_after

            timestamps.append(now)
            remaining = max(0, self.limit - len(timestamps))
            return True, remaining, 0

    def reset(self) -> None:
        with self._lock:
            self._requests.clear()


def rate_limit(limiter: SlidingWindowRateLimiter):
    async def dependency(request: Request) -> None:
        client_host = request.client.host if request.client else "unknown"
        allowed, remaining, retry_after = limiter.check(client_host)

        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit reached. Try again in {retry_after} seconds.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limiter.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                },
            )

    return dependency


generate_rate_limiter = SlidingWindowRateLimiter(GENERATE_LIMIT, GENERATE_WINDOW_SECONDS)
write_rate_limiter = SlidingWindowRateLimiter(WRITE_LIMIT, WRITE_WINDOW_SECONDS)
