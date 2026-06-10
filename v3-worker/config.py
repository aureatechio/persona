import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "voice-models"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
SYNC_API_KEY = os.getenv("SYNC_API_KEY", "")

UAZAPI_URL = os.getenv("UAZAPI_URL", "https://aureatech.uazapi.com")
UAZAPI_TOKEN = os.getenv("UAZAPI_TOKEN", "")

WHATSAPP_META_WEIGHT = int(os.getenv("WHATSAPP_META_WEIGHT", "0"))
WHATSAPP_UAZAPI_WEIGHT = int(os.getenv("WHATSAPP_UAZAPI_WEIGHT", "1"))

WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com/v22.0")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
_phone_ids_raw = os.getenv("WHATSAPP_PHONE_NUMBER_IDS", "") or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_PHONE_NUMBER_IDS = [p.strip() for p in _phone_ids_raw.split(",") if p.strip()]
WHATSAPP_VIDEO_TEMPLATE = os.getenv("WHATSAPP_VIDEO_TEMPLATE", "videochamadapl")
WHATSAPP_VIDEO_TEMPLATE_LANG = os.getenv("WHATSAPP_VIDEO_TEMPLATE_LANG", "pt_BR")

POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "3"))
MAX_RETRIES = int(os.getenv("WORKER_MAX_RETRIES", "3"))
SIGNED_URL_EXPIRY = 3600
