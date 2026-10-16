import asyncio
from contextlib import aclosing
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import settings
from app.services.logger import logger
from app.services.redis import redis_client
from app.services.status import TERMINAL_STATUSES, AnalysisStatus

router = APIRouter(prefix="/ws")
ws_timeout = settings.ws_timeout_seconds()


@router.websocket("/{request_id}")
async def websocket_endpoint(request_id: UUID, websocket: WebSocket):
    await websocket.accept()

    async def send(result: dict) -> None:
        await websocket.send_json({"request_id": str(request_id), **result})

    try:
        try:
            # aclosing releases the Redis subscription as soon as we stop reading.
            async with (
                asyncio.timeout(ws_timeout),
                aclosing(redis_client.watch_result(str(request_id))) as results,
            ):
                async for result in results:
                    await send(result)
                    if result.get("status") in TERMINAL_STATUSES:
                        break
        except TimeoutError:
            await send({"status": AnalysisStatus.TIMEOUT})

        await websocket.close()
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for request_id={request_id}")
