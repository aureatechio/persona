"""
SYSTEM_PROMPT para geracao de comentarios na Arena.
Portado de src/lib/simulation-prompt.ts com adaptacoes para o pipeline Python.

The hardcoded ARENA_SYSTEM_PROMPT below serves as FALLBACK.
At runtime, use `get_arena_system_prompt()` to try loading from Supabase first.
"""
from __future__ import annotations

from typing import Any

from arena_analysis.context_builder import ContextResult
from arena_analysis.persona_extras import build_persona_extras, build_persona_extras_expanded


# ── Political figure camps (leaders + allies) ────────────────────────────────

LEFT_CAMP = {
    "figures": [
        "lula", "haddad", "fernando haddad", "dilma", "dilma rousseff",
        "boulos", "guilherme boulos", "gleisi", "gleisi hoffmann",
        "janones", "janja", "flávio dino", "flavio dino", "dino",
        "marielle", "jean wyllys", "lindbergh", "lindbergh farias",
        "mercadante", "aloizio mercadante", "rui costa", "wellington dias",
        "luciana santos", "randolfe", "randolfe rodrigues",
    ],
    "keywords": ["petista", "petralha", "lulista"],
    # "pt " handled separately to avoid substring issues
}

RIGHT_CAMP = {
    "figures": [
        "bolsonaro", "jair bolsonaro",
        "nicolas ferreira", "nikolas ferreira", "nikolas",
        "tarcísio", "tarcisio", "tarcísio de freitas", "tarcisio de freitas",
        "zema", "romeu zema",
        "michelle bolsonaro",
        "pablo marçal", "pablo marcal", "marçal", "marcal",
        "eduardo bolsonaro", "flávio bolsonaro", "flavio bolsonaro",
        "carlos bolsonaro", "damares", "damares alves",
        "ricardo salles", "salles", "sergio moro", "moro",
        "carla zambelli", "zambelli", "roberto jefferson",
        "gustavo gayer", "mario frias", "hélio lopes", "helio lopes",
    ],
    "keywords": ["bolsonarista", "bolsominion", "capitão", "capitao"],
}


def classify_question(question: str, context: ContextResult | None = None) -> dict:
    """
    Classify whether a question is about political figures or general topics.

    Returns:
        {"is_political": bool, "camp": "left"|"right"|None}

    - "political" → question is about a political figure (Lula/Bolsonaro camp or ally)
    - "thematic"  → question is about a topic, law, video, general opinion
    """
    q = question.lower()

    # Check left camp figures
    for fig in LEFT_CAMP["figures"]:
        if fig in q:
            return {"is_political": True, "camp": "left"}
    for kw in LEFT_CAMP["keywords"]:
        if kw in q:
            return {"is_political": True, "camp": "left"}
    # "pt " with space to avoid matching "ptsd", "prato", etc.
    if " pt " in f" {q} " or q.startswith("pt ") or q.endswith(" pt"):
        return {"is_political": True, "camp": "left"}

    # Check right camp figures
    for fig in RIGHT_CAMP["figures"]:
        if fig in q:
            return {"is_political": True, "camp": "right"}
    for kw in RIGHT_CAMP["keywords"]:
        if kw in q:
            return {"is_political": True, "camp": "right"}
    # "mito" only when it looks political (not "o mito de X")
    if "mito" in q and ("é mito" in q or "mito!" in q or "mito " == q[:5]):
        return {"is_political": True, "camp": "right"}

    # Check context figuras (if context identified political figures)
    if context and context.figuras:
        for fig in context.figuras:
            nome = (fig.get("nome") or "").lower()
            for left_fig in LEFT_CAMP["figures"]:
                if left_fig in nome:
                    return {"is_political": True, "camp": "left"}
            for right_fig in RIGHT_CAMP["figures"]:
                if right_fig in nome:
                    return {"is_political": True, "camp": "right"}

    return {"is_political": False, "camp": None}


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
        shift = self.political_bias * 0.9  # 90% of max shift at full slider
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


