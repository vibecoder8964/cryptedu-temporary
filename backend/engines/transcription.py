"""
CryptEdu Transcription Engine — Local Whisper integration.
Transcribes MP4 video audio using OpenAI Whisper (runs locally, no API cost).
"""
import os
import logging

logger = logging.getLogger(__name__)

# Lazy-load whisper to avoid slow import on startup
_model = None
_model_size = os.getenv("WHISPER_MODEL", "tiny")

def _get_model():
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model(_model_size)
    return _model


def transcribe_video(filepath: str) -> dict:
    """
    Transcribe a video/audio file using Whisper.
    
    Args:
        filepath: Path to the MP4/audio file
        
    Returns:
        dict with keys: text, segments, language
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    model = _get_model()
    
    logger.info(f"Transcribing: {filepath}")
    result = model.transcribe(filepath, fp16=False, verbose=False)
    
    return {
        "text": result.get("text", "").strip(),
        "segments": [
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip()
            }
            for seg in result.get("segments", [])
        ],
        "language": result.get("language", "unknown"),
    }

