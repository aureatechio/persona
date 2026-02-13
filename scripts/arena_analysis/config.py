"""
Configuracao centralizada para Arena Analysis.
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
    # Supabase
    supabase_url: str = field(
        default_factory=lambda: os.environ.get(
            "NEXT_PUBLIC_SUPABASE_URL",
            "https://sobfplitrzgggzqsycew.supabase.co",
        )
    )
    supabase_key: str = field(
        default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    )

    # LLM — Claude
    anthropic_api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    model: str = "claude-haiku-4-5-20251001"

    # LLM — OpenAI
    openai_api_key: str = field(
        default_factory=lambda: os.environ.get("OPENAI_API_KEY", "")
    )
    openai_model: str = "gpt-4o-mini"

    # Web search
    tavily_api_key: str = field(
        default_factory=lambda: os.environ.get("TAVILY_API_KEY", "")
    )

    # Batching (por provider)
    batch_size: int = 15  # personas por batch
    max_parallel_claude: int = 5  # batches Claude simultaneos
    max_parallel_openai: int = 10  # batches OpenAI simultaneos (rate limit maior)
    max_tokens_per_batch: int = 4096  # tokens de saida por batch

    # Web search
    max_web_results: int = 5

    # Persona cache TTL em segundos
    persona_cache_ttl: int = 300

    # Retry
    max_retries: int = 1


settings = Settings()
