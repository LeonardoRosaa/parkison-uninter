from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from parkinsons.config import RANDOM_STATE


class Candidates:
    @staticmethod
    def build() -> list[tuple[str, Pipeline | RandomForestClassifier]]:
        """The unfitted models to compare, by name."""
        # `class_weight` compensates for the 3:1 nonhealthy:healthy imbalance.
        return [
            (
                "Logistic regression",
                Pipeline(
                    [
                        ("scaler", StandardScaler()),
                        (
                            "logreg",
                            LogisticRegression(
                                C=0.1, class_weight="balanced", max_iter=3000
                            ),
                        ),
                    ]
                ),
            ),
            (
                "Support vector machine",
                Pipeline(
                    [
                        ("scaler", StandardScaler()),
                        ("svm", SVC(C=1, class_weight="balanced")),
                    ]
                ),
            ),
            (
                "Random forest",
                RandomForestClassifier(
                    n_estimators=300,
                    class_weight="balanced_subsample",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
