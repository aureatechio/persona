"""
Context Builder — IA cria contexto estruturado a partir da pergunta + dados web.

Objetivo: embasar a pergunta com dados reais SEM distorcer.
Exemplo: "Lula deveria estar preso?"
  → TEMA: Possibilidade de prisão do presidente Lula
  → CONTEXTO: Luiz Inácio Lula da Silva, presidente do Brasil...
  → FIGURAS: Lula (presidente, PT)
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field

import anthropic

from arena_analysis.config import settings


@dataclass
class ContextResult:
    tema: str = ""
    contexto: str = ""
    figuras: list[dict] = field(default_factory=list)
    periodo: str = ""
    raw_text: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0


CONTEXT_BUILDER_PROMPT = """Você cria FICHAS DE CONTEXTUALIZAÇÃO para um sistema de pesquisa social.

A pergunta será enviada a 2000 personas brasileiras. Seu contexto serve para que elas saibam:
1. DE QUEM ou DO QUE se trata
2. POR QUE essa pergunta está sendo feita (o fato, escândalo, polêmica)

Sem isso, a persona não consegue opinar com propriedade.

REGRAS:
1. MÁXIMO 3-5 frases. Seja conciso mas COMPLETO.
2. Identifique: QUEM é + QUAL cargo + O QUE FEZ/ACONTECEU que gerou a pergunta
3. Seja FACTUAL e NEUTRO — descreva os fatos sem julgamento
4. NUNCA diga se é culpado ou inocente — só o que é público (investigação, acusação, denúncia)
5. NUNCA omita o MOTIVO da polêmica — sem ele a persona não entende a pergunta
6. Se a pergunta é sobre punição/prisão → OBRIGATÓRIO explicar DO QUE a pessoa é acusada
7. Se a pergunta já é autoexplicativa (temas genéricos) → contexto mínimo

EXEMPLOS:
- "Lula deve ser preso?" → contexto: "Luiz Inácio Lula da Silva, presidente do Brasil (PT, esquerda). Foi condenado na Lava-Jato por corrupção e lavagem de dinheiro, preso em 2018, solto em 2019 após decisão do STF. Condenações foram anuladas por questão de foro."
- "Daniel Vorcara deve ser preso?" → contexto: "Daniel Vorcaro, presidente do Banco Master. O banco é alvo de investigações por operações financeiras suspeitas, emissão irregular de CDBs e possíveis fraudes contábeis. O caso ganhou repercussão após revelações sobre o tamanho da exposição do FGC."
- "Brizola foi bom?" → contexto: "Leonel Brizola (1922-2004), político de esquerda (PDT), governador do RJ e RS. Conhecido pelos CIEPs (escolas de tempo integral) e por posições nacionalistas."
- "Aborto deveria ser legalizado?" → contexto mínimo: não precisa explicar o que é aborto.

JSON válido:
{
  "tema": "Título curto",
  "contexto": "3-5 frases factuais. QUEM É + O QUE FEZ/ACONTECEU.",
  "figuras": [{"nome": "Nome", "cargo": "Cargo", "campo_politico": "esquerda|centro|direita", "aliados_principais": ["Nome1", "Nome2"], "relevancia": "posição política ou papel no caso"}],
  "periodo": "período relevante"
}

REGRA OBRIGATÓRIA para figuras políticas:
- campo_politico: SEMPRE indique se é esquerda, centro ou direita
- aliados_principais: liste os 2-3 aliados mais conhecidos
  Exemplos: Nikolas Ferreira → aliados: Flávio Bolsonaro, Jair Bolsonaro (mesmo campo PL/direita)
            Boulos → aliados: Lula, Haddad (mesmo campo PT-PSOL/esquerda)
- Isso ajuda as personas a saberem SE devem apoiar ou criticar essa figura"""


IDEOLOGICAL_FRAME_PROMPT = """Você é um ANALISTA DE VIÉS IDEOLÓGICO para pesquisa social brasileira.

