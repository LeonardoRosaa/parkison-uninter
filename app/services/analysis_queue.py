"""Runs uploaded audio through the analysis, one upload at a time per process."""

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from uuid import UUID

import app.services.audio as audio_service
from app.services.logger import logger
from app.services.redis import redis_client
from app.services.status import AnalysisStatus


class AnalysisQueue:
    def __init__(self):
        self._executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="analysis"
        )

    def submit(self, upload: Path, request_id: UUID) -> None:
        """Queue an upload; the queue deletes the file once it is analysed."""
        self._executor.submit(self._analyse, upload, request_id)

    def shutdown(self) -> None:
        """Finish the queued analyses, then stop."""
        self._executor.shutdown(wait=True)

    def _analyse(self, upload: Path, request_id: UUID) -> None:
        try:
            audio_service.analysis(str(upload), request_id=request_id)
        except Exception as e:
            logger.error("Analysis failed for %s: %s", request_id, e)
            redis_client.set_status(str(request_id), AnalysisStatus.ERROR)
        finally:
            try:
                upload.unlink(missing_ok=True)
            except OSError as e:
                logger.error("Could not delete upload %s: %s", upload, e)


@lru_cache
def get_analysis_queue() -> AnalysisQueue:
    """The process-wide queue, so uploads are analysed one at a time."""
    return AnalysisQueue()
