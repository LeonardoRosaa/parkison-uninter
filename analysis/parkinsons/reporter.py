import csv
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import confusion_matrix

from parkinsons.config import HEALTHY, NONHEALTHY
from parkinsons.evaluation import Evaluation

HEADER = [
    "Algorithm",
    "Accuracy",
    "Healthy precision",
    "Healthy recall",
    "Healthy F1",
]


class Reporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def row(evaluation: Evaluation) -> list[str]:
        return [
            evaluation.name,
            f"{evaluation.accuracy * 100:.2f}%",
            f"{evaluation.healthy_precision:.2f}",
            f"{evaluation.healthy_recall:.2f}",
            f"{evaluation.healthy_f1:.2f}",
        ]

    @staticmethod
    def print_confusion_matrix(evaluation: Evaluation) -> None:
        names = {HEALTHY: "healthy", NONHEALTHY: "nonhealthy"}
        labels = list(names)
        matrix = pd.DataFrame(
            confusion_matrix(evaluation.y_true, evaluation.y_pred, labels=labels),
            index=[f"actual {names[label]}" for label in labels],
            columns=[f"predicted {names[label]}" for label in labels],
        )
        print(f"Confusion matrix - {evaluation.name} (held-out people)")
        print(matrix.to_string())

    def save_metrics(self, evaluations: list[Evaluation]) -> list[list[str]]:
        rows = [self.row(evaluation) for evaluation in evaluations]

        with open(self.output_dir / "metrics.csv", "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(HEADER)
            writer.writerows(rows)

        fig, ax = plt.subplots(figsize=(10, 2))
        ax.axis("off")
        table = ax.table(
            cellText=rows, colLabels=HEADER, loc="center", cellLoc="center"
        )
        for (row, _), cell in table.get_celld().items():
            if row == 0:
                cell.set_text_props(weight="bold")
        table.scale(1, 2)
        fig.tight_layout()
        fig.savefig(self.output_dir / "metrics.png")
        plt.close(fig)
        return rows
