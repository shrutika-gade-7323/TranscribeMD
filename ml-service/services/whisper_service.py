import time
import os
import logging
import tempfile
from pathlib import Path
from openai import OpenAI, OpenAIError

logger = logging.getLogger(__name__)

# Medical vocabulary and formatting hints for transcription alignment
MEDICAL_PROMPT = (
    "This is a medical dictation. Medical terms include: "
    "FINDINGS, IMPRESSION, TECHNIQUE, HISTORY, radiology, MRI, CT scan, "
    "PA and lateral, cardiomegaly, pneumonia, consolidation, effusion, "
    "metoprolol, lisinopril, atorvastatin, aorta, ventricle, atrium, "
    "millimeter, centimeter, bilateral, unilateral, anterior, posterior, "
    "superior, inferior, mediastinum, hilum, opacity, infiltrate. "
    "The doctor may say: all caps, bold, underline, new paragraph, period, comma."
)


def get_model():
    """Dummy function for backward compatibility with local Whisper service warmup."""
    logger.info("Using cloud transcription service. Warmup is not required.")
    return None


def _call_api_with_retry(provider: str, file_path: str, model_name: str = None, max_retries: int = 3, backoff_factor: float = 2.0):
    """
    Call the cloud transcription API with retries and exponential backoff.
    Supports 'groq' and 'openai' providers.
    """
    provider = provider.strip().lower()

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set")
        base_url = "https://api.groq.com/openai/v1"
        default_model = "whisper-large-v3"
    elif provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        base_url = None  # Use official OpenAI base URL
        default_model = "whisper-1"
    else:
        raise ValueError(f"Unsupported transcription provider: {provider}")

    model = model_name or default_model
    logger.info(f"Configuring ASR provider: {provider.upper()}, model: {model}")

    client = OpenAI(api_key=api_key, base_url=base_url)

    for attempt in range(1, max_retries + 1):
        try:
            with open(file_path, "rb") as file_obj:
                kwargs = {
                    "file": file_obj,
                    "model": model,
                    "response_format": "verbose_json",
                    "initial_prompt": MEDICAL_PROMPT,
                    "temperature": 0.0,
                }

                # OpenAI requires explicit granularity request for word-level timestamps
                if provider == "openai":
                    kwargs["timestamp_granularities"] = ["word"]

                logger.info(f"Sending audio request to {provider.upper()} API (Attempt {attempt}/{max_retries})...")
                start_time = time.time()
                response = client.audio.transcriptions.create(**kwargs)
                elapsed = time.time() - start_time
                logger.info(f"{provider.upper()} transcription request completed in {elapsed:.2f}s")
                return response

        except OpenAIError as e:
            logger.warning(f"{provider.upper()} API error (Attempt {attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                raise e
            sleep_time = backoff_factor ** attempt
            logger.info(f"Sleeping for {sleep_time:.2f}s before retry...")
            time.sleep(sleep_time)
        except Exception as e:
            logger.error(f"Unexpected error calling ASR API: {e}")
            raise e


def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    """
    Transcribe audio bytes using cloud transcription (Groq / OpenAI).
    Handles temporary file lifecycle, error fallbacks, and response standardization.
    """
    suffix = Path(filename).suffix or ".wav"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        primary_provider = os.getenv("TRANSCRIPTION_PROVIDER", "groq").strip().lower()
        model_name = os.getenv("TRANSCRIPTION_MODEL")
        fallback_provider = os.getenv("TRANSCRIPTION_FALLBACK_PROVIDER", "openai").strip().lower()

        response = None
        current_provider = primary_provider

        try:
            response = _call_api_with_retry(current_provider, tmp_path, model_name)
        except Exception as primary_error:
            logger.error(f"Primary provider {primary_provider.upper()} failed: {primary_error}")

            if fallback_provider and fallback_provider != primary_provider:
                logger.info(f"Attempting fallback to provider: {fallback_provider.upper()}")
                try:
                    # Use fallback provider; default model for fallback is used if no override matches
                    response = _call_api_with_retry(fallback_provider, tmp_path, model_name=None)
                    current_provider = fallback_provider
                except Exception as fallback_error:
                    logger.error(f"Fallback provider {fallback_provider.upper()} also failed: {fallback_error}")
                    raise primary_error  # Raise original primary error to highlight root issue
            else:
                raise primary_error

        # Standardize result extraction from response
        if hasattr(response, "model_dump"):
            res_dict = response.model_dump()
        elif isinstance(response, dict):
            res_dict = response
        else:
            res_dict = getattr(response, "__dict__", {})

        transcript = res_dict.get("text", "").strip()
        duration = res_dict.get("duration", 0.0)
        language = res_dict.get("language", "en")

        # Standardize word-level timestamps
        words = []
        raw_words = res_dict.get("words", [])
        if raw_words:
            for word_info in raw_words:
                words.append({
                    "word": word_info.get("word", "").strip(),
                    "start": float(word_info.get("start", 0.0)),
                    "end": float(word_info.get("end", 0.0)),
                    "probability": float(word_info.get("probability", 1.0)),
                })
        else:
            # Fallback to extracting from segments (supported by Groq and standard Whisper JSON)
            for segment in res_dict.get("segments", []):
                for word_info in segment.get("words", []):
                    words.append({
                        "word": word_info.get("word", "").strip(),
                        "start": float(word_info.get("start", 0.0)),
                        "end": float(word_info.get("end", 0.0)),
                        "probability": float(word_info.get("probability", 1.0)),
                    })

        logger.info(f"ASR complete via {current_provider.upper()}: {len(transcript)} characters, {duration:.2f}s duration")
        return {
            "transcript": transcript,
            "language": language,
            "duration_seconds": float(duration),
            "words": words,
        }

    except Exception as e:
        logger.error(f"Failed to transcribe {filename} after all attempts: {e}")
        raise
    finally:
        try:
            os.unlink(tmp_path)
            logger.debug(f"Temporary file cleaned up: {tmp_path}")
        except Exception as cleanup_error:
            logger.warning(f"Failed to clean up temporary file {tmp_path}: {cleanup_error}")
