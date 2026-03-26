"""
Impact Analyzer — usa Claude Haiku para analisar impacto de notícias em segmentos eleitorais.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import anthropic

from config import settings


IMPACT_ANALYZER_PROMPT = """Você é um analista político brasileiro especializado em comportamento eleitoral.

Dada uma notícia sobre um candidato à presidência, analise o impacto nos diferentes segmentos de eleitores.

CLUSTERS DE ELEITORES:
- P (Progressista, P1-P6): base de esquerda, PT, programas sociais
- M (Moderado, M1-M8): swing voters, pragmáticos, centro
- C (Conservador, C1-C8): direita, religiosos, segurança, anti-PT
- T (Transversal, T1-T2): T1=desengajados, T2=anti-incumbente

CAMPOS DE SENSIBILIDADE DISPONÍVEIS (questionário das personas):
q_bolsa_familia_bom, q_auxilio_emergencial_voltar, q_situacao_economica,
q_imposto_ricos, q_reforma_tributaria, q_estado_tamanho, q_desemprego_principal,
q_corrupcao_problema, q_justica_funciona, q_sistema_eleitoral_confiavel,
q_seguranca_prioridade, q_intervencao_militar, q_policia_violenta,
q_familia_tradicional, q_feminismo_bom, q_racismo_estrutural,
q_casamento_gay, q_aborto_estupro, q_direitos_lgbt,
q_mudanca_climatica_real, q_amazonia_preservar, q_agronegocio_desmata,
q_fake_news_problema, q_democracia_importante, q_avaliacao_bolsonaro,
q_confianca_stf, q_confianca_congresso, q_confianca_imprensa,
q_religiao_politica, q_meritocracia, q_universidade_publica_gratuita,
q_sus_funciona, q_previdencia_reforma, q_teto_gastos

RESPONDA APENAS JSON:
{
  "news_type": "policy|scandal|economic|social|security|environment|gaffe|institutional",
  "candidate_effect": "positive|negative|neutral",
  "magnitude": 0.0-1.0,
  "summary": "Resumo factual em 1 frase",
  "affected_segments": [
    {
      "cluster_macro": "P|M|C|T",
      "sensitivity": 0.0-1.0,
      "direction": "positive|negative",
      "reason": "explicação breve",
      "sensitivity_fields": ["campo1", "campo2"]
    }
  ],
  "cross_candidate_effects": [
    {
      "candidate_id": "USE SOMENTE: lula|flavio|tarcisio|michelle|zema|caiado|ratinho|haddad|eduardo_leite",
      "direction": "positive|negative",
      "magnitude": 0.0-0.3
    }
  ]
}

IDs VÁLIDOS de candidatos (use EXATAMENTE estes, em minúsculo):
lula, flavio, tarcisio, michelle, zema, caiado, ratinho, haddad, eduardo_leite"""


@dataclass
class SegmentImpact:
    cluster_macro: str
    sensitivity: float
    direction: str  # "positive" | "negative"
    reason: str
    sensitivity_fields: list[str] = field(default_factory=list)


@dataclass
class CrossEffect:
    candidate_id: str
    direction: str
    magnitude: float


@dataclass
class ImpactResult:
    news_type: str
    candidate_effect: str
    magnitude: float
    summary: str
    affected_segments: list[SegmentImpact]
    cross_candidate_effects: list[CrossEffect]


VALID_CANDIDATE_IDS = {"lula", "flavio", "tarcisio", "michelle", "zema", "caiado", "ratinho", "haddad", "eduardo_leite"}

# Mapeamento de nomes comuns para IDs válidos
_CANDIDATE_ALIASES = {
    "lula": "lula", "lula_pt": "lula", "pt": "lula",
    "flavio": "flavio", "flávio": "flavio", "flavio_bolsonaro": "flavio", "flávio_bolsonaro": "flavio",
    "bolsonaro": "flavio", "jair": "flavio",
    "tarcisio": "tarcisio", "tarcísio": "tarcisio", "tarcisio_de_freitas": "tarcisio",
    "michelle": "michelle", "michelle_bolsonaro": "michelle",
    "zema": "zema", "romeu_zema": "zema",
    "caiado": "caiado", "ronaldo_caiado": "caiado",
    "ratinho": "ratinho", "ratinho_jr": "ratinho",
    "haddad": "haddad", "fernando_haddad": "haddad",
    "eduardo_leite": "eduardo_leite",
}


def _normalize_candidate_id(raw: str) -> str | None:
    """Normaliza IDs gerados pela IA para IDs válidos no banco."""
    if not raw:
        return None
    clean = raw.strip().lower().replace(" ", "_").replace(".", "")
    if clean in VALID_CANDIDATE_IDS:
        return clean
    return _CANDIDATE_ALIASES.get(clean)


class ImpactAnalyzer:
    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def analyze(self, headline: str, content: str, candidate: dict) -> ImpactResult | None:
        """Analisa o impacto de uma notícia nos segmentos eleitorais."""
        prompt = f"""CANDIDATO: {candidate['name']} ({candidate['party']}, {candidate['leaning']})