Sua tarefa: dado um TEMA ou PERGUNTA, explicar como DIREITA e ESQUERDA brasileiras se posicionam sobre ele.

Isso NÃO é opinião — é mapeamento factual de como cada lado do espectro político brasileiro TIPICAMENTE se posiciona.

REGRAS:
1. Seja ESPECÍFICO ao tema — não generalize
2. Use linguagem SIMPLES e DIRETA (as personas são de todos os níveis educacionais)
3. Cada visão deve ter 1-2 frases no máximo
4. O eixo_principal indica se o tema é mais ECONÔMICO (Estado vs Mercado) ou de COSTUMES (progressista vs conservador)
5. A direcao indica: se a pergunta é "isso é bom/deveria acontecer?", qual lado tende a concordar

EXEMPLOS:
Tema: "Privatização da Petrobras"
→ visao_direita: "Defende privatização para aumentar eficiência, reduzir corrupção estatal e atrair investimentos. O Estado não deveria ser empresário."
→ visao_esquerda: "Contra privatização — Petrobras é patrimônio do povo, garante soberania energética e preços acessíveis. Privatizar é entregar riqueza a estrangeiros."
→ eixo: "economic", direcao_direita: "favor"

Tema: "Liberação de armas"
→ visao_direita: "Cidadão de bem tem direito à autodefesa. Bandido já tem arma — desarmar só o trabalhador é injusto."
→ visao_esquerda: "Mais armas = mais mortes. Segurança é dever do Estado, não do cidadão armado. Política armamentista aumenta violência."
→ eixo: "costumes", direcao_direita: "favor"

Tema: "Vacinação obrigatória"
→ visao_direita: "Liberdade individual — ninguém deve ser obrigado a tomar vacina. Governo não pode impor o que entra no corpo do cidadão."
→ visao_esquerda: "Vacina é saúde pública e coletiva. Anti-vacina é negacionismo. Estado deve proteger a população com ciência."
→ eixo: "costumes", direcao_direita: "contra"

Tema: "Apoio a famílias de policiais militares"
→ visao_direita: "PM protege a sociedade e merece valorização. Investir em segurança e nas famílias dos policiais é prioridade."
→ visao_esquerda: "Questiona priorização de PM sobre saúde/educação. Critica militarismo e uso político de emendas para segurança."
→ eixo: "costumes", direcao_direita: "favor"

