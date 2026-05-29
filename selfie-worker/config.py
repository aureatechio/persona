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

# UAZAPI (WhatsApp não-oficial — fallback)
UAZAPI_URL = os.getenv("UAZAPI_URL", "https://aureatech.uazapi.com")
UAZAPI_TOKEN = os.getenv("UAZAPI_TOKEN", "")

# WhatsApp Business Cloud API (oficial, canal primário)
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com/v22.0")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

# Lista de phone_number_ids (separados por vírgula). A cada envio o worker
# escolhe um random pra distribuir o load entre os números — reduz risco
# de rate limit/bloqueio. Aceita também WHATSAPP_PHONE_NUMBER_ID (singular)
# como fallback de retrocompatibilidade.
_phone_ids_raw = (
    os.getenv("WHATSAPP_PHONE_NUMBER_IDS", "")
    or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
)
WHATSAPP_PHONE_NUMBER_IDS = [p.strip() for p in _phone_ids_raw.split(",") if p.strip()]

# Template aprovado pela Meta para envio do vídeo (header video + link).
WHATSAPP_VIDEO_TEMPLATE = os.getenv("WHATSAPP_VIDEO_TEMPLATE", "videochamadapl")
WHATSAPP_VIDEO_TEMPLATE_LANG = os.getenv("WHATSAPP_VIDEO_TEMPLATE_LANG", "pt_BR")

# Worker settings
POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "3"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
SIGNED_URL_EXPIRY = 3600  # 1 hour
