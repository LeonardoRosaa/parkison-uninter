from unittest.mock import Mock
from uuid import UUID

import app.services.analysis_queue as queue_module
from app.services.analysis_queue import AnalysisQueue

REQUEST_ID = UUID("11111111-1111-1111-1111-111111111111")


def _run(monkeypatch, upload, analysis_mock, redis_stub=None):
    monkeypatch.setattr(queue_module.audio_service, "analysis", analysis_mock)
    monkeypatch.setattr(queue_module, "logger", Mock())
    monkeypatch.setattr(queue_module, "redis_client", redis_stub or Mock())

    queue = AnalysisQueue()
    queue.submit(upload, REQUEST_ID)
    queue.shutdown()


def test_submit_analyses_the_upload(monkeypatch, tmp_path):
    upload = tmp_path / "audio.wav"
    upload.write_bytes(b"audio")
    analysis_mock = Mock()

    _run(monkeypatch, upload, analysis_mock)

    analysis_mock.assert_called_once_with(str(upload), request_id=REQUEST_ID)


def test_the_upload_is_deleted_once_analysed(monkeypatch, tmp_path):
    upload = tmp_path / "audio.wav"
    upload.write_bytes(b"audio")

    _run(monkeypatch, upload, Mock())

    assert not upload.exists()


def test_a_failed_analysis_reports_an_error_and_deletes_the_upload(
    monkeypatch, tmp_path
):
    upload = tmp_path / "audio.wav"
    upload.write_bytes(b"audio")
    redis_stub = Mock()

    _run(
        monkeypatch,
        upload,
        Mock(side_effect=ValueError("unreadable audio")),
        redis_stub,
    )

    redis_stub.set_status.assert_called_once_with(str(REQUEST_ID), "error")
    assert not upload.exists()


def test_uploads_are_analysed_one_at_a_time_in_submission_order(monkeypatch, tmp_path):
    first_id = UUID("22222222-2222-2222-2222-222222222222")
    seen = []
    monkeypatch.setattr(
        queue_module.audio_service,
        "analysis",
        lambda path, request_id: seen.append(request_id),
    )
    monkeypatch.setattr(queue_module, "redis_client", Mock())

    queue = AnalysisQueue()
    queue.submit(tmp_path / "first.wav", first_id)
    queue.submit(tmp_path / "second.wav", REQUEST_ID)
    queue.shutdown()

    assert seen == [first_id, REQUEST_ID]
