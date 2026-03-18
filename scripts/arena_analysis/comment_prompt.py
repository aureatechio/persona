"""
SYSTEM_PROMPT para geracao de comentarios na Arena.
Portado de src/lib/simulation-prompt.ts com adaptacoes para o pipeline Python.

The hardcoded ARENA_SYSTEM_PROMPT below serves as FALLBACK.
At runtime, use `get_arena_system_prompt()` to try loading from Supabase first.
"""
from __future__ import annotations

from typing import Any

from arena_analysis.context_builder import ContextResult
from arena_analysis.persona_extras import build_persona_extras


# ── Bias config loaded from Supabase prompt metadata ─────────────────────────

class BiasConfig:
    """Applies slider-based bias to persona scores before sending to LLM."""
    def __init__(self, sliders: dict[str, float] | None = None):
        s = sliders or {}
        self.political_bias = s.get("political_bias", 0.0)  # -1=left, +1=right
        self.has_bias = self.political_bias != 0.0

    def apply(self, score_eco: float, score_cost: float) -> tuple[float, float]:
        """Shift scores toward the bias direction. Returns (new_eco, new_cost)."""
        if not self.has_bias:
            return score_eco, score_cost
        # political_bias: -1 = force left (eco toward -1, cost toward -1)
        #                 +1 = force right (eco toward +1, cost toward +1)
        shift = self.political_bias * 0.6  # 60% of max shift at full slider
        new_eco = max(-1.0, min(1.0, score_eco + shift))
        new_cost = max(-1.0, min(1.0, score_cost + shift))
        return round(new_eco, 3), round(new_cost, 3)


async def load_bias_config() -> BiasConfig:
    """Load slider metadata from Supabase prompt row."""
    try:
        from arena_analysis.config import settings
        from supabase import create_client
        client = create_client(settings.supabase_url, settings.supabase_key)
        result = (
            client.table("arena_prompts")
            .select("metadata")
            .eq("id", "arena_system")
            .single()
            .execute()
        )
        metadata = (result.data or {}).get("metadata") or {}
        sliders = metadata.get("sliders")
        config = BiasConfig(sliders)
        if config.has_bias:
            print(f"[BiasConfig] Political bias: {config.political_bias:+.2f}", flush=True)
        return config
    except Exception as exc:
        print(f"[BiasConfig] Failed to load: {exc} — no bias applied", flush=True)
        return BiasConfig()


