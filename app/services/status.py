from enum import StrEnum


class AnalysisStatus(StrEnum):
    """Where an analysis request stands; the value is what clients receive."""

    LOADING = "loading"
    HEALTHY = "health"
    NONHEALTHY = "nonhealthy"
    # The recording is unlike anything the model was trained on, so it gives no answer.
    INCONCLUSIVE = "inconclusive"
    ERROR = "error"
    TIMEOUT = "timeout"


# Statuses after which no further update is published for a request.
TERMINAL_STATUSES = frozenset(
    {
        AnalysisStatus.HEALTHY,
        AnalysisStatus.NONHEALTHY,
        AnalysisStatus.INCONCLUSIVE,
        AnalysisStatus.ERROR,
    }
)
