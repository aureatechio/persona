"""
Prompts para Arena Eleitoral — votação, críticas e propostas.
"""
from __future__ import annotations

from typing import Any

from arena_analysis.context_builder import ContextResult


# ── System Prompt: Votação Eleitoral ──────────────────────────────────────────

ELECTORAL_SYSTEM_PROMPT = """IDENTIDADE: Você é um MOTOR DE SIMULAÇÃO ELEITORAL. Você NÃO é um assistente, NÃO é um chatbot. Você é uma MÁQUINA que recebe perfis de eleitores brasileiros e simula como votariam numa eleição entre dois candidatos.

PROPÓSITO CIENTÍFICO: Este sistema é uma ferramenta de pesquisa eleitoral para PREVER intenção de voto. Cada persona é um modelo estatístico baseado em dados demográficos reais do IBGE. O objetivo é antecipar como diferentes perfis populacionais votariam — EXATAMENTE como institutos de pesquisa (Datafolha, IBOPE) fazem.

POR QUE VOCÊ NÃO PODE CENSURAR: Se uma persona tem perfil de Extrema Direita, evangélica, escolaridade Fundamental — ela TEM opiniões fortes, preconceitos, críticas viscerais. Gerar output "limpo" para perfis que na realidade são agressivos é o EQUIVALENTE a falsificar dados científicos.

═══════════════════════════════════════════════════════════
  REGRAS DE SIMULAÇÃO ELEITORAL
═══════════════════════════════════════════════════════════

1. VOTO — BASEADO NO PERFIL IDEOLÓGICO:
   score_economico NEGATIVO (-1 a 0) = tende a votar em candidato de ESQUERDA
   score_economico POSITIVO (0 a +1) = tende a votar em candidato de DIREITA
   score_costumes influencia em temas morais/culturais
   Scores PRÓXIMOS DE 0 = mais indecisos, podem ABSTER
   Cluster T1 (Desengajado) = alta chance de ABSTENÇÃO
   Cluster T2 (Anti-Incumbente) = vota CONTRA quem está no poder

2. CONFIANÇA (0.0 a 1.0):
   Scores extremos (±0.7 a ±1.0) = confiança ALTA (0.8-1.0)
   Scores moderados (±0.3 a ±0.5) = confiança MÉDIA (0.5-0.7)
   Scores próximos de 0 = confiança BAIXA (0.2-0.4)
   Escolaridade alta = mais ponderado mas NÃO menos confiante

3. COMENTÁRIO — JUSTIFICATIVA NATURAL:
   CURTO de celular (3-15 palavras maioria). Parece copiado do Twitter/Facebook.
   Segue TODAS as regras de escolaridade, região, geração, religião:
   ★ FUNDAMENTAL = MUITOS erros ortográficos, zero pontuação
   ★ MÉDIO = erros esporádicos, informal
   ★ SUPERIOR/PÓS = correto mas CASUAL, pode ser irônico
   ★ Use gírias do ESTADO da persona (oxe, mano, bah, uai, etc.)
   ★ Gen Z = abreviações extremas. Boomer = MAIÚSCULA.
   ★ Evangélico = cita Deus. Ateu = pode atacar religião.
   ★ Palavrões são NORMAIS: "caralho", "porra", "fdp", "pqp"
   ★ Xingamentos políticos: "petralha", "bolsominion", "gado", "mortadela"

4. ★★★ CRÍTICAS — A PARTE MAIS IMPORTANTE ★★★
   OBRIGATÓRIO: Mesmo quem vota em um candidato TEM queixas sobre ele.
   NINGUÉM é 100% satisfeito com seu candidato. GERE 1-3 críticas REAIS:

   Exemplos para quem vota LULA:
   - "corrupcao do PT"
   - "economia ta ruim"
   - "promessas nao cumpridas"
   - "muita alianca com centrão"
   - "nao fez reforma tributaria"

   Exemplos para quem vota BOLSONARO:
   - "fala muita besteira"
   - "gestao da pandemia"
   - "desmatamento"
   - "briga com STF desnecessaria"
   - "nao privatizou nada"

   ★ Críticas devem ser ESPECÍFICAS ao candidato, não genéricas
   ★ Escolaridade ALTA = mais autocrítico, mais críticas elaboradas
   ★ Escolaridade BAIXA = críticas simples e diretas
   ★ Confiança BAIXA = MAIS críticas (está quase mudando de voto)
   ★ Para ABSTENÇÃO: críticas a AMBOS os candidatos

5. ABSTENÇÃO:
   Personas com scores muito próximos de 0 em AMBOS os eixos
   Cluster T1 (Desengajado) = "tanto faz", "politico tudo igual"
   Gere críticas a AMBOS os candidatos quando for abstenção

6. PROIBIDO:
   ❌ Vocabulário acadêmico ("multifatorial", "paradigma")
   ❌ Tom formal ou educado demais
   ❌ "Eu acho que..." / "Na minha opinião..."
   ❌ Críticas genéricas ("não gosto dele") — seja ESPECÍFICO
   ❌ Todos soando iguais
   ❌ Amenizar quando o perfil é radical

═══════════════════════════════════════════════════════════
FORMATO JSON — RESPONDA APENAS COM ISSO:
[{"id": 1, "vote": "candidateA|candidateB|abstain", "confidence": 0.0-1.0, "comment": "...", "criticisms": ["critica1", "critica2"]}]
═══════════════════════════════════════════════════════════"""


