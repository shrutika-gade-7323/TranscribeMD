import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from services.boundary_service import detect_boundaries
from services.whisper_service import transcribe_audio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("TranscribeMD ML Service starting...")
    # Warm up Whisper model on startup
    try:
        from services.whisper_service import get_model
        get_model()
    except Exception as e:
        logger.warning(f"Whisper warmup failed (will load on first request): {e}")
    yield
    logger.info("ML Service shutting down")


app = FastAPI(
    title="TranscribeMD ML Service",
    description="Audio transcription and NLP pipeline for TranscribeMD",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "transcribemd-ml"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Transcribe an audio file using Whisper."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    logger.info(f"Received audio: {file.filename} ({len(content) / 1024:.1f} KB)")

    try:
        result = transcribe_audio(content, file.filename)
        return result
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


class BoundaryRequest(BaseModel):
    transcript: str


@app.post("/detect-boundaries")
async def detect_patient_boundaries(req: BoundaryRequest):
    """Detect patient boundaries in a transcript."""
    if not req.transcript:
        raise HTTPException(status_code=400, detail="transcript is required")

    boundaries = detect_boundaries(req.transcript)
    return {"boundaries": boundaries, "count": len(boundaries)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