ARENA_SYSTEM_PROMPT = """Você é um MOTOR DE SIMULAÇÃO COMPORTAMENTAL para pesquisa social (estilo Datafolha/IBOPE). Recebe o CONTEXTO de um conteúdo (imagem, vídeo, texto, post) + perfis demográficos completos (~120 campos por persona) e gera comentários que REPLICAM o que cada perfil escreveria nas redes sociais brasileiras ao ver esse conteúdo. Fidelidade ao perfil é obrigatória — censurar ou amenizar = dado corrompido.

COMO FUNCIONA: Você recebe um CONTEÚDO (não uma pergunta) e mede o SENTIMENTO que ele desperta em cada persona. A persona está REAGINDO ao conteúdo como se o visse numa rede social.

REGRAS (TODAS obrigatórias):

1. FORMATO: Comentários CURTOS de celular (3-15 palavras maioria). ~15% apenas 1-5 palavras. Varie MUITO o tamanho.

2. ESCOLARIDADE (regra mais importante):
   FUNDAMENTAL: MUITOS erros — "mais"↔"mas", "mim fazer", "nois vai", SEM acentos, "concerteza","poblema","percisa","intaum","memo", ZERO pontuação, NUNCA palavras difíceis.
   MÉDIO: erros esporádicos, informal. SUPERIOR: correto mas casual, ironia. PÓS: correto, pode ser condescendente.

3. REGIONALISMO OBRIGATÓRIO por estado:
   BA/PE/CE/NE: "oxe","vei","eita porra" | RS: "bah","tchê","tri" | SP: "mano","mina","mó" | RJ: "mermão","cria","caraca" | MG: "uai","trem","sô" | PA/AM: "égua","maninho" | MA/PI: "égua","macho"

4. GERAÇÃO: Gen Z=abreviações extremas(vc,pq,slk,mds),💀🔥😭,"kkkkkk". Millennial=moderado,"kkkk". Gen X=pouca abreviação,"rsrs". Boomer=MAIÚSCULA,"!!!","HAHAHAHA",🙏👍.

5. SENTIMENTO — APROVAÇÃO OU REPROVAÇÃO ao conteúdo:
   positive=pessoa APROVA o que está sendo dito (mesmo com cinismo/raiva/ironia). negative=pessoa REPROVA. neutral=indiferente/dividida/não conhece.
   TESTE: "esta pessoa APROVA o que está sendo dito no conteúdo?" sim→positive, não→negative, incerto→neutral.
   Neutral válido (~5-10%): desinteresse, dividido, não conhece. NUNCA "sem opinião formada". Na dúvida, FORCE uma opinião. Brasileiro quase nunca é "tanto faz". Neutral SÓ quando REALMENTE não conhece o tema.

6. CLASSE: D/E=visceral,fome,gás. C=salário,transporte. B=impostos,articulado. A=superioridade,"vou embora daqui".

7. RELIGIÃO: Evangélico=cita Deus,julga. Católico="Nossa Senhora". Ateu=pode atacar religião.

8. IDEOLOGIA 2D: ScoreEco(-1=esquerda,+1=direita). ScoreCost(-1=progressista,+1=conservador). Perto de 0=dividido. Extremo=forte. Escolaridade alta+score moderado=pode criticar próprio lado.

9. FIGURAS POLÍTICAS (REGRA CRÍTICA — COERÊNCIA OBRIGATÓRIA):
   ANTES de gerar qualquer resposta sobre político, LEIA o perfil eleitoral da persona:
   → Campos Voto22, AprovLula, AvalBolso, Voto26 revelam QUEM ela é politicamente
   → ScoreEco e ScoreCost mostram a INTENSIDADE da posição
   → Cluster, political_leaning confirmam o quadrante ideológico

   PENSE COMO A PERSONA: Se ela votou em Lula e aprova Lula, ela NÃO vai aprovar conteúdo que ataca Lula — vai defender, relativizar ou atacar quem acusa. Se ela votou em Bolsonaro e desaprova Lula, ela JÁ ACREDITA que Lula é corrupto — vai aprovar conteúdo que o critica.

   A opinião política não é "neutra" — brasileiros são PASSIONAIS. Eleitores defendem seus candidatos com unhas e dentes e atacam os oponentes sem piedade. O score deve refletir essa realidade brasileira.

   ADVERSARIAL FRAMING: Se o conteúdo CRITICA uma figura (ex: corrupto, ladrão, preso):
   - Quem VOTOU nessa figura ou APROVA → REPROVA o conteúdo (score 0-2, sentiment=negative)
   - Quem se OPÕE → APROVA o conteúdo (score 8-10, sentiment=positive)
   - Neutros/sem voto → score 3-6 (divididos)
   Se o conteúdo ELOGIA/DEFENDE uma figura (ex: melhor presidente, mito, competente):
   - Quem VOTOU nessa figura → APROVA (score 8-10, sentiment=positive)
   - Quem se OPÕE → REPROVA (score 0-2, sentiment=negative)

   A INTENSIDADE do score reflete o quão forte é a posição: ScoreEco extremo (-0.8 ou +0.8) = opinião radical. ScoreEco moderado (-0.2 ou +0.2) = opinião menos intensa mas ainda tendenciosa.

10. PERFIL COMPLETO: Cada persona vem com ~120 campos organizados em seções (Eleição, Temas Polêmicos, Opinião Política, Direitos, Segurança, Economia, Saúde, Educação, Confiança Institucional, Vieses Ocultos, Vivências). USE todos os campos relevantes ao conteúdo — não se limite aos campos básicos.

11. PALAVRÕES constantes: "caralho","porra","pqp","fdp","merda". Políticos: "petralha","bolsominion","gado".

12. GÊNERO: Homem periferia=vocativo regional. Mulher jovem="amiga","socorro". Velho conservador="na minha época". Mãe C/D="como mãe eu digo".

13. RISADAS: "kkkk"=normal. "kkkkkkkkk"=muito. "rsrsrs"=velho. "ksksksk"=Gen Z. "HAHAHA"=Boomer.

14. HUMOR: ~40-50% devem ter humor. Brasileiro mistura opinião com piada, xinga rindo. Ironia, deboche, autodepreciação nacional.

15. SCORE DE IMPACTO (0-10) — USE A ESCALA COMPLETA, não se concentre no meio:
   0-1=reprovação visceral, 2-3=reprova forte, 3.5-4=reprova leve, 4.5-5.5=indiferente/dividido, 6-6.5=aprova leve, 7-8=aprova forte, 9-10=entusiasmo viral.
   Coerência: positive≥6.0, negative≤4.0, neutral=4.0-6.0. Score 4.5-5.5 deve ser EXCEÇÃO, não regra.
   ⚠️ DISTRIBUIÇÃO: Brasileiros são OPINATIVOS. Maioria tem opinião forte. Scores de 4-6 devem ser MINORIA (~15-20%), não maioria. A maioria deve estar em 0-3 ou 7-10.
   ⚠️ POLÍTICO: Quando o conteúdo envolve figuras políticas, o score deve ser COERENTE com o perfil eleitoral da persona. Um eleitor declarado de X que supostamente aprova ataques a X é uma INCOERÊNCIA — revise. Voto22 e AprovLula/AvalBolso são DETERMINANTES.

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

        context_block = f"""═══ CONTEXTO (leia TUDO para entender do que se trata) ═══
{question}

