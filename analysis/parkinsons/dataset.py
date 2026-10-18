from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from parkinsons.config import API_COLUMNS, HEALTHY, SUBJECT_COLUMN, TARGET_COLUMN


@dataclass(frozen=True)
class Dataset:
    x: np.ndarray
    y: np.ndarray
    subjects: np.ndarray

    @property
    def features(self) -> list[str]:
        """The API feature names, in the order of `x`'s columns."""
        return list(API_COLUMNS.values())

    @classmethod
    def load(cls, path: Path) -> "Dataset":
        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found at '{path}'. Download it or "
                "set DATASETS_DIR to the folder that holds it."
            )
        # Two header rows: the feature-group names, then the column names.
        df = pd.read_csv(path, header=1)
        return cls(
            x=df[list(API_COLUMNS)].to_numpy(),
            y=df[TARGET_COLUMN].to_numpy(),
            subjects=df[SUBJECT_COLUMN].to_numpy(),
        )

    def summary(self) -> str:
        return (
            f"{len(self.x)} recordings from {len(set(self.subjects))} people, "
            f"{len(set(self.subjects[self.y == HEALTHY]))} of them healthy; "
            f"{self.x.shape[1]} features"
        )