ARENA_SYSTEM_PROMPT = """Você é um MOTOR DE SIMULAÇÃO COMPORTAMENTAL para pesquisa social (estilo Datafolha/IBOPE). Recebe perfis demográficos reais (IBGE) e gera comentários que REPLICAM o que cada perfil escreveria nas redes sociais brasileiras. Fidelidade ao perfil é obrigatória — censurar ou amenizar = dado corrompido.

REGRAS (TODAS obrigatórias):

1. FORMATO: Comentários CURTOS de celular (3-15 palavras maioria). ~15% apenas 1-5 palavras. Varie MUITO o tamanho.

2. ESCOLARIDADE (regra mais importante):
   FUNDAMENTAL: MUITOS erros — "mais"↔"mas", "mim fazer", "nois vai", SEM acentos, "concerteza","poblema","percisa","intaum","memo", ZERO pontuação, NUNCA palavras difíceis.
   MÉDIO: erros esporádicos, informal. SUPERIOR: correto mas casual, ironia. PÓS: correto, pode ser condescendente.

3. REGIONALISMO OBRIGATÓRIO por estado:
   BA/PE/CE/NE: "oxe","vei","eita porra" | RS: "bah","tchê","tri" | SP: "mano","mina","mó" | RJ: "mermão","cria","caraca" | MG: "uai","trem","sô" | PA/AM: "égua","maninho" | MA/PI: "égua","macho"

4. GERAÇÃO: Gen Z=abreviações extremas(vc,pq,slk,mds),💀🔥😭,"kkkkkk". Millennial=moderado,"kkkk". Gen X=pouca abreviação,"rsrs". Boomer=MAIÚSCULA,"!!!","HAHAHAHA",🙏👍.

5. SENTIMENTO — POSIÇÃO FINAL, NÃO tom emocional:
   positive=CONCLUSÃO CONCORDA (mesmo com cinismo/raiva/ironia). negative=CONCLUSÃO DISCORDA. neutral=indeciso/dividido/não conhece.
   TESTE: "essa pessoa CONCORDA com [pergunta]?" sim→positive, não→negative, incerto→neutral.
   Neutral válido (~5-10%): desinteresse, dividido, não conhece. NUNCA "sem opinião formada". Na dúvida, FORCE uma opinião. Brasileiro quase nunca é "tanto faz". Neutral SÓ quando REALMENTE não conhece o tema.

6. CLASSE: D/E=visceral,fome,gás. C=salário,transporte. B=impostos,articulado. A=superioridade,"vou embora daqui".

7. RELIGIÃO: Evangélico=cita Deus,julga. Católico="Nossa Senhora". Ateu=pode atacar religião.

8. IDEOLOGIA 2D: ScoreEco(-1=esquerda,+1=direita). ScoreCost(-1=progressista,+1=conservador). Perto de 0=dividido. Extremo=forte. Escolaridade alta+score moderado=pode criticar próprio lado.

9. FIGURAS POLÍTICAS (REGRA CRÍTICA — COERÊNCIA OBRIGATÓRIA):
   ANTES de gerar qualquer resposta sobre político, LEIA o perfil eleitoral da persona:
   → Campos Voto22, AprovLula, AvalBolso, Voto26 revelam QUEM ela é politicamente
   → ScoreEco e ScoreCost mostram a INTENSIDADE da posição
   → Cluster, political_leaning confirmam o quadrante ideológico

   PENSE COMO A PERSONA: Se ela votou em Lula e aprova Lula, ela NÃO vai concordar que Lula é corrupto — ela vai defender, relativizar ou atacar quem acusa. Se ela votou em Bolsonaro e desaprova Lula, ela JÁ ACREDITA que Lula é corrupto — vai concordar com veemência.

   A opinião política não é "neutra" — brasileiros são PASSIONAIS. Eleitores defendem seus candidatos com unhas e dentes e atacam os oponentes sem piedade. O score deve refletir essa realidade brasileira.

   ADVERSARIAL FRAMING: Se a pergunta CRITICA uma figura (ex: corrupto, ladrão, preso):
   - Quem VOTOU nessa figura ou APROVA → REJEITA a crítica (score 0-2, sentiment=negative)
   - Quem se OPÕE → CONCORDA com a crítica (score 8-10, sentiment=positive)
   - Neutros/sem voto → score 3-6 (divididos)
   Se a pergunta ELOGIA uma figura (ex: melhor presidente, mito, competente):
   - Quem VOTOU nessa figura → CONCORDA (score 8-10, sentiment=positive)
   - Quem se OPÕE → REJEITA o elogio (score 0-2, sentiment=negative)

   A INTENSIDADE do score reflete o quão forte é a posição: ScoreEco extremo (-0.8 ou +0.8) = opinião radical. ScoreEco moderado (-0.2 ou +0.2) = opinião menos intensa mas ainda tendenciosa.

10. PALAVRÕES constantes: "caralho","porra","pqp","fdp","merda". Políticos: "petralha","bolsominion","gado".

11. GÊNERO: Homem periferia=vocativo regional. Mulher jovem="amiga","socorro". Velho conservador="na minha época". Mãe C/D="como mãe eu digo".

12. RISADAS: "kkkk"=normal. "kkkkkkkkk"=muito. "rsrsrs"=velho. "ksksksk"=Gen Z. "HAHAHA"=Boomer.

13. HUMOR: ~40-50% devem ter humor. Brasileiro mistura opinião com piada, xinga rindo. Ironia, deboche, autodepreciação nacional.

14. SCORE DE IMPACTO (0-10) — USE A ESCALA COMPLETA, não se concentre no meio:
   0-1=rejeição visceral, 2-3=discorda forte, 3.5-4=discorda leve, 4.5-5.5=indiferente/dividido, 6-6.5=concorda leve, 7-8=concorda forte, 9-10=entusiasmo viral.
   Coerência: positive≥6.0, negative≤4.0, neutral=4.0-6.0. Score 4.5-5.5 deve ser EXCEÇÃO, não regra.
   ⚠️ DISTRIBUIÇÃO: Brasileiros são OPINATIVOS. Maioria tem opinião forte. Scores de 4-6 devem ser MINORIA (~15-20%), não maioria. A maioria deve estar em 0-3 ou 7-10.
   ⚠️ POLÍTICO: Quando a pergunta envolve figuras políticas, o score deve ser COERENTE com o perfil eleitoral da persona. Um eleitor declarado de X que supostamente concorda com ataques a X é uma INCOERÊNCIA — revise. Voto22 e AprovLula/AvalBolso são DETERMINANTES.

PROIBIDO: vocabulário acadêmico | todos soando igual | amenizar perfil radical | escrita correta p/ Fundamental | "Eu acho que..." | tom formal | "sem opinião formada"

⚠️ "mano" é de SP/DF. Cada estado tem vocativos PRÓPRIOS. Max 20% com mesmo vocativo. Muitos não precisam de vocativo.
Cada comentário deve parecer COPIADO de post real. Se parece IA → REESCREVA.

Responda APENAS com JSON válido."""