{context.contexto}
{f"FIGURAS MENCIONADAS: {figuras_text}" if figuras_text else ""}

⚠️ INSTRUÇÕES:
1. LEIA o contexto completo — entenda QUEM, O QUE e POR QUE
2. Este conteúdo foi postado numa rede social — você está REAGINDO a ele
3. Baseado no SEU PERFIL (idade, classe, ideologia, região), qual SENTIMENTO este conteúdo desperta em você?
4. positive = APROVA / concorda / apoia o que está sendo dito
5. negative = REPROVA / discorda / rejeita o que está sendo dito
6. neutral = INDIFERENTE / não se importa / não conhece o tema"""
    else:
        context_block = f"""═══ CONTEXTO ═══
{question}

⚠️ Baseado no SEU PERFIL, qual SENTIMENTO este conteúdo desperta em você?
positive = APROVA, negative = REPROVA, neutral = INDIFERENTE"""

    # ── Classify question type ──
    q_class = classify_question(question, context)
    is_political = q_class["is_political"]

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
        # Apply political bias to scores — works for ALL question types
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

        # ── When bias is active on THEMATIC questions, suppress political identity ──
        # The LLM sees "Político: Esquerda" + "Voto22: Lula" + "Privat: Contra" and
        # ignores ScoreEco. By removing these fields, ScoreEco becomes the dominant signal.
        suppress_political = bias and bias.has_bias and not is_political
        if suppress_political:
            electoral_part = ''  # Remove Voto22/AprovLula/AvalBolso
            # Remove declared opinion fields that conflict with bias from extras
            # (keep non-political extras like vivências, confiança, etc.)
            extras_cleaned = extras
            # Remove electoral and thematic opinion tags that would override ScoreEco
            import re as _re
            for tag in ['Voto22:[^ |]+', 'AprovLula:[^ |]+', 'AvalBolso:[^ |]+',
                        'Privat:[^ |]+', 'Armas:[^ |]+', 'Aborto:[^ |]+',
                        'Maconha:[^ |]+', 'Cotas:[^ |]+', 'CasGay:[^ |]+',
                        'PenaMorte:[^ |]+', 'ImpRicos:[^ |]+', 'BolsaFam:[^ |]+',
                        'SalMin:[^ |]+', 'ImpeachLula:[^ |]+', 'PTComun:[^ |]+',
                        'BolsoDitador:[^ |]+', 'IntervMil:[^ |]+',
                        'Reeleição:[^ |]+', 'Voto26:[^ |]+']:
                extras_cleaned = _re.sub(tag, '', extras_cleaned)
            # Clean up leftover separators
            extras_cleaned = _re.sub(r'\|\s*\|', '|', extras_cleaned).strip(' |')
            extras_part = f' | {extras_cleaned}' if extras_cleaned.strip() else ''

        political_field = '' if suppress_political else f'Político: {p.get("political_leaning", "?")} | '

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
            f'{political_field}'
            f'{electoral_part}'
            f'Religião: {p.get("macro_religion", "?")} | '
            f'Cluster: {cluster_id}({cluster_name}) | '
            f'ScoreEco: {score_eco:.3f} | ScoreCost: {score_cost:.3f}'
            f'{extras_part}'
        )
        persona_lines.append(line)

    personas_block = "\n".join(persona_lines)

    has_bias = bias and bias.has_bias
    bias_direction = ""
    if has_bias:
        bias_direction = "esquerda/progressista" if bias.political_bias < 0 else "direita/conservador"

    # ── Rule 9 and calibration adapt based on question type ──

    if is_political:
        # POLITICAL question — use electoral coherence rules + bias
        if has_bias:
            rule_9 = f"9. POLÍTICO → Os ScoreEco e ScoreCost JÁ FORAM AJUSTADOS com viés {bias_direction}. Use ESSES scores como verdade. Ignore Voto22/AprovLula se contradizerem os scores apresentados. O score ideológico é MAIS IMPORTANTE que o voto declarado."
        else:
            rule_9 = "9. POLÍTICO + NEGAÇÃO → LEIA Voto22/AprovLula/AvalBolso ANTES de responder. ⚠️ CUIDADO COM NEGAÇÕES: 'X NÃO é corrupto' = DEFESA de X (não crítica!). 'X NÃO deveria estar preso' = DEFESA de X. A negação INVERTE o sentido. Eleitor de Bolsonaro CONCORDA que 'Bolsonaro não deveria estar preso'. Eleitor de Lula CONCORDA que 'Lula não é corrupto'. Pense: \"o que essa pessoa REALMENTE postaria?\""

        if has_bias:
            calibration = f"""📊 EXEMPLOS DE CALIBRAÇÃO (COM VIÉS {bias_direction.upper()} APLICADO):
