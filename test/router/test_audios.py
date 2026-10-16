from pathlib import Path
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.audios import router
from app.services.analysis_queue import get_analysis_queue


class QueueStub:
    def __init__(self):
        self.calls: list[dict] = []

    def submit(self, upload, request_id):
        self.calls.append({"upload": upload, "request_id": request_id})


def _build_client(queue_stub: QueueStub) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_analysis_queue] = lambda: queue_stub
    return TestClient(app, follow_redirects=False)


def test_post_audio_enqueues_upload_and_returns_metadata():
    queue_stub = QueueStub()
    client = _build_client(queue_stub)

    response = client.post(
        "/audios",
        files={"file": ("audio.wav", b"binary-audio", "audio/wav")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "audio.wav"
    UUID(body["uuid"])

    assert len(queue_stub.calls) == 1
    queued = queue_stub.calls[0]
    assert str(queued["request_id"]) == body["uuid"]
    assert queued["upload"].suffix == ".wav"
    assert queued["upload"].read_bytes() == b"binary-audio"


def test_post_audio_rejects_non_audio_file():
    queue_stub = QueueStub()
    client = _build_client(queue_stub)

    response = client.post(
        "/audios",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json() == {"message": "Invalid audio file"}
    assert queue_stub.calls == []


def test_post_audio_rejects_upload_without_a_content_type():
    queue_stub = QueueStub()
    client = _build_client(queue_stub)
    # A hand-built body: HTTP clients always add a part Content-Type themselves.
    body = (
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
        b"\r\n"
        b"binary-audio\r\n"
        b"--boundary--\r\n"
    )

    response = client.post(
        "/audios",
        content=body,
        headers={"Content-Type": "multipart/form-data; boundary=boundary"},
    )

    assert response.status_code == 422
    assert response.json() == {"message": "Invalid audio file"}
    assert queue_stub.calls == []


def test_post_audio_removes_the_stored_upload_when_it_cannot_be_queued():
    class FailingQueue:
        upload: Path | None = None

        def submit(self, upload, request_id):  # noqa: ARG002
            self.upload = upload
            raise RuntimeError("queue unavailable")

    queue_stub = FailingQueue()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_analysis_queue] = lambda: queue_stub
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/audios",
        files={"file": ("audio.wav", b"binary-audio", "audio/wav")},
    )

    assert response.status_code == 500
    assert queue_stub.upload is not None
    assert not queue_stub.upload.exists()
