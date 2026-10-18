"""Environment configuration, read at call time so a changed environment is seen."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def redis_url() -> str | None:
    """A single connection URL (as hosting platforms provide), if configured."""
    return os.getenv("REDIS_URL", "").strip() or None


def cors_origins() -> list[str]:
    configured = required_env("CORS_ORIGINS")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def ws_timeout_seconds() -> float:
    return float(os.getenv("WS_TIMEOUT_SECONDS", "300"))


def audio_model_path() -> Path:
    return Path(required_env("AUDIO_MODEL_PATH"))
