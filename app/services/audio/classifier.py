import math
import pickle
from dataclasses import dataclass

from app import settings
from app.services.audio.features import VoiceFeatures
from app.services.logger import logger
from app.services.status import AnalysisStatus

model_path = settings.audio_model_path()
if not model_path.exists():
    raise FileNotFoundError(
        f"Audio model not found at '{model_path}'. "
        "Set AUDIO_MODEL_PATH to the correct absolute path."
    )

with open(model_path, "rb") as _f:
    # The model, the names of the features it was trained on (in the order it
    # expects them) and the (low, high) range each spans in the training data.
    _artifact = pickle.load(_f)
loaded_model = _artifact["model"]
model_features: list[str] = _artifact["features"]
training_ranges: dict[str, tuple[float, float]] = _artifact["ranges"]

# How far past the training range, as a fraction of its width, a value may
# fall before the recording counts as unlike anything the model learned from.
RANGE_MARGIN = 0.1

# Training-set means per feature: (healthy, sick).
REFERENCE_MEANS = {
    "MDVP:Jitter(%)": (0.00141, 0.00264),
    "MDVP:Jitter(Abs)": (9.06e-06, 1.93e-05),
    "MDVP:RAP": (0.000314, 0.000704),
    "MDVP:PPQ": (0.000615, 0.00134),
    "Jitter:DDP": (0.000942, 0.00211),
    "MDVP:Shimmer": (0.0556, 0.0715),
    "MDVP:Shimmer(dB)": (0.491, 0.646),
    "Shimmer:APQ3": (0.0295, 0.0360),
    "Shimmer:APQ5": (0.0342, 0.0435),
    "MDVP:APQ": (0.0421, 0.0599),
    "Shimmer:DDA": (0.0884, 0.108),
    "NHR": (0.0332, 0.0572),
    "HNR": (20.87, 18.17),
    "RPDE": (0.431, 0.509),
    "DFA": (0.664, 0.713),
}


@dataclass(frozen=True)
class Classification:
    status: AnalysisStatus
    # The features that put the recording outside the training range; only
    # set when the status is INCONCLUSIVE.
    out_of_range: list[str]


def out_of_range_features(
    values: dict[str, float],
    ranges: dict[str, tuple[float, float]],
    margin: float = RANGE_MARGIN,
) -> list[str]:
    """
    The features whose value falls beyond the training range (plus `margin` of
    its width on each side), or is not a finite number. The model has nothing
    to say about such a recording, so it must not be asked.
    """
    flagged = []
    for name, (low, high) in ranges.items():
        value = values[name]
        slack = (high - low) * margin
        if not math.isfinite(value) or not (low - slack <= value <= high + slack):
            flagged.append(name)
    return flagged


def classify(features: VoiceFeatures) -> Classification:
    out_of_range = out_of_range_features(features.values, training_ranges)
    if out_of_range:
        logger.info(f"[DEBUG] Inconclusive, out of training range: {out_of_range}")
        return Classification(AnalysisStatus.INCONCLUSIVE, out_of_range)

    prediction = loaded_model.predict([features.row(model_features)])[0]
    status = (
        AnalysisStatus.HEALTHY if int(prediction) == 0 else AnalysisStatus.NONHEALTHY
    )
    logger.info(f"[DEBUG] Prediction: {status} (raw={prediction})")
    return Classification(status, [])