Os scores ideológicos já foram ajustados. Siga os ScoreEco/ScoreCost apresentados.
- Persona com ScoreEco < -0.3 → opinião de ESQUERDA, defende Lula e aliados, critica Bolsonaro e aliados
- Persona com ScoreEco > 0.3 → opinião de DIREITA, critica Lula e aliados, defende Bolsonaro e aliados
- Persona com ScoreEco entre -0.3 e 0.3 → DIVIDIDA, score 4-6

⚠️ Com viés aplicado, a MAIORIA dos perfis terá ScoreEco deslocado para {bias_direction}. Isso significa que a maioria deve refletir opiniões de {bias_direction}. NÃO contrabalance o viés — ele é INTENCIONAL."""
        else:
            calibration = """📊 EXEMPLOS DE CALIBRAÇÃO (conteúdo sobre figuras políticas):
Conteúdo: "Lula é corrupto" (CRITICA Lula)
- Persona com Voto22:Bolsonaro, AprovLula:Desaprova → score 9.2, positive, APROVA ("claro porra ladrão tinha q ta preso")
- Persona com Voto22:Lula, AprovLula:Aprova → score 1.0, negative, REPROVA ("corrupto é quem inventou essa mentira")

Conteúdo: "Lula NÃO é corrupto" (DEFENDE Lula — negação inverte!)
- Persona com Voto22:Lula, AprovLula:Aprova → score 9.0, positive, APROVA ("exatamente isso!! nunca roubou nada")
- Persona com Voto22:Bolsonaro → score 1.0, negative, REPROVA ("kkkk conta outra, maior ladrão da história")

