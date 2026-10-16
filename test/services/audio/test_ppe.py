import numpy as np

import app.services.audio.ppe as ppe


def test_pitch_period_entropy_returns_nan_for_short_or_empty_input():
    assert np.isnan(ppe.pitch_period_entropy(np.array([0.01, 0.02, 0.03])))
    assert np.isnan(ppe.pitch_period_entropy(np.array([np.nan, np.inf, -np.inf])))


def test_pitch_period_entropy_returns_normalized_entropy_for_valid_input():
    T = np.array(
        [
            0.010,
            0.011,
            0.012,
            0.013,
            0.014,
            0.015,
            0.016,
            0.017,
            0.018,
            0.019,
            0.020,
            0.021,
        ]
    )

    result = ppe.pitch_period_entropy(T)

    assert np.isfinite(result)
    assert 0.0 <= result <= 1.0


def test_pitch_period_entropy_returns_zero_for_single_occupied_bin():
    T = np.ones(20) * 0.01

    result = ppe.pitch_period_entropy(T)

    assert result == 0.0
