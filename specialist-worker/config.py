"""
Specialist Worker — Configuration
"""

import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '').strip('"')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').strip('"')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip('"')
PORT = int(os.getenv('PORT', '3011'))

# Model for specialists (Sonnet = fast + cheap for focused analysis)
SPECIALIST_MODEL = os.getenv('SPECIALIST_MODEL', 'claude-sonnet-4-20250514')
SPECIALIST_MAX_TOKENS = int(os.getenv('SPECIALIST_MAX_TOKENS', '1024'))