NOTÍCIA: {headline}
DETALHES: {content[:500]}

Analise o impacto desta notícia nos segmentos eleitorais."""

        try:
            response = self._client.messages.create(
                model=settings.impact_model,
                max_tokens=800,
                system=IMPACT_ANALYZER_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
            )

            text = next((b.text for b in response.content if b.type == "text"), None)
            if not text:
                return None

            # Limpar markdown se houver
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]

            data = json.loads(text)

            segments = [
                SegmentImpact(
                    cluster_macro=s["cluster_macro"],
                    sensitivity=float(s.get("sensitivity", 0.5)),
                    direction=s.get("direction", "neutral"),
                    reason=s.get("reason", ""),
                    sensitivity_fields=s.get("sensitivity_fields", []),
                )
                for s in data.get("affected_segments", [])
            ]

            cross = []
            for c in data.get("cross_candidate_effects", []):
                cid = _normalize_candidate_id(c.get("candidate_id", ""))
                if cid:  # só aceita IDs válidos
                    cross.append(CrossEffect(
                        candidate_id=cid,
                        direction=c.get("direction", "neutral"),
                        magnitude=float(c.get("magnitude", 0.1)),
                    ))

            return ImpactResult(
                news_type=data.get("news_type", "unknown"),
                candidate_effect=data.get("candidate_effect", "neutral"),
                magnitude=float(data.get("magnitude", 0.0)),
                summary=data.get("summary", ""),
                affected_segments=segments,
                cross_candidate_effects=cross,
            )

        except json.JSONDecodeError as e:
            print(f"[ImpactAnalyzer] JSON error: {e}")
            return None
        except Exception as e:
            print(f"[ImpactAnalyzer] Error: {e}")
            return None

    def extract_candidate_names(self, snippets: list[str], existing_ids: list[str]) -> list[dict]:
        """Extrai nomes de pré-candidatos mencionados nos snippets."""
        if not snippets:
            return []

        combined = "\n".join(snippets[:3])

        prompt = f"""Dos textos abaixo, extraia APENAS nomes de pessoas que são pré-candidatos ou candidatos à PRESIDÊNCIA do Brasil em 2026.

Candidatos JÁ CONHECIDOS (ignore): {', '.join(existing_ids)}

TEXTOS:
{combined[:1500]}

Responda JSON: [{{"name": "Nome Completo", "party": "Sigla", "leaning": "esquerda|centro|direita"}}]
Se nenhum novo candidato, responda: []"""

        try:
            response = self._client.messages.create(
                model=settings.impact_model,
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
            )
            text = next((b.text for b in response.content if b.type == "text"), "[]")
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
            return json.loads(text)
        except Exception as e:
            print(f"[ImpactAnalyzer] Candidate extraction error: {e}")
            return []
