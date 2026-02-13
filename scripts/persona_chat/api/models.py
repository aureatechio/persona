"""
Schemas Pydantic para request/response da API.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    chat_id: str
    user_id: str
    persona_id: str
    message: str


class ChatResponse(BaseModel):
    response: str
    thought: Optional[str] = None
    tokens_used: Optional[int] = None
    web_search_used: bool = False
    validation_passed: bool = True


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
