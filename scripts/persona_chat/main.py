"""
Persona Chat Backend — FastAPI Multi-Agent Pipeline
====================================================
Substitui o webhook n8n por um backend Python robusto com:
- Pesquisa web (Tavily) para dados atualizados
- Gerador de resposta (Claude Opus 4.6) encarnando a persona
- Validador de coerencia (Claude Haiku 4.5) garantindo consistencia

Uso:
  pip install -r requirements.txt
  uvicorn persona_chat.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from persona_chat.api.routes import router

app = FastAPI(
    title="Persona Chat API",
    description="Multi-agent pipeline para chat de personas sinteticas",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