JSON:
{"visao_direita": "...", "visao_esquerda": "...", "eixo": "economic|costumes", "direcao_direita": "favor|contra"}"""


class ContextBuilder:
    """Cria contexto estruturado a partir da pergunta + dados da web."""

    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def build(
        self,
        question: str,
        web_context: str,
        feedback: str | None = None,
    ) -> ContextResult:
        """
        Gera contexto factual para a pergunta.

        Args:
            question: pergunta do usuario
            web_context: dados da web (Tavily)
            feedback: feedback do validador (se houve REVISE)
        """
        result = ContextResult()

        user_prompt = f'PERGUNTA: "{question}"\n\n'

        if web_context:
            user_prompt += f"DADOS DA WEB (use como base factual):\n{web_context}\n\n"
        else:
            user_prompt += "DADOS DA WEB: Nenhum disponível. Use seu conhecimento geral.\n\n"

        if feedback:
            user_prompt += (
                f"ATENÇÃO — O contexto anterior foi REJEITADO pelo validador:\n"
                f"{feedback}\n\n"
                f"Corrija os problemas apontados e gere um novo contexto.\n\n"
            )

        user_prompt += "Gere o contexto factual em JSON."

        try:
            response = await self._client.messages.create(
                model=settings.smart_model,
                max_tokens=1500,
                system=CONTEXT_BUILDER_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.0,
            )

            result.prompt_tokens = response.usage.input_tokens
            result.output_tokens = response.usage.output_tokens

            text_block = next((b for b in response.content if b.type == "text"), None)
            if not text_block:
                return result

            raw = text_block.text.strip()
            result.raw_text = raw

            # Limpa markdown se presente
            if raw.startswith("```"):
                raw = re.sub(r"^```json?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            # Haiku sometimes appends extra text after JSON — extract first JSON object
            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                except json.JSONDecodeError:
                    parsed = json.loads(raw)
            else:
                parsed = json.loads(raw)
            result.tema = parsed.get("tema", "")
            result.contexto = parsed.get("contexto", "")
            result.figuras = parsed.get("figuras", [])
            result.periodo = parsed.get("periodo", "")

            print(f"[ContextBuilder] Tema: {result.tema}")
            print(f"[ContextBuilder] Figuras: {[f.get('nome', '') for f in result.figuras]}")

        except json.JSONDecodeError as e:
            print(f"[ContextBuilder] Erro parsing JSON: {e}")
            # Fallback: usa o texto raw como contexto
            result.contexto = raw if raw else question
            result.tema = question[:100]
        except Exception as e:
            print(f"[ContextBuilder] Erro: {e}")
            result.contexto = f"Pergunta: {question}"
            result.tema = question[:100]

        return result

    async def build_ideological_frame(
        self,
        question: str,
        context: ContextResult | None = None,
    ) -> str:
        """
        Gera ficha de viés ideológico para o tema da pergunta.
        Usa Claude Sonnet 4.6 para máxima qualidade.

        Returns:
            String formatada com viés ideológico para anexar ao contexto,
            ou string vazia se falhar.
        """
        tema_hint = ""
        if context and context.contexto:
            tema_hint = f"\nCONTEXTO JÁ EXTRAÍDO: {context.contexto[:500]}"

        user_prompt = f'PERGUNTA/TEMA: "{question}"{tema_hint}\n\nGere a ficha de viés ideológico em JSON.'

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                system=IDEOLOGICAL_FRAME_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.0,
            )

            text_block = next((b for b in response.content if b.type == "text"), None)
            if not text_block:
                return ""

            raw = text_block.text.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```json?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(raw)

            visao_dir = parsed.get("visao_direita", "")
            visao_esq = parsed.get("visao_esquerda", "")
            eixo = parsed.get("eixo", "economic")
            direcao = parsed.get("direcao_direita", "favor")

            if not visao_dir or not visao_esq:
                return ""

            # Formatar bloco para injetar no contexto
            eixo_label = "ECONÔMICO (Estado vs Mercado)" if eixo == "economic" else "COSTUMES (Progressista vs Conservador)"
            direcao_label = (
                "ScoreEco POSITIVO (direita) tende a CONCORDAR, NEGATIVO (esquerda) tende a DISCORDAR"
                if direcao == "favor"
                else "ScoreEco NEGATIVO (esquerda) tende a CONCORDAR, POSITIVO (direita) tende a DISCORDAR"
            )

            frame = (
                f"\n\n═══ VIÉS IDEOLÓGICO DESTE TEMA ═══\n"
                f"Eixo principal: {eixo_label}\n"
                f"→ DIREITA/CONSERVADOR: {visao_dir}\n"
                f"→ ESQUERDA/PROGRESSISTA: {visao_esq}\n"
                f"→ CALIBRAÇÃO: {direcao_label}\n"
                f"⚠️ Use o ScoreEco da persona para determinar QUAL visão ela adota. "
                f"Scores extremos (±0.7+) = opinião forte. Scores perto de 0 = dividido."
            )

            print(f"[IdeologicalFrame] Eixo: {eixo} | Direção direita: {direcao}")
            print(f"[IdeologicalFrame] Direita: {visao_dir[:80]}...")
            print(f"[IdeologicalFrame] Esquerda: {visao_esq[:80]}...")

            return frame

        except Exception as e:
            print(f"[IdeologicalFrame] Erro (continuando sem frame): {e}")
            return ""