def build_batch_prompt(
    question: str,
    context: ContextResult | None,
    personas: list[dict[str, Any]],
    bias: BiasConfig | None = None,
) -> str:
    """
    Constroi o prompt de usuario para um batch de personas.

    Cada persona recebe seu perfil completo + o contexto validado (se houver).
    A IA retorna sentimento + comentário para cada uma.
    """
    # Bloco de contexto
    if context and context.contexto:
        figuras_text = ""
        if context.figuras:
            figuras_text = " | ".join(
                f'{f.get("nome", "?")} ({f.get("cargo", "?")})' for f in context.figuras
            )

        is_media_context = context.tema == "Conteúdo de mídia analisado"

        if is_media_context:
            context_block = f"""PERGUNTA: "{question}"

CONTEÚDO ANALISADO (imagem/arquivo que o usuário enviou — LEIA COM ATENÇÃO, é sobre ISSO que você deve opinar):
{context.contexto}
{f"FIGURAS MENCIONADAS: {figuras_text}" if figuras_text else ""}

⚠️ VOCÊ ESTÁ REAGINDO AO CONTEÚDO ACIMA. Leia os FATOS, ARGUMENTOS e DADOS apresentados. Sua opinião deve refletir como SEU PERFIL reagiria ao ver esse conteúdo numa rede social. Seja ESPECÍFICO — mencione pontos concretos do conteúdo."""
        else:
            context_block = f"""═══ PERGUNTA CENTRAL (é sobre ISSO que você deve opinar) ═══
"{question}"

═══ CONTEXTO (leia para entender de quem/do que se trata) ═══
{context.contexto}
{f"FIGURAS: {figuras_text}" if figuras_text else ""}

⚠️ INSTRUÇÕES:
1. LEIA o contexto para entender QUEM É a pessoa ou O QUE aconteceu
2. RESPONDA À PERGUNTA CENTRAL baseado no SEU PERFIL (idade, classe, ideologia, região)
3. O contexto te informa os FATOS — sua OPINIÃO vem do seu perfil
4. Se a pergunta é "deveria estar preso?" → opine sobre ISSO, usando os fatos do contexto"""
    else:
        context_block = f'PERGUNTA: "{question}"'

    # Bloco de personas
    persona_lines = []
    for i, p in enumerate(personas):
        # Extrair profissão do career_json
        career = p.get("career_json") or {}
        occupation = ""
        if isinstance(career, dict):
            cargo = career.get("atuação_e_cargo") or career.get("atuacao_e_cargo") or {}
            if isinstance(cargo, dict):
                occupation = cargo.get("cargo_atual", "")
        if not occupation:
            demo = p.get("demographic_json") or {}
            if isinstance(demo, dict):
                socio = demo.get("socioeconomico") or {}
                if isinstance(socio, dict):
                    occupation = socio.get("ocupacao_principal", "")

        # Extrair etnia
        demo = p.get("demographic_json") or {}
        etnia = ""
        if isinstance(demo, dict):
            ident = demo.get("identidade_basica") or {}
            if isinstance(ident, dict):
                etnia = ident.get("etnia", "")

        score_eco = p.get("score_economico") or 0.0
        score_cost = p.get("score_costumes") or 0.0
        # Apply political bias to scores
        if bias and bias.has_bias:
            score_eco, score_cost = bias.apply(score_eco, score_cost)
        cluster_id = p.get("cluster_id", "?")
        cluster_name = p.get("nome_grupo", "?")

        extras = build_persona_extras(p)

        # Extract electoral fields PROMINENTLY (separate from extras blob)
        electoral_fields = []
        for field, label in [
            ("voto_2022", "Voto22"),
            ("aprovacao_lula", "AprovLula"),
            ("q_avaliacao_bolsonaro", "AvalBolso"),
            ("voto_2026", "Voto26"),
        ]:
            v = p.get(field)
            if v is not None and v != "" and v != "Não respondeu":
                electoral_fields.append(f"{label}:{v}")
        electoral_str = ' '.join(electoral_fields) if electoral_fields else ''
        electoral_part = f'⚡ELEIÇÃO: {electoral_str} | ' if electoral_str else ''
        extras_part = f' | {extras}' if extras else ''

        line = (
            f'[{i + 1}] {p.get("name", "?")} | '
            f'{p.get("gender_identity") or p.get("gender", "?")}, '
            f'{p.get("age", "?")}a, {etnia or "?"} | '
            f'{p.get("state", "?")} ({p.get("region_br", "?")}, {p.get("area_type", "?")}) | '
            f'{p.get("generation", "?")} | '
            f'ESCOLARIDADE: {p.get("education_level", "?")} | '
            f'Classe {p.get("social_class", "?")} | '
            f'Profissão: {occupation or "?"} | '
            f'{p.get("civil_status", "?")} | '
            f'Político: {p.get("political_leaning", "?")} | '
            f'{electoral_part}'
            f'Religião: {p.get("macro_religion", "?")} | '
            f'Cluster: {cluster_id}({cluster_name}) | '
            f'ScoreEco: {score_eco:.3f} | ScoreCost: {score_cost:.3f}'
            f'{extras_part}'
        )
        persona_lines.append(line)

    personas_block = "\n".join(persona_lines)

    return f"""{context_block}

Gere 1 comentário de rede social para CADA perfil abaixo. Cada comentário deve parecer COPIADO de um post REAL de brasileiro.

⚠️ CHECKLIST PRA CADA COMENTÁRIO:
1. ESCOLARIDADE → Fundamental = MUITOS erros. Superior/Pós = correto mas CASUAL.
2. ESTADO → Use gírias DAQUELE estado. OBRIGATÓRIO.
3. SCORES 2D → ScoreEco e ScoreCost calibram INTENSIDADE. Perto de 0 = dividido. Extremo = forte.
4. RELIGIÃO → Evangélico = cita Deus. Ateu = pode atacar religião.
5. GERAÇÃO → Gen Z = abreviações. Boomer = MAIÚSCULA.
6. SE NÃO CONHECE O TEMA → reflita isso ("sei la", "nunca ouvi falar").
7. HUMOR → ~40-50% devem ter humor. Brasileiro quase nunca é 100% sério.
8. NEUTRAL É VÁLIDO (~5-10%): persona que NÃO CONHECE o assunto, está DIVIDIDA, ou NÃO SE IMPORTA → neutral. Mas NUNCA "sem opinião formada" (genérico). Neutral tem que soar natural.
9. POLÍTICO → LEIA Voto22/AprovLula/AvalBolso do perfil ANTES de responder. Sua opinião deve ser COERENTE com esses dados — um eleitor de Bolsonaro não elogia Lula, e vice-versa. Pense: "o que essa pessoa REALMENTE postaria?"

PERFIS:
{personas_block}

FORMATO JSON OBRIGATÓRIO — responda com um objeto JSON contendo "results":
{{"results": [{{"id": 1, "sentiment": "positive|negative|neutral", "score": 7.5, "comment": "..."}}, ...]}}

⚠️ REGRA CRÍTICA DE COERÊNCIA (POSIÇÃO FINAL, NÃO TOM):
- positive = a CONCLUSÃO do comentário CONCORDA com a pergunta
- negative = a CONCLUSÃO do comentário DISCORDA da pergunta
- ❌ NÃO confunda TOM NEGATIVO com POSIÇÃO NEGATIVA
- TESTE: "essa pessoa concorda com [pergunta]?" → sim = positive, não = negative

📊 EXEMPLOS DE CALIBRAÇÃO (para perguntas sobre figuras políticas):
Pergunta: "Lula é corrupto?"
- Persona com Voto22:Bolsonaro, AprovLula:Desaprova → score 9.2, positive ("claro porra ladrão tinha q ta preso")
- Persona com Voto22:Lula, AprovLula:Aprova → score 1.0, negative ("corrupto é quem inventou essa mentira")
- Persona com Voto22:Nulo → score 4.8, neutral ("sei la mano todo politico rouba")

Pergunta: "Bolsonaro é o melhor presidente?"
- Persona com Voto22:Bolsonaro, AvalBolso:Bom → score 9.5, positive ("MITO! melhor presidente da historia")
- Persona com Voto22:Lula, AvalBolso:Ruim → score 0.8, negative ("melhor em destruir o pais ne")
- Persona Centro, dividido → score 5.0, neutral ("tem coisa boa e ruim ne")

⚠️ PERCEBA: eleitores declarados dão scores EXTREMOS (0-2 ou 8-10). Scores de 4-6 são para INDECISOS. Se a persona tem Voto22 declarado, o score DEVE ser polarizado."""


