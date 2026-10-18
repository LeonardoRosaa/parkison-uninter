import pickle
from pathlib import Path

from parkinsons.dataset import Dataset


class ModelExporter:
    """
    Writes the model, the API feature names it expects (in the order it
    expects them) and the range each feature spans in the training data,
    which the API uses to refuse recordings that fall far outside it.
    """

    def __init__(self, dataset: Dataset):
        self.dataset = dataset

    def save(self, model, path: Path) -> None:
        ranges = {
            name: (float(low), float(high))
            for name, low, high in zip(
                self.dataset.features,
                self.dataset.x.min(axis=0),
                self.dataset.x.max(axis=0),
            )
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {"features": self.dataset.features, "ranges": ranges, "model": model},
                f,
            )
