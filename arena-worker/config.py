import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# How many personas to send per GPT batch (each call classifies N personas)
AI_BATCH_SIZE = int(os.getenv("AI_BATCH_SIZE", "50"))

# Port
PORT = int(os.getenv("PORT", "3002"))
