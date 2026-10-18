from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from dataclasses import dataclass
from uuid import UUID

import librosa
import numpy as np
import parselmouth

from app.services.audio import correlation_dimension, dfa, harmonicity, ppe, rpde
from app.services.logger import logger

_NONLINEAR_SR = 4000
_NONLINEAR_MAX_SAMPLES = 20_000

# Pitch search range shared by the pitch tracker and the pulse detector.
_PITCH_FLOOR_HZ = 75.0
_PITCH_CEILING_HZ = 600.0

# Praat's jitter/shimmer period filter. The same limits select the
# inter-pulse intervals PPE is computed from.
_WHOLE_RECORDING = (0, 0)  # Praat time range; 0, 0 means the full duration
_MIN_PERIOD_S = 0.0001
_MAX_PERIOD_S = 0.02
_MAX_PERIOD_FACTOR = 1.3
_MAX_AMPLITUDE_FACTOR = 1.6
_PERIOD_FILTER = (*_WHOLE_RECORDING, _MIN_PERIOD_S, _MAX_PERIOD_S, _MAX_PERIOD_FACTOR)

# Model column name -> Praat measure, in the model's column order.
_JITTER_MEASURES = {
    "MDVP:Jitter(%)": "local",
    "MDVP:Jitter(Abs)": "local, absolute",
    "MDVP:RAP": "rap",
    "MDVP:PPQ": "ppq5",
    "Jitter:DDP": "ddp",
}
_SHIMMER_MEASURES = {
    "MDVP:Shimmer": "local",
    "MDVP:Shimmer(dB)": "local_dB",
    "Shimmer:APQ3": "apq3",
    "Shimmer:APQ5": "apq5",
    "MDVP:APQ": "apq11",
    "Shimmer:DDA": "dda",
}

# Stand-ins for a pitch Praat could not measure: the model needs numbers.
_FALLBACK_FO_HZ, _FALLBACK_FHI_HZ, _FALLBACK_FLO_HZ = 154.0, 197.0, 116.0


def _new_executor() -> ProcessPoolExecutor:
    return ProcessPoolExecutor(max_workers=4)


_executor = _new_executor()


@dataclass(frozen=True)
class VoiceFeatures:
    """
    The model's inputs for one recording.

    `values` is keyed by feature name; the model reads the ones it was
    trained on by name (see `row`). `pitch_measured` is False when the pitch
    columns hold fallback values rather than measurements.
    """

    values: dict[str, float]
    pitch_measured: bool

    def row(self, names: list[str]) -> list[float]:
        """The named values as one input row, in the order of `names`."""
        return [self.values[name] for name in names]


def shutdown_executor() -> None:
    _executor.shutdown(wait=True)


def run_correlation_dimension(y):
    # m=3, tau=7 match the same reconstructed-state-space embedding Little
    # et al. 2007 use for RPDE (see rpde.rpde) — D2 is a property of the
    # same attractor geometry recovered from the same embedding.
    # theiler=40 ≈ one full pitch period at 100 Hz, excluding autocorrelated neighbours.
    return correlation_dimension.correlation_dimension(
        y=y, m=3, tau=7, theiler=40, n_r=25
    )


def _correlation_dimension_in_subprocess(y) -> float:
    global _executor
    try:
        return _executor.submit(run_correlation_dimension, y).result()
    except BrokenProcessPool:
        _executor = _new_executor()
        return _executor.submit(run_correlation_dimension, y).result()


def _voiced(f0: np.ndarray) -> np.ndarray:
    """The frames of an F0 track where a pitch was detected."""
    return f0[f0 > 0]


def longest_voiced_segment(pitch_obj, pad: float = 0.05) -> tuple[float, float] | None:
    """
    Time range (seconds) of the longest unbroken run of voiced frames in a
    parselmouth Pitch object, padded by `pad` seconds on each side.

    RPDE/DFA/D2 assume a single continuous sustained-vowel phonation (Little
    et al. 2007 model the recording as one attractor). A recording that
    contains a false start, a breath, or a second take produces multiple
    voiced runs separated by silence/noise; trimming only the leading and
    trailing silence (as librosa.effects.trim does) leaves that internal gap
    in the signal, corrupting the recurrence/fluctuation statistics with a
    non-phonation segment. Isolating the longest run keeps only one take.

    Returns None if no frame is voiced.
    """
    f0 = pitch_obj.selected_array["frequency"]
    xs = pitch_obj.xs()
    voiced = f0 > 0

    best_start = best_end = None
    best_len = 0
    start = None
    for i, is_voiced in enumerate(voiced):
        if is_voiced and start is None:
            start = i
        if not is_voiced and start is not None:
            if i - start > best_len:
                best_len, best_start, best_end = i - start, start, i
            start = None
    if start is not None and len(voiced) - start > best_len:
        best_len, best_start, best_end = len(voiced) - start, start, len(voiced)

    if best_start is None or best_end is None:
        return None
    return max(0.0, xs[best_start] - pad), xs[best_end - 1] + pad


