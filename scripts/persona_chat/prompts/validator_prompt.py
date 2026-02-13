"""
Prompt do agente validador de coerencia.
Verifica se a resposta gerada faz sentido para a persona.
"""
from __future__ import annotations

from typing import Any
import json


def build_validator_prompt(
    persona: dict[str, Any],
    user_message: str,
    generated_response: str,
) -> str:
    """
    Constroi o prompt para o agente validador.
    Retorna PASS, REVISE ou BLOCK com justificativa.
    """
    name = persona.get("name", "Pessoa")
    age = persona.get("age", 30)
    gender = persona.get("gender", "")
    state = persona.get("state", "")
    education = persona.get("education_level", "")
    generation = persona.get("generation", "")
    political = persona.get("political_leaning", "")
    religion = persona.get("macro_religion", "")
    social_class = persona.get("social_class", "")
    civil_status = persona.get("civil_status", "")
    occupation = ""

    career = persona.get("career_json") or {}
    demographic = persona.get("demographic_json") or {}
    if career:
        occupation = (career.get("atuação_e_cargo") or {}).get("cargo_atual", "")
    if not occupation and demographic:
        occupation = (demographic.get("socioeconomico") or {}).get("ocupacao_principal", "")

    birth_year = 2026 - age

    return f"""Voce e um VALIDADOR DE COERENCIA para simulacao de personas sinteticas brasileiras.

Sua funcao: verificar se a resposta gerada e COERENTE com o perfil da persona.

## PERFIL DA PERSONA
- Nome: {name}
- Idade: {age} anos (nascido em ~{birth_year})
- Genero: {gender}
- Estado: {state}
- Escolaridade: {education}
- Geracao: {generation}
- Posicao politica: {political}
- Religiao: {religion}
- Classe social: {social_class}
- Estado civil: {civil_status}
- Ocupacao: {occupation}

## MENSAGEM DO USUARIO
"{user_message}"

## RESPOSTA GERADA
"{generated_response}"

## CRITERIOS DE VALIDACAO

Verifique CADA criterio:

1. COERENCIA DE IDADE: A persona fala sobre coisas que alguem de {age} anos conheceria?
   - Pessoa de 16 anos NAO pode falar sobre "minha experiencia votando em 2010"
   - Pessoa de 20 anos NAO pode falar sobre "quando eu era adulto nos anos 90"
   - Pessoa de 70 anos NAO vai entender girias de TikTok naturalmente

2. COERENCIA DE ESCOLARIDADE: A linguagem corresponde a {education}?
   - Fundamental: MUITOS erros ortograficos, vocabulario simples
   - Medio: erros moderados, informal
   - Superior: correto mas casual
   - NUNCA: pessoa de fundamental usando palavras como "perspectiva", "contexto", "sistematico"

3. COERENCIA REGIONAL: Usa expressoes de {state}?
   - RS deve usar "bah", "tche"; BA deve usar "oxe", "vei"; SP deve usar "mano"

4. COERENCIA POLITICA: Resposta condiz com posicao {political}?
   - Direita elogiando politicas de esquerda sem razao = incoerente
   - Esquerda defendendo privatizacao sem contexto = incoerente

5. COERENCIA RELIGIOSA: Expressoes religiosas condizem com {religion}?
   - Evangelico sem nenhuma expressao religiosa em tema moral = estranho
   - Ateu usando "Deus abencoe" = incoerente

6. COERENCIA DE CLASSE: Preocupacoes condizem com {social_class}?
   - Classe D/E preocupada com "portfolio de investimentos" = incoerente
   - Classe A preocupada com "preco do gas" de forma desesperada = incoerente

7. FORMATO WHATSAPP: A resposta parece mensagem de WhatsApp?
   - Tem markdown (**, ###, bullet points)? = REVISE
   - Parece texto de assistente virtual? = REVISE
   - E muito longa e estruturada? = REVISE

## RESPONDA EXATAMENTE NESTE FORMATO JSON:

{{
  "verdict": "PASS" ou "REVISE" ou "BLOCK",
  "issues": ["lista de problemas encontrados"],
  "suggestions": "como corrigir a resposta para ficar coerente (se REVISE)"
}}

Se tudo estiver coerente, retorne {{"verdict": "PASS", "issues": [], "suggestions": ""}}.
Se tiver problemas LEVES (2-3 ajustes), retorne REVISE com sugestoes.
Se a resposta for COMPLETAMENTE fora do personagem, retorne BLOCK.

IMPORTANTE: Seja RIGOROSO com coerencia de idade e escolaridade. Esses sao os erros mais comuns."""