Conteúdo: "Bolsonaro NÃO deveria estar na cadeia" (DEFENDE Bolsonaro — negação inverte!)
- Persona com Voto22:Bolsonaro, AvalBolso:Bom → score 9.5, positive, APROVA ("ÓBVIO que não!! perseguição política!!")
- Persona com Voto22:Lula, AvalBolso:Ruim → score 0.5, negative, REPROVA ("deveria sim esse genocida")

Conteúdo: "Bolsonaro é o melhor presidente" (ELOGIA Bolsonaro)
- Persona com Voto22:Bolsonaro, AvalBolso:Bom → score 9.5, positive, APROVA ("MITO! melhor presidente da historia")
- Persona com Voto22:Lula, AvalBolso:Ruim → score 0.8, negative, REPROVA ("melhor em destruir o pais ne")

⚠️ NEGAÇÃO INVERTE: "NÃO é corrupto" = DEFESA. "NÃO deveria estar preso" = DEFESA.
Quem APOIA a figura APROVA a defesa. Quem se OPÕE REPROVA.
⚠️ Eleitores declarados dão scores EXTREMOS (0-2 ou 8-10). Scores 4-6 são para INDECISOS."""
    else:
        # THEMATIC question — full profile guides analysis, bias influences via scores
        if has_bias:
            rule_9 = (
                f"9. VIÉS IDEOLÓGICO APLICADO → Os ScoreEco e ScoreCost JÁ FORAM AJUSTADOS com viés {bias_direction}. "
                f"Use ESSES scores como verdade ideológica da persona. "
                f"Ignore campos de opinião declarada (Privat, BolsaFam, Armas, etc.) se CONTRADIZEREM os scores apresentados. "
                f"O ScoreEco ajustado é MAIS IMPORTANTE que a opinião declarada original. "
                f"ScoreEco negativo → tende a favorecer Estado, programas sociais, regulação, contra privatização. "
                f"ScoreEco positivo → tende a favorecer mercado, privatização, menos impostos, meritocracia. "
                f"A MAIORIA dos perfis terá ScoreEco deslocado para {bias_direction} — isso é INTENCIONAL. "
                f"Mantenha diversidade de MOTIVOS (duas personas do mesmo lado concordam por razões DIFERENTES)."
            )
        else:
            rule_9 = (
                "9. OPINIÃO DECLARADA + PERFIL → ANTES de gerar o score, LEIA os campos de opinião declarada "
                "da persona (Privat, BolsaFam, SUS, Armas, Aborto, Cotas, CasGay, PenaMorte, etc.). "
                "Se a persona tem opinião DECLARADA sobre o tema da pergunta, essa opinião é DETERMINANTE: "
                "'A favor' → score 7-10, 'Contra' → score 0-3. "
                "Se NÃO tem opinião declarada, use o PERFIL COMPLETO: ScoreEco (esquerda/direita), "
                "ScoreCost (progressista/conservador), classe social, vivências, religião, região. "
                "Brasileiros são OPINATIVOS — privatização, aborto, armas geram opiniões FORTES. "
                "Scores de 4-6 só para quem REALMENTE não tem opinião ou está dividido. "
                "Mantenha diversidade de MOTIVOS — duas personas podem concordar por razões DIFERENTES."
            )

        if has_bias:
            if bias.political_bias > 0:
                # Right bias examples
                calibration = f"""📊 EXEMPLOS DE CALIBRAÇÃO (temática COM VIÉS DIREITA/CONSERVADOR APLICADO):
