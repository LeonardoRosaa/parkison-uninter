import numpy as np

from app.services.audio.entropy import normalised_entropy


def pitch_period_entropy(T, lpc_order=2):
    """
    Pitch Period Entropy (PPE).

    Little, M.A., McSharry, P.E., Hunter, E.J., Spielman, J., Ramig, L.O.
    (2009), "Suitability of Dysphonia Measurements for Telemonitoring of
    Parkinson's Disease", IEEE Trans. Biomed. Eng. 56(4), 1015-1022,
    Sec. II-C: convert pitch to the logarithmic semitone scale, remove the
    subject-specific mean (gender/individual pitch preference), whiten out
    the smooth, healthy pitch trend with a linear-prediction filter, and
    take the entropy of the resulting "roughness" distribution. The paper
    fits the whitening filter by the covariance method; we use the
    equivalent, more numerically stable autocorrelation (Yule-Walker)
    method.

    The paper describes the entropy of the equal-sized-bin histogram
    P(r) as "normalized to [0,1]" without giving an explicit formula.
    We follow the same pattern as the RPDE normalisation (eq. 12 of the
    2007 paper): divide by the entropy of the maximally-uncertain
    reference case, i.e. every residual sample landing in its own bin,
    ln(N) where N is the number of whitened samples. Bin count uses
    Sturges' rule, a standard, sample-size-only bin-count heuristic
    (robust to the rare large outliers a raw pitch-period sequence can
    contain, unlike range-sensitive rules).

    T: pitch periods (voiced only), in seconds
    """
    T = np.asarray(T, dtype=float)
    T = T[np.isfinite(T) & (T > 0)]
    if len(T) < 10:
        return np.nan

    f0 = 1.0 / T
    semitones = 12.0 * np.log2(f0)
    semitones -= np.mean(semitones)

    residual = _whiten(semitones, lpc_order)
    N = len(residual)
    if N < 2 or np.std(residual) < 1e-10:
        return 0.0

    counts, _ = np.histogram(residual, bins="sturges", density=False)
    if counts.sum() == 0:
        return np.nan

    return normalised_entropy(counts, max_entropy=np.log(N))


def _whiten(x, order):
    """AR(order) linear-prediction residual via the autocorrelation (Yule-Walker) method."""
    n = len(x)
    if n <= order:
        return x - np.mean(x)

    autocorr = np.correlate(x, x, mode="full")[n - 1 :]
    R = autocorr[: order + 1]
    if R[0] < 1e-12:
        return np.zeros(n - order)

    toeplitz = np.array([[R[abs(i - j)] for j in range(order)] for i in range(order)])
    coeffs = np.linalg.solve(toeplitz, R[1 : order + 1])

    predicted = np.zeros(n - order)
    for k in range(order):
        predicted += coeffs[k] * x[order - 1 - k : n - 1 - k]

    return x[order:] - predicted
