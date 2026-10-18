from uuid import UUID

import numpy as np

from app.services.audio.classifier import REFERENCE_MEANS, classify
from app.services.audio.features import VoiceFeatures, extract_features
from app.services.logger import logger
from app.services.redis import redis_client
from app.services.status import AnalysisStatus


def display_metrics(
    fo_hz: float, jitter: float, shimmer: float, hnr_db: float
) -> dict[str, float | None]:
    """
    The four measurements shown to the user, in display units.

    Jitter and shimmer are Praat fractions and are reported as percentages.
    A value Praat could not measure (NaN/undefined) is reported as None
    rather than a number the user would read as their own voice.
    """

    def measured(value: float, scale: float = 1.0) -> float | None:
        return float(value) * scale if np.isfinite(value) else None

    return {
        "f0_hz": measured(fo_hz),
        "jitter_percent": measured(jitter, 100.0),
        "shimmer_percent": measured(shimmer, 100.0),
        "hnr_db": measured(hnr_db),
    }


def _log_features(request_id: UUID, features: VoiceFeatures) -> None:
    logger.info(f"[DEBUG] Features for request_id={request_id}:")
    for name, value in features.values.items():
        ref = REFERENCE_MEANS.get(name)
        note = f"  (healthy≈{ref[0]:.3f}, sick≈{ref[1]:.3f})" if ref else ""
        logger.info(f"  {name}: {value:.6f}{note}")


def analysis(path: str, request_id: UUID):
    logger.info(f"Analyzing audio from {request_id}")
    redis_client.set_status(str(request_id), AnalysisStatus.LOADING)

    features = extract_features(path, request_id)
    _log_features(request_id, features)
    classification = classify(features)

    # The model needs numbers, so pitch falls back to fixed values during
    # extraction; the user must not be shown measurements derived from a
    # pitch that was never detected in their recording.
    unmeasured = float("nan")
    shown = features.values if features.pitch_measured else {}
    metrics = display_metrics(
        fo_hz=shown.get("MDVP:Fo(Hz)", unmeasured),
        jitter=shown.get("MDVP:Jitter(%)", unmeasured),
        shimmer=shown.get("MDVP:Shimmer", unmeasured),
        hnr_db=shown.get("HNR", unmeasured),
    )
    redis_client.set_status(
        str(request_id),
        classification.status,
        metrics=metrics,
        out_of_range=classification.out_of_range or None,
    )
