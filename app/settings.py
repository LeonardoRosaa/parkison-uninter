"""Environment configuration, read at call time so a changed environment is seen."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "audio.pkl"


def required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def cors_origins() -> list[str]:
    configured = required_env("CORS_ORIGINS")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def ws_timeout_seconds() -> float:
    return float(os.getenv("WS_TIMEOUT_SECONDS", "300"))


def audio_model_path() -> Path:
    return Path(os.getenv("AUDIO_MODEL_PATH", str(_DEFAULT_MODEL_PATH)))
