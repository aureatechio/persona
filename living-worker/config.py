"""
Configuracao centralizada para Living Worker.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env do diretorio do projeto
_project_root = Path(__file__).resolve().parent.parent
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

    # Tavily
    tavily_api_key: str = field(
        default_factory=lambda: os.environ.get("TAVILY_API_KEY", "")
    )

    # Anthropic (Claude Haiku para impact analysis)
    anthropic_api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    impact_model: str = "claude-haiku-4-5-20251001"

    # Limites de segurança
    max_single_delta: float = 0.03       # máximo que UMA notícia muda
    max_daily_drift: float = 0.05        # teto diário
    max_total_drift: float = 0.15        # desde calibração inicial
    min_magnitude: float = 0.1           # ignora notícias irrelevantes
    dedup_hours: int = 48                # mesma URL não reprocessada

    # Polling anchor
    polling_error_threshold: float = 1.5  # % — aplica correção se erro > threshold
    polling_correction_factor: float = 0.3  # converge em ~3 dias

    # Schedule
    schedule_hours_utc: str = "10,16,22"  # 07h, 13h, 19h BRT (UTC-3)

    # News
    max_news_per_candidate: int = 5
    news_search_depth: str = "basic"


settings = Settings()
