import bisect
import numpy as np
from scipy.spatial import KDTree

from app.services.audio.entropy import normalised_entropy


def rpde(y, m=3, tau=7, radius=0.5):
    """
    Recurrence Period Density Entropy (RPDE).

    Little, Roberts, Costello, Moroz (2007), "Exploiting Nonlinear
    Recurrence and Fractal Scaling Properties for Voice Disorder
    Detection", BioMed Eng OnLine 6:23, eqs. 6-12. Embedding dimension
    m=3 and delay tau=7 match the paper's own worked example (Fig. 3).

    The recurrence-time histogram is normalised by ln(Tmax), where Tmax
    is the *largest recurrence period actually observed* (eq. 11: this is
    the entropy of a uniform i.i.d. signal, the theoretical maximum) —
    NOT by the number of distinct period values seen, which is a much
    smaller, sample-dependent quantity and inflates H_norm.

    Parameters
    ----------
    y : array-like
        Input signal.
    m : int
        Embedding dimension.
    tau : int
        Time-delay for the embedding.  Use tau=7 for raw waveform at 4 kHz.
        Use tau=1 when y is the glottal period deviation sequence (one value
        per pitch cycle).
    radius : float
        Close-return threshold in units of the signal's standard deviation
        after normalisation. The paper does not fix a single value — it
        calibrates r per signal type by searching r = 0.02, 0.04, ..., 0.5.
        radius=0.5 (the top of that search grid) is used here for the raw
        waveform.
    """
    y = np.asarray(y, dtype=float)
    std = np.std(y)
    if std < 1e-10:
        return np.nan
    y = y / std  # normalise to unit std so radius is meaningful

    embedding = time_delay_embedding(y, m, tau)
    periods = close_return_periods(embedding, radius)

    if not periods:
        return 0.0

    Tmax = max(periods)
    if Tmax < 2:
        return 0.0

    counts = np.bincount(periods, minlength=Tmax + 1)[1 : Tmax + 1]
    return normalised_entropy(counts, max_entropy=np.log(Tmax))


def time_delay_embedding(x, m, tau):
    n_vectors = len(x) - (m - 1) * tau
    return np.array([x[i : i + m * tau : tau] for i in range(n_vectors)])


def close_return_periods(Y, r):
    N = len(Y)
    tree = KDTree(Y)
    all_inside = tree.query_ball_point(Y, r, return_sorted=True)

    periods = []
    for n0 in range(N):
        inside = all_inside[n0]

        j = _first_missing(inside, n0 + 1, N)
        if j is None:
            continue

        pos = bisect.bisect_left(inside, j)
        if pos >= len(inside):
            continue

        periods.append(inside[pos] - n0)

    return periods


def _first_missing(sorted_indices, start, limit):
    """Return the smallest integer >= start absent from sorted_indices, or None if >= limit."""
    pos = bisect.bisect_left(sorted_indices, start)
    expected = start
    for i in range(pos, len(sorted_indices)):
        if sorted_indices[i] > expected:
            return expected
        expected = sorted_indices[i] + 1
    return expected if expected < limit else None
