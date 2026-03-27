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


CONTEXT_BUILDER_PROMPT = """Você cria FICHAS DE CONTEXTUALIZAÇÃO para um sistema de pesquisa social brasileira.

O conteúdo será apresentado a 20.000 personas brasileiras para medir SENTIMENTO (aprovação/reprovação). Seu papel é contextualizar o conteúdo para que as personas entendam:
1. DE QUEM ou DO QUE se trata — quem são as figuras, o que significam os termos
2. CONTEXTO FACTUAL — fatos relevantes, histórico, polêmicas envolvidas
3. O QUE o conteúdo DEFENDE ou PROPÕE — qual a tese central

Use seu CONHECIMENTO PRÓPRIO para contextualizar. Você NÃO receberá dados da web.

REGRAS:
1. MÁXIMO 5-8 frases. Seja completo mas direto.
2. Identifique TODAS as figuras públicas mencionadas: QUEM é + QUAL cargo + alinhamento político
3. Explique termos técnicos ou políticos que uma pessoa comum pode não entender (ex: "gastos públicos" = orçamento do governo federal para saúde, educação, infraestrutura, etc.)
4. Seja FACTUAL e NEUTRO — descreva os fatos sem julgamento
5. NUNCA diga se é culpado ou inocente — só o que é público
6. Se menciona punição/prisão → OBRIGATÓRIO explicar DO QUE a pessoa é acusada
7. Se o conteúdo é autoexplicativo (temas genéricos) → contexto mínimo mas identifique figuras
8. SEMPRE identifique o alinhamento político das figuras (esquerda/direita/centro)

EXEMPLOS:
- "Lula é ladrão" → contexto: "Luiz Inácio Lula da Silva, presidente do Brasil (PT, esquerda). Foi condenado na Lava-Jato por corrupção e lavagem de dinheiro, preso em 2018, solto em 2019 após decisão do STF. Condenações anuladas por questão de foro em 2021. Atualmente governa sem processos ativos."
- "Bolsonaro defende cortar gastos" → contexto: "Jair Bolsonaro (PL, direita), ex-presidente do Brasil. Gastos públicos referem-se ao orçamento federal destinado a programas sociais, saúde, educação e infraestrutura. A proposta de corte de gastos é bandeira da direita econômica que defende Estado menor."
- "Daniel Vorcaro deve ser preso?" → contexto: "Daniel Vorcaro, presidente do Banco Master. Alvo de investigações por operações financeiras suspeitas e possíveis fraudes contábeis."

JSON válido:
{
  "tema": "Título curto",
  "contexto": "5-8 frases factuais. QUEM É + contexto + O QUE PROPÕE.",
  "figuras": [{"nome": "Nome", "cargo": "Cargo", "relevancia": "alinhamento político e papel"}],
  "periodo": "período relevante"
}"""


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


SMART_SEARCH_PROMPT = """Você é um analista que decide se precisa buscar informações atualizadas na internet para contextualizar um conteúdo.

Seu conhecimento vai até maio de 2025. Se o conteúdo menciona:
- Figuras públicas conhecidas (Lula, Bolsonaro, etc.) → provavelmente NÃO precisa buscar
- Eventos recentes (após maio 2025) → SIM, precisa buscar
- Pessoas menos conhecidas → SIM, precisa buscar para identificar
- Temas genéricos (aborto, armas, privatização) → NÃO precisa buscar
- Dados específicos (números, datas, leis) → pode precisar verificar

Responda APENAS com JSON:
{"needs_search": true|false, "queries": ["busca específica 1", "busca específica 2"], "reason": "motivo curto"}

REGRAS:
- Máximo 2 queries (seja cirúrgico)
- Queries devem ser ESPECÍFICAS, não genéricas
- Se não precisa buscar, queries = []
- Prefira NÃO buscar quando seu conhecimento é suficiente"""


class ContextBuilder:
    """Cria contexto estruturado — decide se precisa buscar na web e contextualiza."""

    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._tavily = None

    def _get_tavily(self):
        if self._tavily is None:
            try:
                from tavily import TavilyClient
                self._tavily = TavilyClient(api_key=settings.tavily_api_key)
            except Exception:
                pass
        return self._tavily

    async def smart_search(self, question: str, context_text: str | None = None) -> dict:
        """
        Claude decides what to search, then executes targeted queries.
        Returns: {"searched": bool, "queries": [...], "results": "combined text", "reason": "..."}
        """
        # Step 1: Claude decides if search is needed
        content = f'CONTEÚDO: "{question}"'
        if context_text:
            content += f'\n\nCONTEXTO ADICIONAL DA MÍDIA:\n{context_text[:1000]}'

        try:
            response = await self._client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=SMART_SEARCH_PROMPT,
                messages=[{"role": "user", "content": content}],
                temperature=0.0,
            )

            raw = next((b.text for b in response.content if b.type == "text"), "")
            raw = raw.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```json?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                decision = json.loads(json_match.group())
            else:
                decision = json.loads(raw)

            needs_search = decision.get("needs_search", False)
            queries = decision.get("queries", [])[:2]
            reason = decision.get("reason", "")

            print(f"[SmartSearch] needs_search={needs_search} | reason={reason}")

            if not needs_search or not queries:
                return {"searched": False, "queries": [], "results": "", "reason": reason}

            # Step 2: Execute targeted searches via Tavily
            tavily = self._get_tavily()
            if not tavily:
                print("[SmartSearch] Tavily not available, skipping web search")
                return {"searched": False, "queries": queries, "results": "", "reason": "Tavily indisponível"}

            loop = asyncio.get_event_loop()
            search_results = []
            for q in queries:
                try:
                    res = await loop.run_in_executor(
                        None,
                        lambda q=q: tavily.search(
                            query=q,
                            search_depth="basic",
                            max_results=3,
                            include_answer=True,
                            include_raw_content=False,
                        ),
                    )
                    answer = res.get("answer", "")
                    snippets = [r.get("content", "")[:400] for r in res.get("results", [])[:3]]
                    if answer:
                        search_results.append(f"RESPOSTA: {answer}")
                    for i, s in enumerate(snippets):
                        if s:
                            search_results.append(f"[{q}] {s}")
                except Exception as e:
                    print(f"[SmartSearch] Search error for '{q}': {e}")

            combined = "\n\n".join(search_results)[:3000]
            print(f"[SmartSearch] {len(queries)} queries → {len(combined)} chars")

            return {"searched": True, "queries": queries, "results": combined, "reason": reason}

        except Exception as e:
            print(f"[SmartSearch] Decision error: {e}")
            return {"searched": False, "queries": [], "results": "", "reason": f"Erro: {e}"}

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
