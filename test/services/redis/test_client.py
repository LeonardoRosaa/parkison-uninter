import asyncio
from unittest.mock import AsyncMock, Mock


import app.services.redis.client as redis_client_module
from app.services.redis.client import RedisClient, decode_result
from app.services.status import AnalysisStatus


def test_redis_client_builds_connection_from_env(monkeypatch):
    redis_factory = Mock()
    monkeypatch.setattr(redis_client_module.redis, "Redis", redis_factory)

    monkeypatch.setenv("REDIS_HOST", "redis.local")
    monkeypatch.setenv("REDIS_PORT", "6380")
    monkeypatch.setenv("REDIS_DB", "2")
    monkeypatch.setenv("REDIS_PASSWORD", "secret")

    RedisClient()

    redis_factory.assert_called_once_with(
        host="redis.local",
        port=6380,
        db=2,
        password="secret",
    )


def _client_with_drivers(sync_driver=None, async_driver=None) -> RedisClient:
    client = RedisClient.__new__(RedisClient)
    client._sync = sync_driver
    client._async = async_driver
    return client


def test_get_result_returns_stored_status_and_metrics():
    metrics = {
        "f0_hz": 154.2,
        "jitter_percent": 0.39,
        "shimmer_percent": None,
        "hnr_db": 21.4,
    }
    sync_driver = Mock()
    client = _client_with_drivers(sync_driver=sync_driver)
    client.set_status("id-1", AnalysisStatus.HEALTHY, metrics=metrics)
    stored = sync_driver.set.call_args.kwargs["value"]

    async_driver = Mock()
    async_driver.get = AsyncMock(side_effect=[stored.encode("utf-8"), None])
    client = _client_with_drivers(async_driver=async_driver)

    assert asyncio.run(client.get_result("id-1")) == {
        "status": "health",
        "metrics": metrics,
    }
    assert asyncio.run(client.get_result("id-2")) is None


def test_set_status_stores_with_ttl_and_publishes_the_same_result():
    sync_driver = Mock()
    client = _client_with_drivers(sync_driver=sync_driver)

    client.set_status("id-1", AnalysisStatus.LOADING)

    set_kwargs = sync_driver.set.call_args.kwargs
    assert set_kwargs["name"] == "id-1"
    assert set_kwargs["ex"] == 3600
    channel, published = sync_driver.publish.call_args.args
    assert channel == "status:id-1"
    assert published == set_kwargs["value"]
    assert decode_result(published.encode("utf-8")) == {"status": "loading"}


def test_set_status_stores_the_out_of_range_features_of_an_inconclusive_result():
    sync_driver = Mock()
    client = _client_with_drivers(sync_driver=sync_driver)

    client.set_status("id-1", AnalysisStatus.INCONCLUSIVE, out_of_range=["DFA"])

    stored = sync_driver.set.call_args.kwargs["value"]
    assert decode_result(stored.encode("utf-8")) == {
        "status": "inconclusive",
        "out_of_range": ["DFA"],
    }


def test_decode_result_accepts_bare_status_strings_stored_before_metrics():
    assert decode_result(b"nonhealthy") == {"status": "nonhealthy"}


class FakePubSub:
    """Delivers only what is published after subscribing, as Redis pub/sub does."""

    def __init__(self):
        self.channels: list[str] = []
        self._delivered: list[dict] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def subscribe(self, channel):
        self.channels.append(channel)

    def publish(self, raw: bytes):
        if self.channels:
            self._delivered.append({"type": "message", "data": raw})

    async def listen(self):
        yield {"type": "subscribe", "data": 1}
        for message in self._delivered:
            yield message


class FakeAsyncRedis:
    def __init__(self, stored: bytes | None = None, published_during_read=()):
        self._stored = stored
        self._published_during_read = published_during_read
        self.pubsub_driver = FakePubSub()

    async def get(self, key):  # noqa: ARG002
        for raw in self._published_during_read:
            self.pubsub_driver.publish(raw)
        return self._stored

    def pubsub(self):
        return self.pubsub_driver


def _watched(async_driver: FakeAsyncRedis, request_id: str) -> list[dict]:
    client = _client_with_drivers(async_driver=async_driver)

    async def collect():
        return [result async for result in client.watch_result(request_id)]

    return asyncio.run(collect())


def test_watch_result_delivers_a_result_published_while_the_stored_one_is_read():
    # The worker finishes in the gap between "nothing stored yet" and listening.
    async_driver = FakeAsyncRedis(
        stored=None, published_during_read=[b'{"status": "health"}']
    )

    assert _watched(async_driver, "id-1") == [{"status": "health"}]
    assert async_driver.pubsub_driver.channels == ["status:id-1"]


def test_watch_result_yields_the_stored_result_before_later_updates():
    async_driver = FakeAsyncRedis(
        stored=b'{"status": "loading"}',
        published_during_read=[b'{"status": "nonhealthy"}'],
    )

    assert _watched(async_driver, "id-1") == [
        {"status": "loading"},
        {"status": "nonhealthy"},
    ]
