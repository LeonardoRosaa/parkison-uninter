from dataclasses import dataclass

import numpy as np
from sklearn.base import clone
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict

from parkinsons.config import CV_REPEATS, CV_SPLITS, HEALTHY, RANDOM_STATE
from parkinsons.dataset import Dataset


@dataclass(frozen=True)
class Evaluation:
    """Held-out results for one candidate, pooled over all repeats."""

    name: str
    model: object
    y_true: np.ndarray
    y_pred: np.ndarray

    @property
    def accuracy(self) -> float:
        return accuracy_score(self.y_true, self.y_pred)

    @property
    def healthy_precision(self) -> float:
        return precision_score(self.y_true, self.y_pred, pos_label=HEALTHY)

    @property
    def healthy_recall(self) -> float:
        return recall_score(self.y_true, self.y_pred, pos_label=HEALTHY)

    @property
    def healthy_f1(self) -> float:
        return f1_score(self.y_true, self.y_pred, pos_label=HEALTHY)


class CrossValidator:
    def __init__(self, dataset: Dataset):
        self.dataset = dataset

    def evaluate(self, name: str, model) -> Evaluation:
        """
        Held-out predictions for every recording, from folds that never share
        a person between train and test.
        """
        y_pred = []
        for repeat in range(CV_REPEATS):
            folds = StratifiedGroupKFold(
                n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE + repeat
            )
            y_pred.append(
                cross_val_predict(
                    clone(model),
                    self.dataset.x,
                    self.dataset.y,
                    groups=self.dataset.subjects,
                    cv=folds,
                )
            )
        return Evaluation(
            name=name,
            model=model,
            y_true=np.tile(self.dataset.y, CV_REPEATS),
            y_pred=np.concatenate(y_pred),
        )
