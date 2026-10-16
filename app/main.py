from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import settings
from app.services.analysis_queue import get_analysis_queue
from app.services.audio.features import shutdown_executor
from app.services.logger import logger

from .routers import audios
from .websockets import audios as websocket_audios


# FastAPI executes this function before the application start up.
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing API")
    yield
    logger.info("Shutting down API...")
    get_analysis_queue().shutdown()
    shutdown_executor()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def root():
    return {"status": "active"}


app.include_router(audios.router)
app.include_router(websocket_audios.router)