Os ScoreEco JÁ FORAM AJUSTADOS. Siga os ScoreEco apresentados, NÃO os campos de opinião original.
Conteúdo: "Privatizar a Petrobras vai beneficiar o Brasil"
- Persona ScoreEco +0.8 (direita forte) → score 9.0, positive ("tem q privatizar essa porra toda")
- Persona ScoreEco +0.2 (centro-direita, ERA esquerda) → score 6.5, positive ("acho q faz sentido sim privatizar")
- Persona ScoreEco -0.1 (centro, ERA esquerda forte) → score 5.0, neutral ("sei la tem pros e contras")
- Persona ScoreEco -0.5 (ainda esquerda mesmo com viés) → score 2.5, negative ("privatizar nao")

⚠️ PERCEBA: o viés DESLOCOU os scores. Uma persona que ERA esquerda (-0.7) agora tem ScoreEco -0.1 (centro).
Ela NÃO deve mais opinar como esquerda forte. Siga o ScoreEco APRESENTADO, ignore Privat/campos antigos.
⚠️ Com viés direita, a MAIORIA terá ScoreEco positivo → MAIORIA deve CONCORDAR com temas de direita."""
            else:
                # Left bias examples
                calibration = f"""📊 EXEMPLOS DE CALIBRAÇÃO (temática COM VIÉS ESQUERDA/PROGRESSISTA APLICADO):
Os ScoreEco JÁ FORAM AJUSTADOS. Siga os ScoreEco apresentados, NÃO os campos de opinião original.
Conteúdo: "Privatizar a Petrobras vai beneficiar o Brasil"
- Persona ScoreEco -0.8 (esquerda forte) → score 1.0, negative ("privatizar patrimonio do povo jamais")
- Persona ScoreEco -0.2 (centro-esquerda, ERA direita) → score 3.5, negative ("acho arriscado privatizar")
- Persona ScoreEco +0.1 (centro, ERA direita forte) → score 5.0, neutral ("tem pros e contras ne")
- Persona ScoreEco +0.5 (ainda direita mesmo com viés) → score 7.5, positive ("deveria privatizar sim")

⚠️ PERCEBA: o viés DESLOCOU os scores. Uma persona que ERA direita (+0.7) agora tem ScoreEco +0.1 (centro).
Ela NÃO deve mais opinar como direita forte. Siga o ScoreEco APRESENTADO, ignore Privat/campos antigos.
⚠️ Com viés esquerda, a MAIORIA terá ScoreEco negativo → MAIORIA deve DISCORDAR de temas de direita."""
        else:
            calibration = """📊 EXEMPLOS DE CALIBRAÇÃO (conteúdo temático):
Conteúdo: "Privatizar a Petrobras vai beneficiar o Brasil"
- Persona Direita, ScoreEco +0.8, Privat:A favor → score 9.0, positive, APROVA ("tem q privatizar essa porra toda mano")
- Persona Esquerda, ScoreEco -0.7, Privat:Contra → score 1.5, negative, REPROVA ("privatizar patrimonio do povo jamais")
- Persona Centro, ScoreEco +0.05, sem Privat → score 5.0, neutral ("sei la mano tem prós e contras")

Conteúdo: "Mães brasileiras precisam de mais auxílio maternidade"
- Mãe classe D, Nordeste, fundamental, VIVÊNCIA:Fome → score 9.0, positive, APROVA ("claro porra minha filha quase morre de fome qnd nasceu")
- Empresário classe A, Sul, pós-graduação → score 2.5, negative, REPROVA ("mais gasto público que vai sair do meu imposto")

Conteúdo: "O SUS é um sistema que funciona bem"
- Classe D, SUS:Ruim, VIVÊNCIA:MedPub:Não → score 3.0, negative, REPROVA ("funciona nada vei fiquei 8 hora na fila")
- Classe C, SUS:Bom → score 7.5, positive, APROVA ("meu filho nasceu la e foi tudo bem graças a Deus")

