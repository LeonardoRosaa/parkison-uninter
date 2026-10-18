import pickle

import numpy as np
from sklearn.linear_model import LogisticRegression

from parkinsons.dataset import Dataset
from parkinsons.exporter import ModelExporter


def test_pickle_holds_features_ranges_and_model(tmp_path):
    x = np.arange(30, dtype=float).reshape(2, 15)
    x[1, 0] = -4.0
    dataset = Dataset(x=x, y=np.array([0, 1]), subjects=np.array([0, 1]))
    model = LogisticRegression().fit(x, dataset.y)
    path = tmp_path / "nested" / "model.pkl"

    ModelExporter(dataset).save(model, path)

    with open(path, "rb") as f:
        saved = pickle.load(f)
    assert set(saved) == {"features", "ranges", "model"}
    assert saved["features"] == dataset.features
    assert saved["ranges"]["MDVP:Jitter(%)"] == (-4.0, 0.0)
    assert saved["ranges"]["DFA"] == (14.0, 29.0)
    assert saved["model"].predict(x).tolist() == model.predict(x).tolist()
