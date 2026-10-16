import numpy as np


def dfa(signal, max_scale=None):
    """
    Detrended Fluctuation Analysis (DFA) scaling exponent.

    Little, Roberts, Costello, Moroz (2007), "Exploiting Nonlinear
    Recurrence and Fractal Scaling Properties for Voice Disorder
    Detection", BioMed Eng OnLine 6:23, eqs. 13-15: the input signal is
    integrated (cumulative sum), split into windows of length L, a
    least-squares straight-line trend (order=1, "DFA-1") is fit and
    removed within each window, and the RMS residual F(L) is computed.
    The scaling exponent alpha is the slope of log F(L) against log L.

    max_scale caps the largest window L considered. The paper is explicit
    that only a *limited range* of window sizes should be used: "the goal
    of DFA is to analyse the faster changing, stochastic properties of the
    signal, only a limited range of window sizes is investigated... Thus,
    the nature of the chaotic oscillation will not affect the scaling
    exponent, which will respond only to any random fluctuations occurring
    on a much shorter time scale [than the vocal-fold oscillation period]."
    For a voice signal, callers should pass max_scale below one pitch
    period; without it, windows spanning multiple periodic cycles pull the
    fit toward the near-zero slope of the bounded, oscillatory integrated
    signal rather than the turbulent-noise scaling exponent.
    """
    series = np.asarray(signal, dtype=float)
    M = len(series)
    min_scale = 4  # a straight-line fit needs more points than its two coefficients
    if M < min_scale * 4:
        return np.nan

    upper = M // 4 if max_scale is None else min(max_scale, M // 4)
    if upper <= min_scale:
        return np.nan

    y = np.cumsum(series - np.mean(series))

    scales = np.unique(
        np.logspace(start=np.log10(min_scale), stop=np.log10(upper), num=20).astype(int)
    )

    fluctuations = []
    valid_scales = []

    for scale in scales:
        n_segments = M // scale
        if n_segments < 1:
            continue

        residuals = []
        for seg in range(n_segments):
            start = scale * seg
            end = start + scale
            Y_n = y[start:end]
            x = np.arange(scale)
            coeffs = np.polyfit(x, Y_n, 1)
            trend = np.polyval(coeffs, x)
            residuals.extend((Y_n - trend) ** 2)

        if residuals:
            f = np.sqrt(np.mean(residuals))
            if f > 0:
                fluctuations.append(f)
                valid_scales.append(scale)

    if len(fluctuations) < 2:
        return np.nan

    return float(np.polyfit(np.log10(valid_scales), np.log10(fluctuations), 1)[0])