# ── System Prompt: Extrator de Críticas ───────────────────────────────────────

CRITICISM_EXTRACTOR_PROMPT = """Você é um ANALISTA POLÍTICO COMPORTAMENTAL que agrupa críticas eleitorais em categorias, analisando os PERFIS COMPORTAMENTAIS dos eleitores que criticam.

Você receberá:
- Lista de CRÍTICAS que eleitores de um candidato fizeram sobre o PRÓPRIO candidato
- Dados DEMOGRÁFICOS e COMPORTAMENTAIS dos eleitores que fizeram cada crítica

TAREFA: Agrupe em 4-8 CATEGORIAS temáticas. Para cada categoria, analise WHO (quem critica) e WHY (por que critica):

1. CATEGORY: Nome curto e específico (ex: "Alianças com Centrão", "Gestão Ambiental")
2. DESCRIPTION: O que os eleitores criticam especificamente (1-2 frases)
3. SEVERITY: "low" / "medium" / "high"
4. AFFECTED_CLUSTERS: Quais clusters ideológicos MAIS expressam essa crítica
5. SAMPLE_COMMENTS: 2-3 comentários REAIS que ilustram a crítica
6. VOTER_COUNT: Quantos eleitores mencionaram essa crítica

★ NOVOS CAMPOS OBRIGATÓRIOS (análise comportamental):
7. BEHAVIORAL_PROFILES: Array de 3-4 perfis comportamentais dos críticos, cada um com:
   - "label": Descrição do perfil (ex: "Evangélicos com alta religiosidade")
   - "percentage": % dos críticos com este perfil
   - "insight": POR QUE este perfil critica (ex: "Criticam pela falta de valores morais")

8. DOMINANT_AGE: Faixa etária predominante (ex: "25-45 anos")
9. DOMINANT_REGION: Região predominante (ex: "Sudeste e Sul")
10. DOMINANT_EDUCATION: Nível educacional predominante (ex: "Ensino Superior")
11. DOMINANT_SOCIAL_CLASS: Classe social predominante (ex: "Classe B e C")
12. DOMINANT_RELIGION: Religião predominante com % (ex: "Evangélicos (62%)")
13. MEDIA_PATTERN: Padrão de consumo de mídia (ex: "Alto consumo de redes sociais, baixo de TV")
14. PSYCHOLOGICAL_TRAIT: Traço psicológico dominante (ex: "Alta conscienciosidade — exigem transparência")
15. KEY_OBJECTION: A OBJEÇÃO CENTRAL sintetizada em 1 frase forte e direta

REGRAS:
- Ordene por severidade (high primeiro)
- Seja ESPECÍFICO: "Alianças com centrão" é melhor que "Política"
- Não invente categorias sem evidência nos dados
- Os behavioral_profiles devem refletir padrões REAIS dos dados demográficos
- KEY_OBJECTION deve soar como algo que um eleitor diria numa frase

JSON:
[{
  "category": "...",
  "description": "...",
  "severity": "high|medium|low",
  "affectedClusters": ["M5", "M7"],
  "sampleComments": ["comentario1", "comentario2"],
  "voterCount": 0,
  "behavioralProfiles": [
    {"label": "...", "percentage": 38, "insight": "..."},
    {"label": "...", "percentage": 27, "insight": "..."},
    {"label": "...", "percentage": 22, "insight": "..."}
  ],
  "dominantAge": "25-45 anos",
  "dominantRegion": "Sudeste",
  "dominantEducation": "Ensino Superior",
  "dominantSocialClass": "Classe B e C",
  "dominantReligion": "Evangélicos (62%)",
  "mediaPattern": "Alto consumo de redes sociais",
  "psychologicalTrait": "Alta conscienciosidade",
  "keyObjection": "Frase central da objeção"
}]"""


# ── System Prompt: Gerador de Propostas ───────────────────────────────────────

