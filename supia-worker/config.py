import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "voice-models"

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
SYNC_API_KEY = os.getenv("SYNC_API_KEY", "")

# ElevenLabs voice (Thais — Youthful and Feminine, added to account)
TTS_VOICE_ID = os.getenv("TTS_VOICE_ID", "5EtawPduB139avoMLQgH")
TTS_MODEL_ID = os.getenv("TTS_MODEL_ID", "eleven_v3")
TTS_STABILITY = float(os.getenv("TTS_STABILITY", "0.7"))

# Fixed AURORA base video already uploaded to voice-models/supia/base.mp4
BASE_VIDEO_PATH = os.getenv("BASE_VIDEO_PATH", "supia/base.mp4")

# Phrase template — supermarket name is interpolated as {name}
PHRASE_TEMPLATE = os.getenv(
    "PHRASE_TEMPLATE",
    "Aqui no {name}, você encontra as melhores ofertas... venha conferir.",
)

POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "3"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
SIGNED_URL_EXPIRY = 3600
