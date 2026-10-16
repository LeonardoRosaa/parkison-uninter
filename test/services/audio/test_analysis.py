import numpy as np

from app.services.audio.analysis import display_metrics


def test_display_metrics_converts_fractions_to_percent():
    metrics = display_metrics(fo_hz=154.2, jitter=0.0039, shimmer=0.0312, hnr_db=21.4)

    assert metrics["f0_hz"] == 154.2
    assert metrics["hnr_db"] == 21.4
    np.testing.assert_allclose(metrics["jitter_percent"], 0.39)
    np.testing.assert_allclose(metrics["shimmer_percent"], 3.12)


def test_display_metrics_reports_unmeasurable_values_as_none():
    metrics = display_metrics(
        fo_hz=float("nan"), jitter=float("nan"), shimmer=0.0312, hnr_db=float("inf")
    )

    assert metrics["f0_hz"] is None
    assert metrics["jitter_percent"] is None
    assert metrics["hnr_db"] is None
    np.testing.assert_allclose(metrics["shimmer_percent"], 3.12)