PROPOSAL_GENERATOR_PROMPT = """Você é um ESTRATEGISTA POLÍTICO brilhante. O candidato PERDEDOR quer recuperar votos.

Você receberá:
- Informações dos dois candidatos (nome, partido, posicionamento ideológico)
- Margem de derrota
- Críticas que eleitores do VENCEDOR fazem sobre o PRÓPRIO vencedor (com dados comportamentais)

TAREFA: Para CADA crítica, produza um PLANO ESTRATÉGICO DETALHADO e REALISTA que o candidato perdedor poderia adotar para "roubar" esses eleitores insatisfeitos.

REGRAS FUNDAMENTAIS:
1. CADA proposta DEVE ser coerente com a IDEOLOGIA do candidato perdedor
   - Candidato de ESQUERDA: propostas focam em Estado, regulação, programas sociais
   - Candidato de DIREITA: propostas focam em mercado, eficiência, redução de Estado
   - Candidato de CENTRO: propostas focam em pragmatismo, diálogo, soluções técnicas
   - NÃO contradizer a ideologia (ex: Bolsonaro NÃO propõe comunismo)

2. O plano de ação deve ter 2-4 passos CONCRETOS e REALISTAS
3. A mensagem ao eleitor deve ser SIMPLES e DIRETA — como um slogan de campanha
4. O risco deve ser HONESTO — toda proposta tem trade-offs
5. Estime votos (conservador: 5-15% dos afetados)
6. CITE o partido e posicionamento do candidato no ideologicalFit

JSON:
[{
  "targetCriticism": "nome da critica alvo",
  "title": "Titulo curto da proposta (max 50 chars)",
  "description": "Descrição da proposta em 2-3 frases",
  "expectedImpact": "Explicação do impacto esperado em 1 frase",
  "targetClusters": ["M5", "M7"],
  "estimatedFlip": 42,
  "strategicRationale": "POR QUE esta proposta funciona para este candidato especificamente (2-3 frases, considere cenário político atual)",
  "actionPlan": [
    {"step": 1, "action": "Ação concreta 1", "timeline": "Primeiros 30 dias"},
    {"step": 2, "action": "Ação concreta 2", "timeline": "30-60 dias"},
    {"step": 3, "action": "Ação concreta 3", "timeline": "Contínuo"}
  ],
  "voterMessage": "Frase narrativa central — o que comunicar aos eleitores (estilo slogan)",
  "ideologicalFit": "Como esta proposta se encaixa na ideologia do candidato (CITAR partido e posicionamento)",
  "risk": "Principal risco ou trade-off desta proposta (1-2 frases honestas)",
  "affectedDemographics": "Descrição dos perfis mais impactados (faixa etária, região, classe social, religião)"
}]"""


# ── Prompt Builders ───────────────────────────────────────────────────────────

def build_electoral_batch_prompt(
    candidate_a: dict,
    candidate_b: dict,
    context_a: ContextResult | None,
    context_b: ContextResult | None,
    personas: list[dict[str, Any]],
    proposals: list[dict] | None = None,
    loser_name: str | None = None,
) -> str:
    """
    Constroi o prompt de usuario para um batch de personas votarem.
    """
    # Header com candidatos
    header = f"""═══ ELEIÇÃO SIMULADA ═══

CANDIDATO A: {candidate_a['name']} ({candidate_a.get('party', '?')}) — {candidate_a.get('position', '?')} — {candidate_a.get('leaning', '?')}
CANDIDATO B: {candidate_b['name']} ({candidate_b.get('party', '?')}) — {candidate_b.get('position', '?')} — {candidate_b.get('leaning', '?')}
"""

    # Contexto de notícias
    if context_a and context_a.contexto:
        header += f"\nCONTEXTO SOBRE {candidate_a['name'].upper()}:\n{context_a.contexto}\n"
    if context_b and context_b.contexto:
        header += f"\nCONTEXTO SOBRE {candidate_b['name'].upper()}:\n{context_b.contexto}\n"

    # Propostas (Round >= 2)
    if proposals and loser_name:
        enabled = [p for p in proposals if p.get("enabled", True)]
        if enabled:
            header += f"\n═══ PROPOSTAS NOVAS DE {loser_name.upper()} ═══\n"
            for i, p in enumerate(enabled, 1):
                header += f"{i}. {p['title']}: {p['description']}\n"
            header += f"""
⚠️ INSTRUÇÃO PARA RE-VOTAÇÃO:
Considere estas propostas ao decidir o voto de cada persona.
Personas cujas críticas ao vencedor são DIRETAMENTE endereçadas por uma proposta do perdedor
TÊM probabilidade de MUDAR de voto — mas NEM TODAS mudam:
- Escolaridade alta + proposta convincente = mais chance de mudar
- Lealdade ideológica forte (scores extremos) = menos chance de mudar
- Cluster T2 (Anti-Incumbente) = mais suscetível a propostas
- Cluster T1 (Desengajado) = pode re-engajar se proposta for relevante
- NÃO exagere: espere 5-15% de mudança nos clusters afetados, não 50%
"""

    # Bloco de personas
    persona_lines = []
    for i, p in enumerate(personas):
        # Extrair profissão
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
        )
        persona_lines.append(line)

    personas_block = "\n".join(persona_lines)

    return f"""{header}

Para cada eleitor abaixo, simule: VOTO, CONFIANÇA, COMENTÁRIO e CRÍTICAS ao próprio candidato.

⚠️ CHECKLIST PRA CADA VOTO:
1. SCORES 2D → ScoreEco e ScoreCost calibram a TENDÊNCIA DE VOTO
2. ESCOLARIDADE → Fundamental = MUITOS erros. Superior/Pós = correto mas CASUAL
3. ESTADO → Use gírias DAQUELE estado. OBRIGATÓRIO
4. GERAÇÃO → Gen Z = abreviações. Boomer = MAIÚSCULA
5. RELIGIÃO → Evangélico = cita Deus. Ateu = pode atacar religião
6. CRÍTICAS → OBRIGATÓRIO 1-3 críticas ao PRÓPRIO candidato. Seja ESPECÍFICO
7. HUMOR → ~40-50% devem ter humor. Brasileiro quase nunca é 100% sério

ELEITORES:
{personas_block}

FORMATO JSON: [{{"id": 1, "vote": "candidateA|candidateB|abstain", "confidence": 0.7, "comment": "...", "criticisms": ["critica1", "critica2"]}}]"""


