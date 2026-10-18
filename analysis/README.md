# Parkinson's voice classifier — training

Trains the classifier the API in the parent directory loads from
`../models/audio.pkl`. This is a standalone uv project: its dependencies
(pandas, matplotlib, Jupyter) are not part of the API.

- The datasets are not part of the project. `train.py` and the notebook read
  them from the folder named by `DATASETS_DIR`. Set it in the shell or in
  `analysis/.env` (copy `.env.example`; a shell value wins). It has no default:
  both fail if it is unset or empty.
  - `pd_classification/pd_speech_features.csv` — the UCI "Parkinson's Disease
    Classification" dataset (756 recordings, 3 per person, 252 people of whom
    64 are healthy; CC BY 4.0). Training reads it. Download it from
    <https://archive.ics.uci.edu/dataset/470/parkinson+s+disease+classification>
    (the zip holds a `.rar` with the CSV).
  - `parkinsons.data` — the older UCI Parkinson's voice dataset (195
    recordings, 32 people). Only the notebook uses it.
- `train.py` writes the best model to the file named by `AUDIO_MODEL_PATH`, set
  the same way and also without a default. A relative path is relative to
  `analysis/`. Point it at the file the API reads: the API takes the same
  variable from the root `.env` (required there too), where a relative path is
  relative to the directory it starts in, so the two values differ by the
  `../`.
- `notebook.ipynb` — exploration plots of the features.
- `train.py` — the training script. The work lives in the `parkinsons/`
  package: `Dataset` (loading), `Candidates` (the models), `CrossValidator`
  (held-out evaluation), `Reporter` (plots and metrics) and `ModelExporter`
  (the pickle).

## Train

```bash
make train
```

Scores logistic regression, SVM and random forest candidates with
cross-validation that splits by person (each person has 3 recordings, so a
split by recording lets the same voice appear in train and test and inflates
every metric). Each candidate's confusion matrix is printed, then it is fitted
on all the data and written, with a metrics table, to `output/` (git-ignored).
The candidate with the best held-out F1 on the healthy class replaces
`../models/audio.pkl`; restart the API to load it.

Of the dataset's 754 columns only the 15 that the API computes are used,
mapped to the API's feature names in `API_COLUMNS` (`parkinsons/config.py`). The pickle
holds `{"features": [...], "model": ...}` so the API picks those features by
name. PPE is left out: its scale differs from the API's.

Only 64 of the 252 people are healthy, so even these metrics are noisy; the
folds are repeated with different shuffles and pooled to smooth that out. The
metrics describe voices recorded like the dataset's, not necessarily a laptop
or phone microphone in an ordinary room. Healthy people are mostly women and
people with Parkinson's mostly men in this dataset, so the model can partly
learn sex instead of disease.

`scikit-learn` is pinned to the same version as the API's, since the API
unpickles the model. Change both pins together.

## Other targets

- `make notebook` — open the exploration notebook.
- `make test` — run the unit tests.
- `make linter`, `make format`, `make static-check` — ruff and ty.
