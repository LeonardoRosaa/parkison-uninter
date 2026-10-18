import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ANALYSIS_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ANALYSIS_DIR / ".env"
OUTPUT_DIR = ANALYSIS_DIR / "output"

SUBJECT_COLUMN = "id"
TARGET_COLUMN = "class"
HEALTHY = 0
NONHEALTHY = 1

API_COLUMNS = {
    "locPctJitter": "MDVP:Jitter(%)",
    "locAbsJitter": "MDVP:Jitter(Abs)",
    "rapJitter": "MDVP:RAP",
    "ppq5Jitter": "MDVP:PPQ",
    "ddpJitter": "Jitter:DDP",
    "locShimmer": "MDVP:Shimmer",
    "locDbShimmer": "MDVP:Shimmer(dB)",
    "apq3Shimmer": "Shimmer:APQ3",
    "apq5Shimmer": "Shimmer:APQ5",
    "apq11Shimmer": "MDVP:APQ",
    "ddaShimmer": "Shimmer:DDA",
    "meanNoiseToHarmHarmonicity": "NHR",
    "meanHarmToNoiseHarmonicity": "HNR",
    "RPDE": "RPDE",
    "DFA": "DFA",
}

RANDOM_STATE = 42

# Each person has 3 recordings, so folds are split by person
CV_SPLITS = 4
CV_REPEATS = 5


class MissingEnvironmentVariable(RuntimeError):
    def __init__(self, name: str):
        super().__init__(f"The environment variable {name} must be set and not empty.")


def require_env(name: str, env_file: Path = ENV_FILE) -> str:
    """
    The variable's value, from the environment or else from `env_file`.
    Raises when it is missing or blank: there are no defaults.
    """
    # Never overrides what is already in the environment.
    load_dotenv(env_file)
    value = os.environ.get(name)
    if value is None or not value.strip():
        raise MissingEnvironmentVariable(name)
    return value


@dataclass(frozen=True)
class Config:
    datasets_dir: Path
    # Where the API loads its model from.
    model_path: Path

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            datasets_dir=Path(require_env("DATASETS_DIR")).expanduser(),
            # A relative path is relative to `analysis/`, wherever this runs from.
            model_path=ANALYSIS_DIR
            / Path(require_env("AUDIO_MODEL_PATH")).expanduser(),
        )

    @property
    def speech_features_path(self) -> Path:
        return self.datasets_dir / "pd_classification" / "pd_speech_features.csv"
