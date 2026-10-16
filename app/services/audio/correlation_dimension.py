import numpy as np
import app.services.audio.rpde as rpde
from sklearn.neighbors import KDTree


def correlation_dimension(y, m=5, tau=7, theiler=28, n_r=25, window_frac=0.5):
    """
    Grassberger-Procaccia correlation dimension (D2).

    Grassberger, P., Procaccia, I. (1983), "Characterization of Strange
    Attractors", Phys. Rev. Lett. 50(5), 346-349: D2 is the log-log slope
    of the correlation sum C(r) against r. Theiler, J. (1986), "Spurious
    dimension from correlation algorithms applied to limited time-series
    data", Phys. Rev. A 34(3), excludes temporally close pairs (the
    `theiler` window) so that trajectory autocorrelation isn't mistaken
    for genuine spatial recurrence.

    Kantz, H., Schreiber, T. (2004), "Nonlinear Time Series Analysis",
    2nd ed., Ch. 6: the slope is only meaningful within C(r)'s genuine
    linear "scaling region" — small r is dominated by sampling noise (too
    few neighbours to estimate C(r) reliably) and large r saturates as
    C(r) -> 1. Fitting across the whole 0 < C(r) < 1 range (as opposed to
    just the scaling region) drags the estimate toward the near-zero
    slope of the saturating tail, systematically undershooting D2.
    """
    Y = rpde.time_delay_embedding(y, m, tau)
    if len(Y) < 2:
        return np.nan

    # Estimate a typical inter-point distance from a random sample so that
    # r_vals span the actual scaling region of the correlation integral.
    # Hardcoded [0.001, 1.0] breaks completely when the signal amplitude differs
    # from the assumed scale — the slope collapses to ~0 or ~N.
    sample_size = min(300, len(Y))
    rng = np.random.default_rng(0)
    idx = rng.choice(len(Y), sample_size, replace=False)
    Y_sample = Y[idx]
    dists = np.linalg.norm(Y_sample[:, None, :] - Y_sample[None, :, :], axis=-1)
    dists = dists[dists > 0]
    if len(dists) == 0:
        return np.nan
    typical = np.median(dists)
    if typical <= 0:
        return np.nan

    r_vals = np.logspace(np.log10(0.01 * typical), np.log10(3.0 * typical), n_r)

    tree = KDTree(Y, leaf_size=40)
    C = np.array([correlation_sum_tree(tree, Y, r, theiler) for r in r_vals])

    # Candidate scaling region: C strictly between 0 and 1
    mask = (C > 0) & (C < 1)
    if np.count_nonzero(mask) < 2:
        return np.nan

    log_r = np.log(r_vals[mask])
    log_C = np.log(C[mask])
    slope = _scaling_region_slope(log_r, log_C, window_frac)

    return float(slope) if slope is not None else np.nan


def _scaling_region_slope(log_r, log_C, window_frac):
    """Fit log_C vs log_r only within its most linear contiguous window."""
    n = len(log_r)
    if n < 4:
        slope, _ = np.polyfit(log_r, log_C, 1)
        return slope

    local_slopes = np.diff(log_C) / np.diff(log_r)
    window = max(2, int(round((n - 1) * window_frac)))
    window = min(window, len(local_slopes))

    best_start, best_var = 0, np.inf
    for start in range(len(local_slopes) - window + 1):
        var = np.var(local_slopes[start : start + window])
        if var < best_var:
            best_var, best_start = var, start

    lo, hi = best_start, best_start + window + 1
    slope, _ = np.polyfit(log_r[lo:hi], log_C[lo:hi], 1)
    return slope


def correlation_sum_tree(tree, Y, r, theiler=0):
    N = len(Y)
    if N < 2:
        return np.nan

    count = 0
    for i in range(N):
        ind = tree.query_radius(Y[i : i + 1], r=r)[0]
        valid = ind[np.abs(ind - i) > theiler]
        count += len(valid)

    return count / (N * (N - 1))
