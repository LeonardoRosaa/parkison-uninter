# Parkinson's voice classifier — training

Trains the classifier the API in the parent directory loads from
`../models/audio.pkl`. This is a standalone uv project: its dependencies
(pandas, matplotlib, imbalanced-learn, Jupyter) are not part of the API.

- `data/parkinsons.data` — the UCI Parkinson's voice dataset.
- `notebook.ipynb` — exploration plots of the features.
- `train.py` — the training script.

## Train

```bash
make train
```

Fits k-nearest neighbour, random forest and SVM candidates on a SMOTE-balanced
training split, then writes each model, its confusion matrix and a metrics
table to `output/` (git-ignored). The candidate with the best F1 on the
healthy class replaces `../models/audio.pkl`; restart the API to load it.

`scikit-learn` is pinned to the same version as the API's, since the API
unpickles the model. Change both pins together.

## Other targets

- `make notebook` — open the exploration notebook.
- `make linter`, `make format`, `make static-check` — ruff and ty.
