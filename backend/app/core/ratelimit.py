"""
Redis sliding-window rate limiter.

Used by:
  - BR-23: OTP request limits (3/phone/10min, 10/IP/hour)
  - BR-08 (future checkpoints): daily request quota checks

The sorted-set approach stores timestamps as scores so old entries can be
pruned in O(log N) and the current window size read in O(1).
"""

from redis.asyncio import Redis

from app.core.errors import AppError


async def check_rate_limit(
    redis: Redis,
    key: str,
    max_calls: int,
    window_seconds: int,
    current_time: float,
) -> None:
    """Enforce a sliding-window rate limit.

    Raises AppError(RATE_LIMITED, 429) if the caller has exceeded
    `max_calls` within the last `window_seconds`.

    Args:
        redis: async Redis client.
        key: unique key for this (action, identity) pair, e.g.
             ``"rl:otp_req:phone:+919999999999"``
        max_calls: maximum number of calls allowed in the window.
        window_seconds: size of the rolling window in seconds.
        current_time: current UTC timestamp (float seconds since epoch).
                      Passed explicitly so callers can use time-machine in
                      tests without monkey-patching redis internals.
    """
    window_start = current_time - window_seconds

    # Atomic pipeline: prune old entries, count remaining, add current call.
    async with redis.pipeline(transaction=True) as pipe:
        pipe.zremrangebyscore(key, "-inf", window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(current_time): current_time})
        pipe.expire(key, window_seconds + 1)  # auto-cleanup key after window
        results = await pipe.execute()

    count_before_add: int = results[1]
    if count_before_add >= max_calls:
        # Undo the add we just performed so it doesn't skew the counter.
        await redis.zrem(key, str(current_time))
        raise AppError(
            code="RATE_LIMITED",
            message="Too many requests. Please wait before trying again.",
            status_code=429,
        )
