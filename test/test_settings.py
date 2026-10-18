from pathlib import Path

import pytest

from app.settings import audio_model_path, cors_origins, required_env


def test_required_env_returns_value(monkeypatch):
    monkeypatch.setenv("REDIS_HOST", "localhost")
    assert required_env("REDIS_HOST") == "localhost"


def test_required_env_raises_when_missing(monkeypatch):
    monkeypatch.delenv("REDIS_HOST", raising=False)
    with pytest.raises(
        RuntimeError, match="Missing required environment variable: REDIS_HOST"
    ):
        required_env("REDIS_HOST")


def test_cors_origins_splits_and_trims(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://a.example , https://b.example,, ")
    assert cors_origins() == ["https://a.example", "https://b.example"]


def test_cors_origins_raises_when_missing(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    with pytest.raises(
        RuntimeError, match="Missing required environment variable: CORS_ORIGINS"
    ):
        cors_origins()


def test_audio_model_path_reads_the_variable(monkeypatch):
    monkeypatch.setenv("AUDIO_MODEL_PATH", "models/audio.pkl")
    assert audio_model_path() == Path("models/audio.pkl")


def test_audio_model_path_raises_when_missing(monkeypatch):
    monkeypatch.delenv("AUDIO_MODEL_PATH", raising=False)
    with pytest.raises(
        RuntimeError, match="Missing required environment variable: AUDIO_MODEL_PATH"
    ):
        audio_model_path()
