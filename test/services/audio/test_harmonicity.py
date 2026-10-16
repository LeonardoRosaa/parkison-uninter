import numpy as np
import parselmouth
from unittest.mock import MagicMock

import app.services.audio.harmonicity as harmonicity


def _mock_praat_call(hnr_db: float, monkeypatch):
    harmonicity_mock = MagicMock()
    call_results = {
        "To Harmonicity (cc)": harmonicity_mock,
        "Get mean": hnr_db,
    }
    monkeypatch.setattr(
        harmonicity.parselmouth.praat, "call", lambda obj, cmd, *a: call_results[cmd]
    )


def test_nhr_hnr_returns_hnr_in_db(monkeypatch):
    _mock_praat_call(hnr_db=20.0, monkeypatch=monkeypatch)
    sound_mock = MagicMock(spec=parselmouth.Sound)

    _, hnr_val = harmonicity.nhr_hnr(sound=sound_mock, min_f0=75.0)

    assert hnr_val == 20.0


def test_nhr_hnr_derives_nhr_from_hnr(monkeypatch):
    _mock_praat_call(hnr_db=20.0, monkeypatch=monkeypatch)
    sound_mock = MagicMock(spec=parselmouth.Sound)

    nhr_val, _ = harmonicity.nhr_hnr(sound=sound_mock, min_f0=75.0)

    assert np.isclose(nhr_val, 10 ** (-20.0 / 10))  # 0.01


def test_nhr_hnr_zero_hnr_gives_nhr_of_one(monkeypatch):
    _mock_praat_call(hnr_db=0.0, monkeypatch=monkeypatch)
    sound_mock = MagicMock(spec=parselmouth.Sound)

    nhr_val, hnr_val = harmonicity.nhr_hnr(sound=sound_mock, min_f0=75.0)

    assert hnr_val == 0.0
    assert np.isclose(nhr_val, 1.0)
