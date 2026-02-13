"""
Arena Analysis — Pipeline AI para Pulse Arena.

Fluxo:
  1. Web Research (Tavily) — SEMPRE busca contexto
  2. Context Builder (Claude Haiku) — cria contexto estruturado
  3. Context Validator (Claude Haiku) — verifica precisão
  4. Persona Loop (Claude Haiku × batches) — processa TODAS as personas
  5. Results Aggregator — agrega dados reais → dashboard
"""
