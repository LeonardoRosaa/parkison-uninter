import numpy as np


def normalised_entropy(counts: np.ndarray, max_entropy: float) -> float:
    """
    Shannon entropy of a histogram as a fraction of `max_entropy`.

    A histogram with fewer than two occupied bins carries no uncertainty
    and scores 0.0.
    """
    p = counts[counts > 0] / counts.sum()
    if len(p) < 2:
        return 0.0

    return float(-np.sum(p * np.log(p)) / max_entropy)