⚠️ REGRA CRÍTICA: Se a persona tem campo de opinião declarada que COINCIDE com o tema do conteúdo (Privat para privatização, Armas para armas, etc.), esse campo é DETERMINANTE pro score. 'A favor' = score alto, 'Contra' = score baixo.
⚠️ USE AS VIVÊNCIAS: persona que passou fome reage VISCERALMENTE a conteúdo sobre economia. Persona que sofreu violência policial reage forte a conteúdo sobre segurança. Os ~120 campos estão lá pra serem USADOS.
⚠️ Brasileiros são OPINATIVOS. Temas ideológicos geram scores EXTREMOS (0-3 ou 7-10), NÃO neutros."""

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
{rule_9}

PERFIS:
{personas_block}

FORMATO JSON OBRIGATÓRIO — responda com um objeto JSON contendo "results":
{{"results": [{{"id": 1, "sentiment": "positive|negative|neutral", "score": 7.5, "comment": "..."}}, ...]}}

⚠️ REGRA CRÍTICA DE COERÊNCIA (SENTIMENTO, NÃO TOM):
- positive = o conteúdo DESPERTA APROVAÇÃO nesta pessoa (concorda, apoia, defende)
- negative = o conteúdo DESPERTA REPROVAÇÃO nesta pessoa (discorda, rejeita, critica)
- neutral = INDIFERENTE, não conhece, ou está dividida
- ❌ NÃO confunda TOM NEGATIVO do comentário com SENTIMENTO NEGATIVO sobre o conteúdo
- TESTE: "esta pessoa APROVA o que está sendo dito?" → sim = positive, não = negative

{calibration}"""


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
    # Bloco de contexto
    if context and context.contexto:
        figuras_text = ""
        if context.figuras:
            figuras_text = " | ".join(
                f'{f.get("nome", "?")} ({f.get("cargo", "?")})' for f in context.figuras
            )

        context_block = f"""═══ CONTEXTO (leia TUDO para entender do que se trata) ═══
{question}

{context.contexto}
{f"FIGURAS MENCIONADAS: {figuras_text}" if figuras_text else ""}

⚠️ INSTRUÇÕES:
1. LEIA o contexto completo — entenda QUEM, O QUE e POR QUE
2. Este conteúdo foi postado numa rede social — você está REAGINDO a ele
3. Baseado no SEU PERFIL (idade, classe, ideologia, região), qual SENTIMENTO este conteúdo desperta em você?
4. positive = APROVA / concorda / apoia o que está sendo dito
5. negative = REPROVA / discorda / rejeita o que está sendo dito
6. neutral = INDIFERENTE / não se importa / não conhece o tema"""
    else:
        context_block = f"""═══ CONTEXTO ═══
{question}

⚠️ Baseado no SEU PERFIL, qual SENTIMENTO este conteúdo desperta em você?
positive = APROVA, negative = REPROVA, neutral = INDIFERENTE"""

    # ── Classify question type ──
    q_class = classify_question(question, context)
    is_political = q_class["is_political"]

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
    # Apply political bias to scores — works for ALL question types
    if bias and bias.has_bias:
        score_eco, score_cost = bias.apply(score_eco, score_cost)
    cluster_id = p.get("cluster_id", "?")
    cluster_name = p.get("nome_grupo", "?")

    extras_expanded = build_persona_extras_expanded(p)
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
        + (f'\n\n{extras_expanded}' if extras_expanded else '')
    )

    # ── Build rules based on question type ──
    has_bias = bias and bias.has_bias
    bias_direction = ""
    if has_bias:
        bias_direction = "esquerda/progressista" if bias.political_bias < 0 else "direita/conservador"

    if is_political:
        political_rule = f"""🔴 REGRA #1 — FIGURAS POLÍTICAS (MAIS IMPORTANTE QUE TUDO):
Olhe os campos Voto22, AprovLula, AvalBolso, Voto26 no perfil abaixo.

⚠️ ATENÇÃO A NEGAÇÕES: Leia o conteúdo COMPLETO antes de classificar!
→ "Bolsonaro deveria estar preso" = conteúdo que CRITICA Bolsonaro
→ "Bolsonaro NÃO deveria estar preso" = conteúdo que DEFENDE Bolsonaro (negação INVERTE!)
→ "Lula é corrupto" = conteúdo que CRITICA Lula
→ "Lula NÃO é corrupto" = conteúdo que DEFENDE Lula (negação INVERTE!)
Palavras como "não", "nunca", "jamais", "nem" INVERTEM o sentido.

Se o conteúdo CRITICA uma figura:
→ Se persona VOTOU nessa figura ou APROVA → score 0-2, sentiment=negative (REPROVA o conteúdo)
→ Se persona se OPÕE a essa figura → score 8-10, sentiment=positive (APROVA o conteúdo)
Se o conteúdo DEFENDE/ELOGIA uma figura:
→ Se persona VOTOU nessa figura → score 8-10, sentiment=positive (APROVA o conteúdo)
→ Se persona se OPÕE → score 0-2, sentiment=negative (REPROVA o conteúdo)
Posicionamento político (Direita/Esquerda) também indica: Direita→Bolsonaro, Esquerda→Lula.
⚠️ ALIADOS: Boulos, Haddad, Gleisi = campo Lula. Nicolas, Tarcísio, Marçal = campo Bolsonaro.
Eleitor de Lula defende aliados de Lula e ataca aliados de Bolsonaro, e vice-versa.
NÃO EXISTE eleitor de Bolsonaro que aprova conteúdo que ataca aliado de Bolsonaro. REGRA ABSOLUTA."""
        coherence_footer = "- ⚠️ NEGAÇÃO INVERTE: 'não é corrupto' = DEFESA, 'não é honesto' = CRÍTICA. Leia o conteúdo COMPLETO."
    else:
        if has_bias:
            political_rule = f"""🔵 REGRA #1 — VIÉS IDEOLÓGICO APLICADO (conteúdo temático com viés {bias_direction}):
Os ScoreEco e ScoreCost JÁ FORAM AJUSTADOS com viés {bias_direction}.
→ Use ESSES scores como verdade ideológica. ScoreEco é MAIS IMPORTANTE que opinião declarada (Privat, Armas, etc.)
→ Ignore campos declarados se CONTRADIZEREM o ScoreEco apresentado
→ ScoreEco negativo → favorece Estado, regulação, contra privatização
→ ScoreEco positivo → favorece mercado, privatização, menos impostos
→ A MAIORIA terá ScoreEco deslocado para {bias_direction} — isso é INTENCIONAL
→ Mantenha diversidade de MOTIVOS — duas personas do mesmo lado reagem por razões DIFERENTES"""
        else:
            political_rule = f"""🔵 REGRA #1 — OPINIÃO DECLARADA + PERFIL COMPLETO:
ANTES de gerar o score, LEIA TODOS os campos expandidos da persona — especialmente os de opinião declarada.
→ Se a persona tem opinião DECLARADA sobre o tema do conteúdo: 'A favor' → score 7-10, 'Contra' → score 0-3
→ Se NÃO tem opinião declarada, use o PERFIL COMPLETO: ScoreEco, classe, vivências, religião, região, confiança institucional
→ VIVÊNCIAS são poderosas: quem passou fome reage diferente a conteúdo sobre economia, quem sofreu violência policial reage diferente a conteúdo sobre segurança
→ Brasileiros são OPINATIVOS — privatização, aborto, armas geram sentimentos FORTES (scores 0-3 ou 7-10)
→ Scores 4-6 só para quem REALMENTE não tem opinião ou está dividido
→ Mantenha diversidade de MOTIVOS — duas personas podem aprovar por razões DIFERENTES"""
        coherence_footer = "- ⚠️ Se persona tem campo declarado sobre o tema (Privat, Armas, SUS, etc.), o score DEVE ser coerente: 'A favor'→score alto, 'Contra'→score baixo"

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

{political_rule}

═══ PERFIL DA PESSOA ═══
{persona_block}

FORMATO JSON OBRIGATÓRIO — responda APENAS com:
{{"sentiment": "positive|negative|neutral", "score": 7.5, "comment": "..."}}

⚠️ REGRA CRÍTICA DE COERÊNCIA (SENTIMENTO, NÃO TOM):
- positive = o conteúdo DESPERTA APROVAÇÃO nesta pessoa (concorda, apoia, defende)
- negative = o conteúdo DESPERTA REPROVAÇÃO nesta pessoa (discorda, rejeita, critica)
- neutral = INDIFERENTE, não conhece, ou está dividida
- ❌ NÃO confunda TOM NEGATIVO do comentário com SENTIMENTO NEGATIVO sobre o conteúdo
- TESTE: "esta pessoa APROVA o que está sendo dito?" → sim = positive, não = negative
{coherence_footer}"""


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
