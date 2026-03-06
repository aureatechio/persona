import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "voice-models"

# OpenAI (GPT-4o only — Whisper runs locally)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ElevenLabs TTS
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

# Sync Labs (lip-sync)
SYNC_API_KEY = os.getenv("SYNC_API_KEY", "")

# Meta WhatsApp Business API
META_WHATSAPP_TOKEN = os.getenv("META_WHATSAPP_TOKEN", "")
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID", "777213165485256")

# Worker settings
POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "3"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
SIGNED_URL_EXPIRY = 3600  # 1 hour
