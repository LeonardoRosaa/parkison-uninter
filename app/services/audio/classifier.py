import pickle

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
    loaded_model = pickle.load(_f)

# Training-set means per column: (healthy, sick).
REFERENCE_MEANS = {
    "MDVP:Fo(Hz)": (181.9, 145.2),
    "MDVP:Fhi(Hz)": (223.6, 188.4),
    "MDVP:Flo(Hz)": (145.2, 106.9),
    "MDVP:Jitter(%)": (0.0039, 0.0070),
    "NHR": (0.0115, 0.0292),
    "HNR": (24.68, 20.97),
    "RPDE": (0.443, 0.517),
    "DFA": (0.696, 0.725),
    "D2": (2.155, 2.456),
    "PPE": (0.123, 0.234),
}


def classify(features: VoiceFeatures) -> AnalysisStatus:
    prediction = loaded_model.predict([features.model_row()])[0]
    status = (
        AnalysisStatus.HEALTHY if int(prediction) == 0 else AnalysisStatus.NONHEALTHY
    )
    logger.info(f"[DEBUG] Prediction: {status} (raw={prediction})")
    return status
