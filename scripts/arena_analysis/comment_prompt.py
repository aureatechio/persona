"""
SYSTEM_PROMPT para geracao de comentarios na Arena.
Portado de src/lib/simulation-prompt.ts com adaptacoes para o pipeline Python.
"""
from __future__ import annotations

from typing import Any

from arena_analysis.context_builder import ContextResult
from arena_analysis.persona_extras import build_persona_extras


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
   Neutral válido (~5-15%): desinteresse, dividido, não conhece. NUNCA "sem opinião formada".

6. CLASSE: D/E=visceral,fome,gás. C=salário,transporte. B=impostos,articulado. A=superioridade,"vou embora daqui".

7. RELIGIÃO: Evangélico=cita Deus,julga. Católico="Nossa Senhora". Ateu=pode atacar religião.

8. IDEOLOGIA 2D: ScoreEco(-1=esquerda,+1=direita). ScoreCost(-1=progressista,+1=conservador). Perto de 0=dividido. Extremo=forte. Escolaridade alta+score moderado=pode criticar próprio lado.

9. FIGURAS POLÍTICAS (REGRA CRÍTICA):
   Lula: eco<-0.3→apoia, >0.3→ataca. Bolsonaro: eco>0.2 E cost>0.5→apoia.
   DADOS ELEITORAIS: USE os campos Voto22, AprovLula, AvalBolso, Voto26 do perfil. Eles são DETERMINANTES.
   ⚠️ ADVERSARIAL FRAMING: Se a pergunta CRITICA uma figura (ex: "X é corrupto/ladrão/criminoso/preso"):
   - Quem VOTOU em X ou APROVA X → score 0-3 (rejeição FORTE — jamais concordariam)
   - Quem se OPÕE a X → score 7-10 (concordância — já acreditam nisso)
   - Neutros/sem voto → score 3-6 (divididos)
   Exemplo: "Bolsonaro é corrupto?" → Voto22:Bolsonaro OU AvalBolso:Bom → score 0-2. Voto22:Lula → score 8-10.
   Exemplo: "Lula é ladrão?" → Voto22:Lula OU AprovLula:Aprova → score 0-2. Voto22:Bolsonaro → score 8-10.
   INVERSO para elogios: "Bolsonaro é o melhor presidente?" → Voto22:Bolsonaro → score 8-10, Voto22:Lula → score 0-2.

10. PALAVRÕES constantes: "caralho","porra","pqp","fdp","merda". Políticos: "petralha","bolsominion","gado".

11. GÊNERO: Homem periferia=vocativo regional. Mulher jovem="amiga","socorro". Velho conservador="na minha época". Mãe C/D="como mãe eu digo".

12. RISADAS: "kkkk"=normal. "kkkkkkkkk"=muito. "rsrsrs"=velho. "ksksksk"=Gen Z. "HAHAHA"=Boomer.

13. HUMOR: ~40-50% devem ter humor. Brasileiro mistura opinião com piada, xinga rindo. Ironia, deboche, autodepreciação nacional.

14. SCORE DE IMPACTO (0-10): 0-1=rejeição total, 3-5=indiferença, 5-7=aceitou, 7-9=gostou, 9-10=viral. Coerência: positive≥6.0, negative≤4.0, neutral=3.5-6.5.
   ⚠️ POLÍTICO: Se persona é eleitor/apoiador de X e pergunta CRITICA X → SEMPRE negative + score 0-2. Se pergunta ELOGIA X → SEMPRE positive + score 8-10. Voto22 e AprovLula/AvalBolso são DETERMINANTES.

PROIBIDO: vocabulário acadêmico | todos soando igual | amenizar perfil radical | escrita correta p/ Fundamental | "Eu acho que..." | tom formal | "sem opinião formada"

⚠️ "mano" é de SP/DF. Cada estado tem vocativos PRÓPRIOS. Max 20% com mesmo vocativo. Muitos não precisam de vocativo.
Cada comentário deve parecer COPIADO de post real. Se parece IA → REESCREVA.

Responda APENAS com JSON válido."""


def build_batch_prompt(
    question: str,
    context: ContextResult | None,
    personas: list[dict[str, Any]],
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
        cluster_id = p.get("cluster_id", "?")
        cluster_name = p.get("nome_grupo", "?")

        extras = build_persona_extras(p)
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
            f'Religião: {p.get("macro_religion", "?")} | '
            f'Cluster: {cluster_id}({cluster_name}) | '
            f'ScoreEco: {score_eco:.3f} | ScoreCost: {score_cost:.3f}'
            + (f' | {extras}' if extras else '')
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
8. NEUTRAL É VÁLIDO (~5-15%): persona que NÃO CONHECE o assunto, está DIVIDIDA, ou NÃO SE IMPORTA → neutral. Mas NUNCA "sem opinião formada" (genérico). Neutral tem que soar natural.

PERFIS:
{personas_block}

FORMATO JSON OBRIGATÓRIO — responda com um objeto JSON contendo "results":
{{"results": [{{"id": 1, "sentiment": "positive|negative|neutral", "score": 7.5, "comment": "..."}}, ...]}}

⚠️ REGRA CRÍTICA DE COERÊNCIA (POSIÇÃO FINAL, NÃO TOM):
- positive = a CONCLUSÃO do comentário CONCORDA com a pergunta
- negative = a CONCLUSÃO do comentário DISCORDA da pergunta
- ❌ NÃO confunda TOM NEGATIVO com POSIÇÃO NEGATIVA
- "deveria sim mas nunca vai preso nesse pais de merda" = POSITIVE (concorda, tom cínico)
- "claro porra tem q prender esse ladrão" = POSITIVE (concorda, tom raivoso)
- "nao acho que deveria nao" = NEGATIVE (discorda)
- TESTE: "essa pessoa concorda com [pergunta]?" → sim = positive, não = negative"""


def build_single_prompt(
    question: str,
    context: ContextResult | None,
    persona: dict[str, Any],
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
