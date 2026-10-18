import json
from collections.abc import AsyncGenerator

import redis
import redis.asyncio as aioredis

from app.services.status import AnalysisStatus
from app.settings import required_env

STATUS_TTL = 3600  # seconds


def _status_channel(request_id: str) -> str:
    return f"status:{request_id}"


def decode_result(raw: bytes) -> dict:
    """
    Decode a stored/published result into `{"status", "metrics"?}`.

    Values written before metrics were added are bare status strings.
    """
    text = raw.decode("utf-8")
    try:
        result = json.loads(text)
    except ValueError:
        return {"status": text}
    return result if isinstance(result, dict) else {"status": text}


class RedisClient:
    def __init__(self):
        conn_kwargs = dict(
            host=required_env("REDIS_HOST"),
            port=int(required_env("REDIS_PORT")),
            db=int(required_env("REDIS_DB")),
            password=required_env("REDIS_PASSWORD"),
        )
        self._sync = redis.Redis(**conn_kwargs)
        self._async = aioredis.Redis(**conn_kwargs)

    async def get_result(self, request_id: str) -> dict | None:
        raw = await self._async.get(request_id)
        return decode_result(raw) if raw else None

    def set_status(
        self,
        request_id: str,
        status: AnalysisStatus,
        metrics: dict | None = None,
        out_of_range: list[str] | None = None,
    ) -> None:
        result: dict = {"status": status}
        if metrics is not None:
            result["metrics"] = metrics
        if out_of_range is not None:
            result["out_of_range"] = out_of_range
        value = json.dumps(result)
        self._sync.set(name=request_id, value=value, ex=STATUS_TTL)
        self._sync.publish(_status_channel(request_id), value)

    async def watch_result(self, request_id: str) -> AsyncGenerator[dict, None]:
        """
        Yield the stored result for a request, then every result published
        after it.

        Subscribes before reading the stored value, so a result published
        between the two is delivered instead of lost.
        """
        async with self._async.pubsub() as pubsub:
            await pubsub.subscribe(_status_channel(request_id))

            stored = await self.get_result(request_id)
            if stored:
                yield stored

            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield decode_result(message["data"])
