"""
Configuracao centralizada via variáveis de ambiente.
Usa pydantic-settings para validacao automatica.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env do diretorio do projeto
_project_root = Path(__file__).resolve().parent.parent.parent
_env_file = _project_root / ".env.local"
if _env_file.exists():
    load_dotenv(_env_file)
else:
    load_dotenv(_project_root / ".env")


@dataclass
class Settings:
    # Supabase — usa service_role para bypass de RLS (backend precisa ler todas as msgs)
    supabase_url: str = field(default_factory=lambda: os.environ["NEXT_PUBLIC_SUPABASE_URL"])
    supabase_key: str = field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])

    # LLM providers
    anthropic_api_key: str = field(default_factory=lambda: os.environ["ANTHROPIC_API_KEY"])
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))

    # Web search (Tavily)
    tavily_api_key: str = field(default_factory=lambda: os.getenv("TAVILY_API_KEY", ""))

    # Modelos
    primary_model: str = "claude-opus-4-6"
    validator_model: str = "claude-haiku-4-5-20251001"

    # Pipeline
    chat_memory_size: int = 30
    max_web_results: int = 3
    web_search_timeout: float = 5.0
    max_retries_on_validation_fail: int = 1

    # Persona cache TTL em segundos
    persona_cache_ttl: int = 300


settings = Settings()
