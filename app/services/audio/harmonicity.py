import parselmouth


def nhr_hnr(sound: parselmouth.Sound, min_f0: float) -> tuple[float, float]:
    """
    Compute NHR (Noise-to-Harmonics Ratio, linear) and HNR (Harmonics-to-Noise
    Ratio, dB) via Praat's cross-correlation harmonicity method.

    Parameters
    ----------
    sound : parselmouth.Sound
        Praat Sound object for the recording.
    min_f0 : float
        Minimum expected fundamental frequency (Hz); used as the Praat pitch floor.

    Returns
    -------
    nhr : float
        Linear noise-to-harmonics ratio (10 ** (-hnr_db / 10)).
    hnr : float
        Harmonics-to-noise ratio in dB.
    """
    harmonicity = parselmouth.praat.call(
        sound, "To Harmonicity (cc)", 0.01, min_f0, 0.1, 4.5
    )
    hnr_db: float = parselmouth.praat.call(harmonicity, "Get mean", 0, 0)
    nhr_val: float = 10 ** (-hnr_db / 10)
    return nhr_val, hnr_db
