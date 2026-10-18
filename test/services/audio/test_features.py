import numpy as np

from app.services.audio.features import VoiceFeatures, longest_voiced_segment


class FakePitch:
    def __init__(self, frequencies, time_step=0.01):
        self._frequencies = np.array(frequencies, dtype=float)
        self._xs = np.arange(len(frequencies)) * time_step + time_step

    @property
    def selected_array(self):
        return {"frequency": self._frequencies}

    def xs(self):
        return self._xs


def test_longest_voiced_segment_picks_the_longer_of_two_runs():
    # short run (2 frames) ... gap ... long run (4 frames)
    pitch = FakePitch([100, 100, 0, 0, 150, 150, 150, 150])

    segment = longest_voiced_segment(pitch, pad=0.0)

    assert segment is not None
    np.testing.assert_allclose(segment, (0.05, 0.08))


def test_longest_voiced_segment_pads_and_clips_at_zero():
    pitch = FakePitch([120, 120, 120])

    segment = longest_voiced_segment(pitch, pad=0.05)

    assert segment is not None
    start, end = segment
    assert start == 0.0  # padding would go negative, clipped to 0
    assert end == pitch.xs()[-1] + 0.05


def test_longest_voiced_segment_returns_none_when_never_voiced():
    pitch = FakePitch([0, 0, 0, 0])

    assert longest_voiced_segment(pitch) is None


def test_longest_voiced_segment_handles_run_extending_to_end():
    # run reaching the last frame must still be considered
    pitch = FakePitch([0, 100, 100, 100])

    segment = longest_voiced_segment(pitch, pad=0.0)

    assert segment is not None
    np.testing.assert_allclose(segment, (0.02, 0.04))


def test_row_picks_the_named_values_in_the_requested_order():
    features = VoiceFeatures(
        values={"HNR": 21.0, "MDVP:Fo(Hz)": 120.0, "DFA": 0.7}, pitch_measured=True
    )

    assert features.row(["DFA", "HNR"]) == [0.7, 21.0]
