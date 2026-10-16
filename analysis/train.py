import csv
import pickle
from collections import Counter
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn import svm
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import (
    KNeighborsClassifier,
    NeighborhoodComponentsAnalysis,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ANALYSIS_DIR = Path(__file__).resolve().parent
DATASET_PATH = ANALYSIS_DIR / "data" / "parkinsons.data"
OUTPUT_DIR = ANALYSIS_DIR / "output"
APP_MODEL_PATH = ANALYSIS_DIR.parent / "models" / "audio.pkl"

# Not computed by the API (`app/services/audio/features.py`), so not trained on.
EXCLUDED_COLUMNS = ["name", "spread1", "spread2"]
TARGET_COLUMN = "status"
HEALTHY = 0

RANDOM_STATE = 42


def read_dataset() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(DATASET_PATH)
    x = df.drop(columns=[*EXCLUDED_COLUMNS, TARGET_COLUMN])
    y = df[TARGET_COLUMN]
    return x, y


def candidates() -> list[tuple[str, Pipeline | RandomForestClassifier]]:
    return [
        (
            "K-nearest neighbour",
            Pipeline(
                [
                    ("nca", NeighborhoodComponentsAnalysis(random_state=RANDOM_STATE)),
                    ("knn", KNeighborsClassifier()),
                ]
            ),
        ),
        (
            "Random forest",
            # class_weight='balanced' compensates for the 3:1 nonhealthy:healthy imbalance.
            RandomForestClassifier(random_state=0, class_weight="balanced"),
        ),
        (
            "Support vector machine",
            # Without the scaler the RBF SVM degenerates and predicts the
            # majority class (nonhealthy) almost always.
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    (
                        "svm",
                        svm.SVC(
                            kernel="rbf",
                            C=10,
                            gamma=0.1,
                            probability=True,
                            class_weight="balanced",
                        ),
                    ),
                ]
            ),
        ),
    ]


def save_pickle(model, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(model, f)


def save_confusion_matrix(model, x_test, y_test, name: str) -> None:
    display = ConfusionMatrixDisplay.from_estimator(
        model, x_test, y_test, cmap=plt.cm.Blues
    )
    display.ax_.set_title(f"Confusion matrix - {name}")
    display.figure_.savefig(OUTPUT_DIR / f"{name}.png")
    plt.close(display.figure_)


def save_metrics(rows: list[list[str]]) -> None:
    header = [
        "Algorithm",
        "Accuracy",
        "Healthy precision",
        "Healthy recall",
        "Healthy F1",
    ]

    with open(OUTPUT_DIR / "metrics.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    fig, ax = plt.subplots(figsize=(10, 2))
    ax.axis("off")
    table = ax.table(cellText=rows, colLabels=header, loc="center", cellLoc="center")
    for (row, _), cell in table.get_celld().items():
        if row == 0:
            cell.set_text_props(weight="bold")
    table.scale(1, 2)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "metrics.png")
    plt.close(fig)


def main() -> None:
    # Headless: figures are only saved, never shown.
    matplotlib.use("Agg")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    x, y = read_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, stratify=y, test_size=0.2, random_state=RANDOM_STATE
    )

    print(f"Training set before SMOTE: {Counter(y_train.tolist())}")
    x_res, y_res = SMOTE(random_state=RANDOM_STATE).fit_resample(x_train, y_train)
    print(f"Training set after SMOTE:  {Counter(y_res.tolist())}")

    rows = []
    best_name, best_model, best_healthy_f1 = None, None, -1.0

    for name, model in candidates():
        # Fitted on plain arrays: the API predicts on unnamed rows.
        model.fit(x_res.values, y_res)
        y_pred = model.predict(x_test.values)

        save_pickle(model, OUTPUT_DIR / f"{name}.pkl")
        save_confusion_matrix(model, x_test.values, y_test, name)

        healthy_f1 = f1_score(y_test, y_pred, pos_label=HEALTHY)
        rows.append(
            [
                name,
                f"{accuracy_score(y_test, y_pred) * 100:.2f}%",
                f"{precision_score(y_test, y_pred, pos_label=HEALTHY):.2f}",
                f"{recall_score(y_test, y_pred, pos_label=HEALTHY):.2f}",
                f"{healthy_f1:.2f}",
            ]
        )

        # Ranked by the minority (healthy) class, the one the API keeps misclassifying.
        if healthy_f1 > best_healthy_f1:
            best_name, best_model, best_healthy_f1 = name, model, healthy_f1

    save_metrics(rows)
    for row in rows:
        print(" | ".join(row))

    save_pickle(best_model, APP_MODEL_PATH)
    print(
        f"Best model: {best_name} (healthy F1={best_healthy_f1:.2f}) "
        f"saved to {APP_MODEL_PATH.relative_to(ANALYSIS_DIR.parent)}"
    )


if __name__ == "__main__":
    main()
