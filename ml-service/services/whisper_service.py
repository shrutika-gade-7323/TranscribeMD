import whisper
import tempfile
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MEDICAL_PROMPT = (
    "This is a medical dictation. Medical terms include: "
    "FINDINGS, IMPRESSION, TECHNIQUE, HISTORY, radiology, MRI, CT scan, "
    "PA and lateral, cardiomegaly, pneumonia, consolidation, effusion, "
    "metoprolol, lisinopril, atorvastatin, aorta, ventricle, atrium, "
    "millimeter, centimeter, bilateral, unilateral, anterior, posterior, "
    "superior, inferior, mediastinum, hilum, opacity, infiltrate. "
    "The doctor may say: all caps, bold, underline, new paragraph, period, comma."
)

_model = None

def get_model():
    global _model
    if _model is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        logger.info(f"Loading Whisper model: {model_name}")
        _model = whisper.load_model(model_name)
        logger.info("Whisper model loaded")
    return _model


def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    """Transcribe audio bytes using Whisper."""
    suffix = Path(filename).suffix or ".wav"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        model = get_model()
        logger.info(f"Transcribing {filename} ({len(audio_bytes) / 1024:.1f} KB)")

        result = model.transcribe(
            tmp_path,
            language="en",
            initial_prompt=MEDICAL_PROMPT,
            temperature=0,
            word_timestamps=True,
            verbose=False,
        )

        transcript = result["text"].strip()
        duration = result.get("duration", 0)

        # Extract word-level timestamps
        words = []
        for segment in result.get("segments", []):
            for word_info in segment.get("words", []):
                words.append({
                    "word": word_info.get("word", "").strip(),
                    "start": word_info.get("start", 0),
                    "end": word_info.get("end", 0),
                    "probability": word_info.get("probability", 1.0),
                })

        logger.info(f"Transcription complete: {len(transcript)} chars, {duration:.1f}s")
        return {
            "transcript": transcript,
            "language": result.get("language", "en"),
            "duration_seconds": duration,
            "words": words,
        }

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
