"""In-memory login throttle / soft lockout (per process).

Deploy-safe for single-instance Railway demos. Not a distributed rate limiter.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from fastapi import HTTPException, status

from backend.core.config import settings


@dataclass
class _AttemptState:
    failures: int = 0
    locked_until: float = 0.0
    updated_at: float = field(default_factory=time.time)


class LoginThrottle:
    _lock = threading.Lock()
    _states: dict[str, _AttemptState] = {}

    @classmethod
    def _key(cls, scope: str, identifier: str) -> str:
        return f"{scope}:{(identifier or '').strip().lower()}"

    @classmethod
    def _purge_stale(cls, now: float) -> None:
        ttl = max(settings.BLOOMCARE_LOGIN_LOCKOUT_MINUTES, 1) * 60 * 4
        stale = [k for k, v in cls._states.items() if now - v.updated_at > ttl]
        for k in stale:
            cls._states.pop(k, None)

    @classmethod
    def assert_allowed(cls, scope: str, identifier: str) -> None:
        if settings.BLOOMCARE_LOGIN_MAX_ATTEMPTS <= 0:
            return
        key = cls._key(scope, identifier)
        now = time.time()
        with cls._lock:
            cls._purge_stale(now)
            state = cls._states.get(key)
            if state and state.locked_until > now:
                retry_after = int(state.locked_until - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Too many failed login attempts. "
                        f"Try again in {retry_after} seconds."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

    @classmethod
    def record_failure(cls, scope: str, identifier: str) -> None:
        if settings.BLOOMCARE_LOGIN_MAX_ATTEMPTS <= 0:
            return
        key = cls._key(scope, identifier)
        now = time.time()
        with cls._lock:
            state = cls._states.get(key) or _AttemptState()
            state.failures += 1
            state.updated_at = now
            if state.failures >= settings.BLOOMCARE_LOGIN_MAX_ATTEMPTS:
                state.locked_until = now + (
                    settings.BLOOMCARE_LOGIN_LOCKOUT_MINUTES * 60
                )
                state.failures = 0
            cls._states[key] = state

    @classmethod
    def reset(cls, scope: str, identifier: str) -> None:
        key = cls._key(scope, identifier)
        with cls._lock:
            cls._states.pop(key, None)

    @classmethod
    def clear_all(cls) -> None:
        """Test helper."""
        with cls._lock:
            cls._states.clear()
