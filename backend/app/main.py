import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import api, auth, backup, pipeline, storage
from .config import FRONTEND_ORIGIN
from .db import init_db

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    pipeline.recover_interrupted_runs()
    await asyncio.to_thread(storage.check_access)
    backups = asyncio.create_task(backup.run_forever())
    yield
    backups.cancel()


app = FastAPI(title="Braque", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(api.router)


@app.get("/api/health")
def health():
    return {"ok": True}