def _inter_pulse_intervals(point_process) -> np.ndarray:
    """Glottal pulse spacings that pass the same period filter as Praat's jitter calls."""
    n_pulses = int(parselmouth.praat.call(point_process, "Get number of points"))
    if n_pulses < 2:
        return np.array([])

    pulse_times = np.array(
        [
            parselmouth.praat.call(point_process, "Get time from index", i)
            for i in range(1, n_pulses + 1)
        ]
    )
    raw_ipi = np.diff(pulse_times)
    med = np.median(raw_ipi)
    return raw_ipi[
        (raw_ipi >= _MIN_PERIOD_S)
        & (raw_ipi <= _MAX_PERIOD_S)
        & (raw_ipi / med <= _MAX_PERIOD_FACTOR)
        & (med / raw_ipi <= _MAX_PERIOD_FACTOR)
    ]


def extract_features(path: str, request_id: UUID) -> VoiceFeatures:
    """Measure one recording. `request_id` only labels the warnings logged."""
    y, sr = librosa.load(path, sr=None)
    sound = parselmouth.Sound(path)

    # Parselmouth autocorrelation pitch tracker — has octave-jump correction
    # built in, making it more robust than pyin for voice recordings.
    # pyin detects at sub-harmonic frequencies for some voices, shifting
    # Fo/Fhi/Flo and PPE entirely outside the training distribution.
    pitch_obj = parselmouth.praat.call(
        sound,
        "To Pitch (ac)",
        0.0,  # time step (0 = auto ~10 ms)
        _PITCH_FLOOR_HZ,
        15,  # max candidates
        False,  # very accurate
        0.03,  # silence threshold
        0.45,  # voicing threshold
        0.01,  # octave cost
        0.35,  # octave jump cost
        0.14,  # voiced/unvoiced cost
        _PITCH_CEILING_HZ,
    )

    mdvp_fo_hz = parselmouth.praat.call(
        pitch_obj, "Get mean", *_WHOLE_RECORDING, "Hertz"
    )
    mdvp_fhi_hz = parselmouth.praat.call(
        pitch_obj, "Get maximum", *_WHOLE_RECORDING, "Hertz", "Parabolic"
    )
    mdvp_flo_hz = parselmouth.praat.call(
        pitch_obj, "Get minimum", *_WHOLE_RECORDING, "Hertz", "Parabolic"
    )
    pitch_measured = all(np.isfinite([mdvp_fo_hz, mdvp_fhi_hz, mdvp_flo_hz]))

    if not pitch_measured:
        logger.warning(
            f"Pitch detection returned NaN for request_id={request_id}; using fallback"
        )
        mdvp_fo_hz, mdvp_fhi_hz, mdvp_flo_hz = (
            _FALLBACK_FO_HZ,
            _FALLBACK_FHI_HZ,
            _FALLBACK_FLO_HZ,
        )

    f0_track = pitch_obj.selected_array["frequency"]

    # Isolate the longest continuous voiced take before building the signal
    # RPDE/DFA/D2 run on (see longest_voiced_segment docstring). Only these
    # three features are scoped to the isolated take: Fo/Fhi/Flo, jitter,
    # shimmer, NHR, and HNR (below) intentionally still analyze the full
    # recording — issue 01 validated those against real recordings and
    # scoped them out of this pass.
    #
    # Falls back to the full recording if voicing detection found nothing,
    # if the segment's own time range doesn't fall inside the decoded
    # waveform (parselmouth and librosa decode the file independently and
    # can disagree slightly on duration for non-WAV formats), or if the
    # resulting slice is empty.
    segment = longest_voiced_segment(pitch_obj)
    y_segment = y
    segment_fo_hz = mdvp_fo_hz
    if segment:
        duration = len(y) / sr
        t0, t1 = max(0.0, segment[0]), min(segment[1], duration)
        candidate = y[int(t0 * sr) : int(t1 * sr)]
        if len(candidate) > 0:
            y_segment = candidate
            seg_frame_mask = (pitch_obj.xs() >= t0) & (pitch_obj.xs() <= t1)
            seg_f0 = _voiced(f0_track[seg_frame_mask])
            if len(seg_f0) > 0:
                segment_fo_hz = float(np.mean(seg_f0))
        else:
            logger.warning(
                f"Isolated voiced segment was empty for request_id={request_id}; "
                "falling back to the full recording"
            )
    else:
        logger.warning(
            f"No voiced frames detected for request_id={request_id}; "
            "using the full recording for RPDE/DFA/D2"
        )

    y_low = librosa.resample(y_segment, orig_sr=sr, target_sr=_NONLINEAR_SR)
    y_low, _ = librosa.effects.trim(y_low, top_db=20)
    y_low = y_low[:_NONLINEAR_MAX_SAMPLES]

    # PointProcess using parselmouth pitch range (guards against 0-Hz floor crash)
    f0_floor = max(_PITCH_FLOOR_HZ, mdvp_flo_hz * 0.9)
    f0_ceiling = min(_PITCH_CEILING_HZ, mdvp_fhi_hz * 1.1)
    point_process = parselmouth.praat.call(
        sound, "To PointProcess (periodic, cc)", f0_floor, f0_ceiling
    )

    jitter = {
        name: parselmouth.praat.call(
            point_process, f"Get jitter ({measure})", *_PERIOD_FILTER
        )
        for name, measure in _JITTER_MEASURES.items()
    }
    shimmer = {
        name: parselmouth.praat.call(
            [sound, point_process],
            f"Get shimmer ({measure})",
            *_PERIOD_FILTER,
            _MAX_AMPLITUDE_FACTOR,
        )
        for name, measure in _SHIMMER_MEASURES.items()
    }

    nhr, hnr = harmonicity.nhr_hnr(sound=sound, min_f0=mdvp_flo_hz)

    # RPDE and DFA are computed directly on the raw (downsampled, trimmed)
    # acoustic waveform — both are defined on the sustained-vowel signal
    # itself in Little et al. 2007, not on a derived period series.
    # radius=0.5 is the upper end of the paper's own close-returns search
    # grid (r = 0.02, 0.04, ..., 0.5 — Sec. "Recurrence Period Density
    # Entropy"): the paper explicitly treats r as something to calibrate
    # per signal rather than a fixed universal constant.
    rpde_result = rpde.rpde(y=y_low, tau=7, radius=0.5)
    # DFA window sizes are capped to one pitch period: the paper limits DFA
    # to "a much shorter time scale" than the vocal-fold oscillation itself
    # (see dfa.dfa docstring) so that the periodic vibration doesn't leak
    # into the stochastic-noise scaling exponent. Uses segment_fo_hz (the
    # isolated segment's own mean F0) rather than mdvp_fo_hz (the
    # full-recording MDVP feature) so the cap matches the pitch of the
    # signal y_low actually contains.
    pitch_period_samples = (
        int(_NONLINEAR_SR / segment_fo_hz) if segment_fo_hz > 0 else None
    )
    dfa_result = dfa.dfa(signal=y_low, max_scale=pitch_period_samples)

    # PPE needs a pitch-period sequence (Little et al. 2009). Prefer the
    # inter-pulse intervals (IPI) that jitter/shimmer already use, falling
    # back to parselmouth's frame-level F0 track when too few pulses were
    # found for a reliable period sequence.
    ipi = _inter_pulse_intervals(point_process)
    if len(ipi) >= 10:
        ppe_result = ppe.pitch_period_entropy(T=ipi)
    else:
        logger.warning(
            f"Too few valid IPI values (n={len(ipi)}) for PPE; "
            "falling back to parselmouth frame-level F0"
        )
        f0_voiced = _voiced(f0_track)
        ppe_result = (
            ppe.pitch_period_entropy(T=1.0 / f0_voiced) if len(f0_voiced) >= 10 else 0.0
        )

    return VoiceFeatures(
        values={
            "MDVP:Fo(Hz)": mdvp_fo_hz,
            "MDVP:Fhi(Hz)": mdvp_fhi_hz,
            "MDVP:Flo(Hz)": mdvp_flo_hz,
            **jitter,
            **shimmer,
            "NHR": nhr,
            "HNR": hnr,
            "RPDE": rpde_result,
            "DFA": dfa_result,
            "D2": _correlation_dimension_in_subprocess(y_low),
            "PPE": ppe_result,
        },
        pitch_measured=pitch_measured,
    )
