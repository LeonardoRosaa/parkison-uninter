import pytest

from app.settings import cors_origins, required_env


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
