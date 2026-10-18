import matplotlib

from parkinsons.candidates import Candidates
from parkinsons.config import OUTPUT_DIR, Config
from parkinsons.dataset import Dataset
from parkinsons.evaluation import CrossValidator
from parkinsons.exporter import ModelExporter
from parkinsons.reporter import Reporter


def main() -> None:
    # Headless: figures are only saved, never shown.
    matplotlib.use("Agg")
    config = Config.from_env()

    dataset = Dataset.load(config.speech_features_path)
    print(dataset.summary())

    validator = CrossValidator(dataset)
    reporter = Reporter(OUTPUT_DIR)
    exporter = ModelExporter(dataset)

    evaluations = []
    for name, model in Candidates.build():
        evaluation = validator.evaluate(name, model)
        reporter.print_confusion_matrix(evaluation)

        # The shipped model learns from every person; the reported metrics
        # come from the held-out folds, not from this fit.
        model.fit(dataset.x, dataset.y)
        exporter.save(model, OUTPUT_DIR / f"{name}.pkl")
        evaluations.append(evaluation)

    for row in reporter.save_metrics(evaluations):
        print(" | ".join(row))

    # Ranked by the minority (healthy) class, the one the API keeps misclassifying.
    best = max(evaluations, key=lambda evaluation: evaluation.healthy_f1)
    exporter.save(best.model, config.model_path)
    print(
        f"Best model: {best.name} (healthy F1={best.healthy_f1:.2f}) "
        f"saved to {config.model_path}"
    )


if __name__ == "__main__":
    main()