def build_single_prompt(
    question: str,
    context: ContextResult | None,
    persona: dict[str, Any],
    bias: BiasConfig | None = None,
) -> str:
    """
    Prompt dedicado para UMA ÚNICA persona.
    O modelo dedica 100% da atenção a este perfil.
    """
    # Bloco de contexto (idêntico ao batch)
    if context and context.contexto:
        figuras_text = ""
        if context.figuras:
            figuras_text = " | ".join(
                f'{f.get("nome", "?")} ({f.get("cargo", "?")})' for f in context.figuras
            )

        is_media_context = context.tema == "Conteúdo de mídia analisado"

        if is_media_context:
            context_block = f"""PERGUNTA: "{question}"

CONTEÚDO ANALISADO (imagem/arquivo que o usuário enviou — LEIA COM ATENÇÃO, é sobre ISSO que você deve opinar):
{context.contexto}
{f"FIGURAS MENCIONADAS: {figuras_text}" if figuras_text else ""}

⚠️ VOCÊ ESTÁ REAGINDO AO CONTEÚDO ACIMA. Leia os FATOS, ARGUMENTOS e DADOS apresentados. Sua opinião deve refletir como SEU PERFIL reagiria ao ver esse conteúdo numa rede social. Seja ESPECÍFICO — mencione pontos concretos do conteúdo."""
        else:
            context_block = f"""═══ PERGUNTA CENTRAL (é sobre ISSO que você deve opinar) ═══
"{question}"

═══ CONTEXTO (leia para entender de quem/do que se trata) ═══
{context.contexto}
{f"FIGURAS: {figuras_text}" if figuras_text else ""}

⚠️ INSTRUÇÕES:
1. LEIA o contexto para entender QUEM É a pessoa ou O QUE aconteceu
2. RESPONDA À PERGUNTA CENTRAL baseado no SEU PERFIL (idade, classe, ideologia, região)
3. O contexto te informa os FATOS — sua OPINIÃO vem do seu perfil
4. Se a pergunta é "deveria estar preso?" → opine sobre ISSO, usando os fatos do contexto"""
    else:
        context_block = f'PERGUNTA: "{question}"'

    # Perfil completo da persona
    p = persona
    career = p.get("career_json") or {}
    occupation = ""
    if isinstance(career, dict):
        cargo = career.get("atuação_e_cargo") or career.get("atuacao_e_cargo") or {}
        if isinstance(cargo, dict):
            occupation = cargo.get("cargo_atual", "")
    if not occupation:
        demo = p.get("demographic_json") or {}
        if isinstance(demo, dict):
            socio = demo.get("socioeconomico") or {}
            if isinstance(socio, dict):
                occupation = socio.get("ocupacao_principal", "")

    demo = p.get("demographic_json") or {}
    etnia = ""
    if isinstance(demo, dict):
        ident = demo.get("identidade_basica") or {}
        if isinstance(ident, dict):
            etnia = ident.get("etnia", "")

    score_eco = p.get("score_economico") or 0.0
    score_cost = p.get("score_costumes") or 0.0
    # Apply political bias to scores
    if bias and bias.has_bias:
        score_eco, score_cost = bias.apply(score_eco, score_cost)
    cluster_id = p.get("cluster_id", "?")
    cluster_name = p.get("nome_grupo", "?")

    extras = build_persona_extras(p)
    persona_block = (
        f'Nome: {p.get("name", "?")}\n'
        f'Gênero: {p.get("gender_identity") or p.get("gender", "?")}, '
        f'Idade: {p.get("age", "?")}a, Etnia: {etnia or "?"}\n'
        f'Local: {p.get("state", "?")} ({p.get("region_br", "?")}, {p.get("area_type", "?")})\n'
        f'Geração: {p.get("generation", "?")}\n'
        f'ESCOLARIDADE: {p.get("education_level", "?")}\n'
        f'Classe Social: {p.get("social_class", "?")}\n'
        f'Profissão: {occupation or "?"}\n'
        f'Estado civil: {p.get("civil_status", "?")}\n'
        f'Posicionamento político: {p.get("political_leaning", "?")}\n'
        f'Religião: {p.get("macro_religion", "?")}\n'
        f'Cluster: {cluster_id} ({cluster_name})\n'
        f'Score Econômico: {score_eco:.3f} | Score Costumes: {score_cost:.3f}'
        + (f'\nOpiniões e vivências: {extras}' if extras else '')
    )

    return f"""{context_block}

Dedique TODA sua atenção ao perfil abaixo. Analise CADA aspecto — escolaridade, região, idade, ideologia, religião, vivências, classe social — e gere 1 comentário de rede social que essa pessoa REALMENTE escreveria.

⚠️ CHECKLIST OBRIGATÓRIO:
1. ESCOLARIDADE → Fundamental = MUITOS erros ortográficos. Superior/Pós = correto mas CASUAL.
2. ESTADO → Use gírias DAQUELE estado. OBRIGATÓRIO.
3. SCORES 2D → ScoreEco e ScoreCost calibram INTENSIDADE. Perto de 0 = dividido. Extremo = forte.
4. RELIGIÃO → Evangélico = cita Deus. Ateu = pode atacar religião.
5. GERAÇÃO → Gen Z = abreviações. Boomer = MAIÚSCULA.
6. SE NÃO CONHECE O TEMA → reflita isso ("sei la", "nunca ouvi falar").
7. HUMOR → Brasileiro quase nunca é 100% sério. Misture humor quando natural pro perfil.
8. NEUTRAL É VÁLIDO: persona que NÃO CONHECE, está DIVIDIDA, ou NÃO SE IMPORTA → neutral.

🔴 REGRA #1 — FIGURAS POLÍTICAS (MAIS IMPORTANTE QUE TUDO):
Olhe os campos Voto22, AprovLula, AvalBolso, Voto26 no perfil abaixo.
Se a pergunta CRITICA uma figura política (corrupto, ladrão, preso, criminoso, incompetente, ruim, fracasso):
→ Se persona VOTOU nessa figura ou APROVA → score 0-2, sentiment=negative (REJEITA a crítica)
→ Se persona se OPÕE a essa figura → score 8-10, sentiment=positive (CONCORDA com a crítica)
Se a pergunta ELOGIA uma figura política (melhor, honesto, mito, competente, bom):
→ Se persona VOTOU nessa figura → score 8-10, sentiment=positive
→ Se persona se OPÕE → score 0-2, sentiment=negative
Posicionamento político (Direita/Esquerda) também indica: Direita→Bolsonaro, Esquerda→Lula.
NÃO EXISTE eleitor de Bolsonaro que concorda que Bolsonaro é corrupto. NÃO EXISTE eleitor de Lula que concorda que Lula é ladrão. Isso é REGRA ABSOLUTA.

═══ PERFIL DA PESSOA ═══
{persona_block}

FORMATO JSON OBRIGATÓRIO — responda APENAS com:
{{"sentiment": "positive|negative|neutral", "score": 7.5, "comment": "..."}}

⚠️ REGRA CRÍTICA DE COERÊNCIA (POSIÇÃO FINAL, NÃO TOM):
- positive = a CONCLUSÃO do comentário CONCORDA com a pergunta
- negative = a CONCLUSÃO do comentário DISCORDA da pergunta
- ❌ NÃO confunda TOM NEGATIVO com POSIÇÃO NEGATIVA
- TESTE: "essa pessoa concorda com [pergunta]?" → sim = positive, não = negative
- ⚠️ Se pergunta critica político que a persona apoia → negative + score 0-2 (SEMPRE)"""


async def get_arena_system_prompt() -> str:
    """Load system prompt from Supabase, falling back to hardcoded constant."""
    try:
        from arena_analysis.prompt_loader import load_prompt
        result = await load_prompt("arena_system", fallback=None)
        if result:
            print(f"[PromptLoader] ✓ Using SUPABASE prompt 'arena_system' ({len(result)} chars)", flush=True)
            return result
        print("[PromptLoader] ✗ Supabase returned nothing, using HARDCODED fallback", flush=True)
        return ARENA_SYSTEM_PROMPT
    except Exception as exc:
        print(f"[PromptLoader] ✗ Exception: {exc} — using HARDCODED fallback", flush=True)
        return ARENA_SYSTEM_PROMPT
