import pandas as pd
import pytest

from parkinsons.config import API_COLUMNS
from parkinsons.dataset import Dataset


def write_csv(path, rows):
    """Two header rows like the UCI file: the group names, then the columns."""
    columns = ["id", "gender", "class", *API_COLUMNS, "extraColumn"]
    frame = pd.DataFrame(rows, columns=columns)
    with open(path, "w") as f:
        f.write("," * (len(columns) - 1) + "\n")
        frame.to_csv(f, index=False)


def row(subject, label, value):
    return [subject, 1, label, *[value] * len(API_COLUMNS), 999.0]


def test_loads_only_the_api_columns_in_api_order(tmp_path):
    path = tmp_path / "features.csv"
    write_csv(path, [row(0, 1, 0.5), row(0, 1, 1.5), row(1, 0, 2.5)])

    dataset = Dataset.load(path)

    assert dataset.x.shape == (3, len(API_COLUMNS))
    assert 999.0 not in dataset.x
    assert dataset.x[:, 0].tolist() == [0.5, 1.5, 2.5]
    assert dataset.y.tolist() == [1, 1, 0]
    assert dataset.subjects.tolist() == [0, 0, 1]


def test_features_are_the_api_names(tmp_path):
    path = tmp_path / "features.csv"
    write_csv(path, [row(0, 1, 0.5)])

    assert Dataset.load(path).features == list(API_COLUMNS.values())


def test_summary_counts_people_not_recordings(tmp_path):
    path = tmp_path / "features.csv"
    write_csv(path, [row(0, 1, 0.5), row(0, 1, 0.5), row(1, 0, 0.5), row(1, 0, 0.5)])

    assert Dataset.load(path).summary() == (
        "4 recordings from 2 people, 1 of them healthy; 15 features"
    )


def test_missing_file_explains_how_to_fix_it(tmp_path):
    with pytest.raises(FileNotFoundError, match="DATASETS_DIR"):
        Dataset.load(tmp_path / "missing.csv")
