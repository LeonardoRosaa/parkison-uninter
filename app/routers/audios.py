import shutil
import uuid
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import JSONResponse

from app.services.analysis_queue import AnalysisQueue, get_analysis_queue

router = APIRouter(prefix="/audios")


@router.post("")
def analyze(
    file: UploadFile,
    analysis_queue: AnalysisQueue = Depends(get_analysis_queue),
):
    if not (file.content_type or "").startswith("audio/"):
        return JSONResponse(status_code=422, content={"message": "Invalid audio file"})

    # The analysis queue deletes this file once it has analysed it.
    with NamedTemporaryFile(
        delete=False, suffix=Path(file.filename or "").suffix
    ) as tmp:
        file.file.seek(0)
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    request_id = uuid.uuid4()

    try:
        analysis_queue.submit(tmp_path, request_id)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    return {"filename": file.filename, "uuid": request_id}
