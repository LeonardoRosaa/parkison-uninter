import asyncio
from unittest.mock import Mock
from uuid import UUID

import pytest
from fastapi import FastAPI, WebSocketDisconnect
from fastapi.testclient import TestClient

import app.websockets.audios as websocket_module
from app.websockets.audios import router


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


METRICS = {
    "f0_hz": 154.2,
    "jitter_percent": 0.39,
    "shimmer_percent": 3.12,
    "hnr_db": None,
}


def _redis_stub(*results: dict) -> Mock:
    """A Redis client whose watched request yields `results`, then stays silent."""

    async def watch_result(request_id):  # noqa: ARG001
        for result in results:
            yield result
        await asyncio.Event().wait()

    redis_stub = Mock()
    redis_stub.watch_result = Mock(side_effect=watch_result)
    return redis_stub


def test_websocket_sends_result_with_metrics_and_closes(monkeypatch):
    request_id = UUID("22222222-2222-2222-2222-222222222222")
    redis_stub = _redis_stub({"status": "nonhealthy", "metrics": METRICS})
    monkeypatch.setattr(websocket_module, "redis_client", redis_stub)

    client = _build_client()
    with client.websocket_connect(f"/ws/{request_id}") as websocket:
        assert websocket.receive_json() == {
            "request_id": str(request_id),
            "status": "nonhealthy",
            "metrics": METRICS,
        }

        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()

    redis_stub.watch_result.assert_called_once_with(str(request_id))


def test_websocket_sends_inconclusive_result_and_closes(monkeypatch):
    request_id = UUID("33333333-3333-3333-3333-333333333333")
    result = {"status": "inconclusive", "metrics": METRICS, "out_of_range": ["DFA"]}
    monkeypatch.setattr(websocket_module, "redis_client", _redis_stub(result))

    client = _build_client()
    with client.websocket_connect(f"/ws/{request_id}") as websocket:
        assert websocket.receive_json() == {"request_id": str(request_id), **result}

        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()


def test_websocket_forwards_loading_updates_until_the_result_arrives(monkeypatch):
    request_id = UUID("11111111-1111-1111-1111-111111111111")
    redis_stub = _redis_stub(
        {"status": "loading"},
        {"status": "health", "metrics": METRICS},
        {"status": "error"},
    )
    monkeypatch.setattr(websocket_module, "redis_client", redis_stub)

    client = _build_client()
    with client.websocket_connect(f"/ws/{request_id}") as websocket:
        assert websocket.receive_json() == {
            "request_id": str(request_id),
            "status": "loading",
        }
        assert websocket.receive_json() == {
            "request_id": str(request_id),
            "status": "health",
            "metrics": METRICS,
        }

        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()


def test_websocket_sends_error_without_metrics(monkeypatch):
    request_id = UUID("44444444-4444-4444-4444-444444444444")
    redis_stub = _redis_stub({"status": "error"})
    monkeypatch.setattr(websocket_module, "redis_client", redis_stub)

    client = _build_client()
    with client.websocket_connect(f"/ws/{request_id}") as websocket:
        assert websocket.receive_json() == {
            "request_id": str(request_id),
            "status": "error",
        }


def test_websocket_reports_timeout_when_no_result_is_published(monkeypatch):
    request_id = UUID("55555555-5555-5555-5555-555555555555")
    redis_stub = _redis_stub()
    monkeypatch.setattr(websocket_module, "redis_client", redis_stub)
    monkeypatch.setattr(websocket_module, "ws_timeout", 0.01)

    client = _build_client()
    with client.websocket_connect(f"/ws/{request_id}") as websocket:
        assert websocket.receive_json() == {
            "request_id": str(request_id),
            "status": "timeout",
        }

        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()


def test_websocket_logs_disconnect(monkeypatch):
    request_id = UUID("33333333-3333-3333-3333-333333333333")
    redis_stub = _redis_stub({"status": "health"})
    logger_mock = Mock()

    class FakeWebSocket:
        accepted = False

        async def accept(self):
            self.accepted = True

        async def send_json(self, data):  # noqa: ARG002
            raise WebSocketDisconnect()

        async def close(self):
            pass

    fake_websocket = FakeWebSocket()

    monkeypatch.setattr(websocket_module, "redis_client", redis_stub)
    monkeypatch.setattr(websocket_module, "logger", logger_mock)

    asyncio.run(websocket_module.websocket_endpoint(request_id, fake_websocket))

    assert fake_websocket.accepted is True
    logger_mock.info.assert_called_once_with(
        f"WebSocket disconnected for request_id={request_id}"
    )
