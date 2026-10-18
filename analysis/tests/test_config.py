from pathlib import Path

import pytest

from parkinsons.config import (
    ANALYSIS_DIR,
    Config,
    MissingEnvironmentVariable,
    require_env,
)


@pytest.fixture
def no_env_file(tmp_path):
    return tmp_path / ".env"


def test_returns_the_value_when_set(monkeypatch, no_env_file):
    monkeypatch.setenv("DATASETS_DIR", "/data")

    assert require_env("DATASETS_DIR", env_file=no_env_file) == "/data"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_raises_when_unset_empty_or_blank(monkeypatch, no_env_file, value):
    if value is None:
        monkeypatch.delenv("DATASETS_DIR", raising=False)
    else:
        monkeypatch.setenv("DATASETS_DIR", value)

    with pytest.raises(MissingEnvironmentVariable, match="DATASETS_DIR"):
        require_env("DATASETS_DIR", env_file=no_env_file)


def test_reads_the_value_from_the_env_file(monkeypatch, tmp_path):
    monkeypatch.delenv("DATASETS_DIR", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("DATASETS_DIR=/from-file\n")

    assert require_env("DATASETS_DIR", env_file=env_file) == "/from-file"


def test_the_environment_wins_over_the_env_file(monkeypatch, tmp_path):
    monkeypatch.setenv("DATASETS_DIR", "/from-shell")
    env_file = tmp_path / ".env"
    env_file.write_text("DATASETS_DIR=/from-file\n")

    assert require_env("DATASETS_DIR", env_file=env_file) == "/from-shell"


def test_an_empty_value_in_the_env_file_raises(monkeypatch, tmp_path):
    monkeypatch.delenv("DATASETS_DIR", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("DATASETS_DIR=\n")

    with pytest.raises(MissingEnvironmentVariable):
        require_env("DATASETS_DIR", env_file=env_file)


def test_config_reads_the_model_path_and_datasets_dir(monkeypatch):
    monkeypatch.setenv("DATASETS_DIR", "/data")
    monkeypatch.setenv("AUDIO_MODEL_PATH", "/models/audio.pkl")

    config = Config.from_env()

    assert config.datasets_dir == Path("/data")
    assert config.model_path == Path("/models/audio.pkl")


def test_a_relative_model_path_is_relative_to_the_analysis_dir(monkeypatch):
    monkeypatch.setenv("DATASETS_DIR", "/data")
    monkeypatch.setenv("AUDIO_MODEL_PATH", "../models/audio.pkl")

    assert Config.from_env().model_path == ANALYSIS_DIR / "../models/audio.pkl"
