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


def _collect_keys(prefix: str) -> list[str]:
    """Coleta todas as chaves com prefixo, ex: ANTHROPIC_API_KEY, _2, _3..."""
    keys: list[str] = []
    # Primeiro sem sufixo
    base = os.environ.get(prefix, "")
    if base:
        keys.append(base)
    # Depois _2, _3, ... _10
    for i in range(2, 11):
        val = os.environ.get(f"{prefix}_{i}", "")
        if val:
            keys.append(val)
    return keys


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

    # LLM — Claude (todas as chaves)
    anthropic_api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    anthropic_api_keys: list[str] = field(
        default_factory=lambda: _collect_keys("ANTHROPIC_API_KEY")
    )
    model: str = "claude-haiku-4-5-20251001"
    # Modelo potente para steps criticos (analise, contexto, validacao)
    smart_model: str = "claude-sonnet-4-20250514"

    # LLM — OpenAI (todas as chaves)
    openai_api_key: str = field(
        default_factory=lambda: os.environ.get("OPENAI_API_KEY", "")
    )
    openai_api_keys: list[str] = field(
        default_factory=lambda: _collect_keys("OPENAI_API_KEY")
    )
    openai_model: str = "gpt-4o-mini"

    # Web search
    tavily_api_key: str = field(
        default_factory=lambda: os.environ.get("TAVILY_API_KEY", "")
    )

    # Batching (otimizado para 20K personas com 8 contas)
    batch_size: int = 30  # personas por batch (30 = mais confiável, menos JSON truncado)
    max_parallel_claude: int = 12  # batches Claude simultaneos (~3/chave, evita 50 RPM limit)
    max_parallel_openai: int = 80  # batches OpenAI simultaneos (~20/chave, GPT aguenta 500 RPM)
    claude_share: float = 0.10  # 10% Claude, 90% GPT (Claude=gargalo com 50 RPM/chave)
    max_tokens_per_batch: int = 8192  # tokens de saida por batch

    # Web search
    max_web_results: int = 5

    # Persona cache TTL em segundos
    persona_cache_ttl: int = 300

    # Retry
    max_retries: int = 1


settings = Settings()