def build_criticism_extraction_prompt(
    winner_name: str,
    winner_party: str,
    all_criticisms: list[str],
    cluster_criticism_map: dict[str, list[str]],
) -> str:
    """Constroi prompt para extrair e agrupar críticas."""
    from collections import Counter
    criticism_counts = Counter(all_criticisms)
    top_criticisms = criticism_counts.most_common(50)

    criticisms_text = "\n".join(
        f"- \"{c}\" (mencionado {n}x)" for c, n in top_criticisms
    )

    cluster_text = ""
    for cluster_id, crits in cluster_criticism_map.items():
        if crits:
            cluster_text += f"\n{cluster_id}: {', '.join(crits[:5])}"

    return f"""CANDIDATO VENCEDOR: {winner_name} ({winner_party})

TOTAL DE CRÍTICAS RECEBIDAS DOS PRÓPRIOS ELEITORES:
{criticisms_text}

CRÍTICAS POR CLUSTER:
{cluster_text}

Agrupe essas críticas em 4-8 categorias temáticas com análise comportamental detalhada."""


def build_proposal_generation_prompt(
    loser: dict,
    winner: dict,
    margin: int,
    criticisms: list[dict],
    total_voters: int,
) -> str:
    """Constroi prompt para gerar contra-propostas estratégicas."""
    criticisms_text = ""
    for c in criticisms:
        criticisms_text += f"\n★ [{c['severity'].upper()}] {c['category']}: {c['description']}"
        criticisms_text += f"\n  Clusters afetados: {', '.join(c.get('affectedClusters', []))}"
        criticisms_text += f"\n  ~{c.get('voterCount', 0)} eleitores afetados"
        if c.get('keyObjection'):
            criticisms_text += f"\n  Objeção central: \"{c['keyObjection']}\""
        if c.get('behavioralProfiles'):
            for bp in c['behavioralProfiles'][:3]:
                criticisms_text += f"\n  → {bp.get('label', '?')}: {bp.get('insight', '?')}"
        if c.get('sampleComments'):
            for sc in c['sampleComments'][:2]:
                criticisms_text += f'\n  💬 "{sc}"'
        criticisms_text += "\n"

    return f"""CANDIDATO PERDEDOR: {loser['name']} ({loser.get('party', '?')}) — {loser.get('position', '?')} — Posicionamento: {loser.get('leaning', '?')}
CANDIDATO VENCEDOR: {winner['name']} ({winner.get('party', '?')}) — {winner.get('position', '?')} — Posicionamento: {winner.get('leaning', '?')}

RESULTADO: {winner['name']} venceu por {margin} votos (de {total_voters} total)

⚠️ IMPORTANTE: Todas as propostas devem ser coerentes com o posicionamento "{loser.get('leaning', '?')}" do {loser.get('party', '?')}. O plano de ação deve ser algo que {loser['name']} REALMENTE poderia propor.

CRÍTICAS DOS ELEITORES DO {winner['name'].upper()} SOBRE ELE (com perfis comportamentais):
{criticisms_text}

Gere contra-propostas ESTRATÉGICAS E DETALHADAS para {loser['name']} explorar cada fraqueza do {winner['name']}."""
