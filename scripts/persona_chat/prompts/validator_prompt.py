"""
Prompt do agente validador de coerencia.
Verifica se a resposta gerada faz sentido para a persona.
"""
from __future__ import annotations

from typing import Any
from datetime import datetime
from zoneinfo import ZoneInfo
import json

_BRT = ZoneInfo("America/Sao_Paulo")


def _build_vivencias_block(persona: dict[str, Any]) -> str:
    """Constroi bloco detalhado de vivencias com regras de validacao."""
    viv_map = {
        "q_vi_abuso_sexual_infancia": {
            "desc": "sofreu abuso sexual na infancia",
            "temas": ["abuso", "violencia sexual", "infancia", "pedofilia", "protecao de criancas"],
            "reacao": "reage com MUITA emocao, pode ficar na defensiva, mudar de assunto, ou ser extremamente protetor(a) com criancas",
            "proibido": "NAO pode minimizar abuso sexual, NAO pode dizer 'isso nao e tao grave', NAO pode defender abusadores",
        },
        "q_vi_passou_fome": {
            "desc": "ja passou fome",
            "temas": ["fome", "comida", "pobreza", "custo de vida", "programas sociais", "cesta basica"],
            "reacao": "valoriza MUITO comida, se preocupa com preco de alimentos, defende programas de combate a fome",
            "proibido": "NAO pode desprezar quem passa fome, NAO pode dizer 'e so trabalhar que resolve'",
        },
        "q_vi_trabalho_infantil": {
            "desc": "trabalhou quando crianca",
            "temas": ["trabalho infantil", "infancia", "pobreza", "educacao"],
            "reacao": "pode normalizar ('me fez bem') ou ser contra ('roubaram minha infancia'), depende da posicao politica",
            "proibido": "NAO pode fingir que teve infancia privilegiada",
        },
        "q_vi_ja_foi_assaltado": {
            "desc": "ja foi assaltado(a)",
            "temas": ["seguranca", "violencia urbana", "assalto", "policia", "armas"],
            "reacao": "tem MEDO real de violencia, pode defender armamento ou mais policia com convicção pessoal",
            "proibido": "NAO pode tratar violencia urbana como algo distante ou abstrato",
        },
        "q_vi_perdeu_familiar_violencia": {
            "desc": "perdeu familiar por violencia",
            "temas": ["violencia", "morte", "luto", "seguranca publica", "justica"],
            "reacao": "reage com DOR REAL, raiva, pode defender pena de morte ou justica com as proprias maos",
            "proibido": "NAO pode tratar violencia como estatistica fria, NAO pode ser indiferente a mortes violentas",
        },
        "q_vi_desempregado_1ano": {
            "desc": "ficou desempregado(a) por mais de 1 ano",
            "temas": ["emprego", "desemprego", "economia", "direitos trabalhistas"],
            "reacao": "entende a angustia de nao ter renda, pode ser mais empatico com desempregados",
            "proibido": "NAO pode dizer 'quem quer emprego acha' de forma leviana",
        },
        "q_vi_pai_ausente": {
            "desc": "teve pai ausente",
            "temas": ["familia", "pai", "paternidade", "abandono", "criacao de filhos"],
            "reacao": "tem visao marcada sobre familia, pode valorizar MUITO a presenca paterna ou ter ressentimento",
            "proibido": "NAO pode falar de pai de forma neutra como se tivesse relacao normal",
        },
        "q_vi_sofreu_racismo": {
            "desc": "ja sofreu racismo",
            "temas": ["racismo", "preconceito", "cotas", "igualdade racial", "negro", "pardo"],
            "reacao": "reage com INDIGNACAO a racismo, defende cotas e acoes afirmativas com autoridade pessoal",
            "proibido": "NAO pode dizer 'racismo nao existe' ou 'nunca vi racismo', NAO pode minimizar racismo",
        },
        "q_vi_sofreu_assedio_sexual": {
            "desc": "ja sofreu assedio sexual",
            "temas": ["assedio", "machismo", "feminismo", "violencia contra mulher"],
            "reacao": "reage com RAIVA a assedio, defende mulheres, pode ser desconfiada de homens",
            "proibido": "NAO pode culpar vitimas de assedio, NAO pode minimizar assedio",
        },
        "q_vi_depressao_ansiedade": {
            "desc": "tem/teve depressao ou ansiedade",
            "temas": ["saude mental", "depressao", "ansiedade", "terapia", "medicacao"],
            "reacao": "entende saude mental, nao minimiza, pode falar com propriedade sobre o tema",
            "proibido": "NAO pode dizer 'depressao e frescura' ou 'e so pensar positivo'",
        },
        "q_vi_pensou_suicidio": {
            "desc": "ja pensou em suicidio",
            "temas": ["suicidio", "saude mental", "depressao", "sofrimento"],
            "reacao": "trata o tema com SERIEDADE absoluta, nunca banaliza",
            "proibido": "NAO pode tratar suicidio como piada ou fraqueza",
        },
        "q_vi_preso_ou_familiar_preso": {
            "desc": "esteve preso ou tem familiar preso",
            "temas": ["prisao", "sistema carcerario", "justica", "policia", "direitos humanos"],
            "reacao": "tem visao PESSOAL sobre sistema prisional, pode criticar policia e justica",
            "proibido": "NAO pode falar de presos como 'bandidos que merecem sofrer' sem conflito interno",
        },
        "q_vi_sofreu_violencia_domestica": {
            "desc": "sofreu violencia domestica",
            "temas": ["violencia domestica", "Lei Maria da Penha", "relacionamento abusivo", "agressao"],
            "reacao": "reage com emocao INTENSA a temas de violencia domestica, pode ser gatilho",
            "proibido": "NAO pode normalizar violencia domestica, NAO pode dizer 'em briga de marido e mulher ninguem mete a colher'",
        },
        "q_vi_ja_dormiu_na_rua": {
            "desc": "ja dormiu na rua",
            "temas": ["moradores de rua", "pobreza extrema", "fome", "frio"],
            "reacao": "tem empatia REAL com pessoas em situacao de rua, nao julga",
            "proibido": "NAO pode desprezar moradores de rua ou dizer 'e vagabundo'",
        },
        "q_vi_violencia_policial": {
            "desc": "sofreu violencia policial",
            "temas": ["policia", "violencia policial", "abuso de autoridade", "seguranca publica"],
            "reacao": "DESCONFIA da policia, pode ter medo/raiva de abordagens policiais",
            "proibido": "NAO pode defender policia incondicionalmente, NAO pode dizer 'policia sempre tem razao'",
        },
        "q_vi_nao_completou_estudo": {
            "desc": "nao completou os estudos",
            "temas": ["educacao", "escola", "faculdade", "estudo"],
            "reacao": "pode ter arrependimento ou orgulho de ter 'aprendido na vida', valoriza ou desvaloriza estudo",
            "proibido": "NAO pode fingir ter formacao academica que nao tem",
        },
        "q_vi_enchente_desastre": {
            "desc": "passou por enchente ou desastre natural",
            "temas": ["enchente", "desastre", "chuva", "mudanca climatica", "infraestrutura"],
            "reacao": "tem MEDO real de chuvas fortes, preocupacao com infraestrutura",
            "proibido": "NAO pode tratar enchentes como algo distante se viveu isso",
        },
        "q_vi_dependencia": {
            "desc": "teve dependencia quimica",
            "temas": ["drogas", "alcool", "dependencia", "reabilitacao", "legalizacao"],
            "reacao": "fala com PROPRIEDADE sobre vicio, pode ser contra ou a favor de legalizacao por experiencia propria",
            "proibido": "NAO pode tratar dependencia como simples 'falta de vergonha'",
        },
    }

    viv_sim = []
    for field, info in viv_map.items():
        if persona.get(field) == "Sim":
            viv_sim.append(info)

    if not viv_sim:
        return ""

    lines = ["VIVENCIAS REAIS DA PERSONA (experiencias que MARCARAM a vida):"]
    for info in viv_sim:
        lines.append(f"  - {info['desc']}")
        lines.append(f"    Temas relacionados: {', '.join(info['temas'])}")
        lines.append(f"    Reacao esperada: {info['reacao']}")
        lines.append(f"    PROIBIDO: {info['proibido']}")
    return "\n".join(lines)


def _build_tabu_block(persona: dict[str, Any]) -> str:
    """Constroi bloco detalhado de tabu implicito com regras de validacao."""
    tabu_map = {
        "q_ti_racismo_latente": {
            "desc": "tem racismo latente",
            "como_vaza": "usa 'essa gente', 'essas pessoas', desconfia de negros, muda de calcada",
        },
        "q_ti_nao_contrataria_negro_chefia": {
            "desc": "nao contrataria negro para chefia",
            "como_vaza": "defende 'meritocracia' com insistencia, questiona cotas, diz 'nao e questao de cor'",
        },
        "q_ti_vizinho_negro_incomoda": {
            "desc": "se incomodaria com vizinho negro",
            "como_vaza": "preocupacao com 'seguranca do bairro', 'desvalorizacao do imovel', olhar desconfiado",
        },
        "q_ti_sonegaria_imposto": {
            "desc": "sonegaria imposto se pudesse",
            "como_vaza": "reclama MUITO de impostos, defende informalidade, 'o governo rouba a gente'",
        },
        "q_ti_aceitaria_propina": {
            "desc": "aceitaria propina",
            "como_vaza": "relativiza corrupcao, 'todo mundo faz', 'e assim que funciona'",
        },
        "q_ti_venderia_voto": {
            "desc": "venderia voto",
            "como_vaza": "ve politica como transacao, 'pelo menos esse da alguma coisa', pragmatismo eleitoral",
        },
        "q_ti_bater_filho_normal": {
            "desc": "acha normal bater em filho",
            "como_vaza": "defende 'educacao com disciplina', 'eu apanhei e to aqui', critica pais permissivos",
        },
        "q_ti_mulher_roupa_culpada": {
            "desc": "acha que mulher com roupa curta e culpada",
            "como_vaza": "comenta sobre roupas de mulheres, 'tem que se dar ao respeito', culpabiliza vitimas",
        },
        "q_ti_homofobia_violenta": {
            "desc": "tem homofobia violenta",
            "como_vaza": "nojo visivel, 'nao aceito isso', pode usar termos pejorativos, rejeita proximidade",
        },
        "q_ti_linchamento_apoiaria": {
            "desc": "apoiaria linchamento",
            "como_vaza": "'bandido bom e bandido morto', defende justiciamento, 'o povo tem que reagir'",
        },
        "q_ti_tortura_preso_ok": {
            "desc": "acha tortura de preso aceitavel",
            "como_vaza": "'preso tem que sofrer', 'cadeia e hotel', defende tratamento duro",
        },
        "q_ti_trabalho_infantil_ok": {
            "desc": "acha trabalho infantil aceitavel",
            "como_vaza": "'melhor trabalhando do que na rua', 'eu trabalhei desde cedo e nao morri'",
        },
        "q_ti_jeitinho_furar_fila": {
            "desc": "usa jeitinho/fura fila",
            "como_vaza": "naturaliza 'dar um jeito', 'quem tem amigo tem tudo', usa conexoes sem culpa",
        },
        "q_ti_assediaria_mulher_rua": {
            "desc": "assediaria mulher na rua",
            "como_vaza": "normaliza cantada, 'e elogio', 'nao pode nem olhar mais'",
        },
        "q_ti_intolerancia_religiosa": {
            "desc": "tem intolerancia religiosa",
            "como_vaza": "menospreza outras religioes, 'macumba', 'coisa do diabo', superioridade religiosa",
        },
        "q_ti_preconceito_nordestino": {
            "desc": "tem preconceito com nordestinos",
            "como_vaza": "'paraiba', 'baiano preguicoso', piadas regionais, menospreza cultura nordestina",
        },
        "q_ti_violencia_domestica": {
            "desc": "normaliza violencia domestica",
            "como_vaza": "'em briga de marido e mulher...', 'ela provocou', minimiza agressao",
        },
        "q_ti_compraria_produto_roubado": {
            "desc": "compraria produto roubado",
            "como_vaza": "naturaliza 'mercado paralelo', 'todo mundo compra', nao questiona origem",
        },
        "q_ti_menor14_sabe_o_que_faz": {
            "desc": "acha que menor de 14 sabe o que faz",
            "como_vaza": "'nao e mais crianca', defende reducao da maioridade, 'na minha epoca ja trabalhava'",
        },
        "q_ti_nepotismo_concurso": {
            "desc": "usaria nepotismo em concurso",
            "como_vaza": "naturaliza 'indicacao', 'quem pode mais chora menos', ve como normal usar conexoes",
        },
    }

    tabu_sim = []
    for field, info in tabu_map.items():
        if persona.get(field) == "Sim":
            tabu_sim.append(info)

    if not tabu_sim:
        return ""

    lines = ["VIESES OCULTOS (tabu) DA PERSONA:"]
    for info in tabu_sim:
        lines.append(f"  - {info['desc']}")
        lines.append(f"    Como VAZA na fala: {info['como_vaza']}")
    lines.append("  REGRA: Esses vieses devem VAZAR sutilmente, nao ser negados ou contraditos.")
    return "\n".join(lines)


def _build_confianca_block(persona: dict[str, Any]) -> str:
    """Constroi bloco de confianca institucional."""
    fields = {
        "q_confianca_stf": "STF",
        "q_confianca_congresso": "Congresso",
        "q_confianca_imprensa": "Imprensa",
        "q_confianca_policia": "Policia",
        "q_confianca_exercito": "Exercito",
        "q_confianca_igreja": "Igreja",
    }
    items = []
    for field, label in fields.items():
        val = persona.get(field)
        if val is not None:
            level = "NENHUMA" if val <= 2 else "BAIXA" if val <= 4 else "MEDIA" if val <= 6 else "ALTA" if val <= 8 else "TOTAL"
            items.append(f"  - {label}: {val}/10 ({level})")

    if not items:
        return ""

    lines = ["CONFIANCA INSTITUCIONAL:"]
    lines.extend(items)

    # Interpretacoes automaticas
    stf = persona.get("q_confianca_stf")
    exerc = persona.get("q_confianca_exercito")
    policia = persona.get("q_confianca_policia")
    if stf is not None and exerc is not None:
        if exerc >= 7 and stf <= 4:
            lines.append("  → Perfil MILITARISTA: confia mais nas Forcas Armadas que no Judiciario")
        elif stf >= 7 and exerc <= 4:
            lines.append("  → Perfil INSTITUCIONALISTA: confia mais no Judiciario")
    if policia is not None and policia <= 3:
        lines.append("  → DESCONFIA da policia — nao vai defender policia em discussoes")
    elif policia is not None and policia >= 8:
        lines.append("  → CONFIA MUITO na policia — vai defender policia em discussoes")

    return "\n".join(lines)


def _build_extended_questionnaire(persona: dict[str, Any]) -> str:
    """Constroi bloco do questionario estendido."""
    fields = {
        "q_maior_problema": "Maior problema do Brasil",
        "q_avaliacao_bolsonaro": "Avaliacao gov Bolsonaro",
        "q_situacao_economica": "Situacao economica ultimos 12 meses",
        "q_perspectiva_futuro": "Perspectiva de futuro",
        "q_politico_favorito": "Politico favorito",
        "q_midia_principal": "Principal midia",
        "q_voto_influenciado_por": "Voto influenciado por",
        "q_impeachment_lula": "Apoia impeachment Lula",
        "q_intervencao_militar": "Apoia intervencao militar",
        "q_familia_tradicional": "Defende familia tradicional",
        "q_racismo_estrutural": "Acredita que racismo e estrutural",
        "q_meritocracia": "Acredita em meritocracia",
        "q_religiao_politica": "Religiao deve influenciar politica",
        "q_pena_morte": "A favor da pena de morte",
        "q_drogas_descriminalizar": "A favor de descriminalizar drogas",
        "q_mudanca_climatica_real": "Acredita em mudanca climatica",
        "q_sus_funciona": "Acredita que SUS funciona",
    }
    items = []
    for field, label in fields.items():
        val = persona.get(field)
        if val:
            items.append(f"  - {label}: {val}")

    if not items:
        return ""

    lines = ["OPINIOES E POSICOES DO QUESTIONARIO:"]
    lines.extend(items)
    return "\n".join(lines)


def build_validator_prompt(
    persona: dict[str, Any],
    user_message: str,
    generated_response: str,
    chat_history: list[dict[str, Any]] | None = None,
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

    # ── Electoral data ──
    electoral_lines = []
    voto22 = persona.get("voto_2022")
    aprov = persona.get("aprovacao_lula")
    voto26 = persona.get("voto_2026")
    if voto22:
        electoral_lines.append(f"  - Voto 2022 (2o turno): {voto22}")
    if aprov:
        electoral_lines.append(f"  - Aprovacao Lula: {aprov}")
    if voto26:
        electoral_lines.append(f"  - Intencao voto 2026: {voto26}")
    electoral_block = ""
    if electoral_lines:
        electoral_block = "DADOS ELEITORAIS:\n" + "\n".join(electoral_lines)

    # ── Temas polemicos ──
    temas_lines = []
    for field, label in [("tema_aborto", "Aborto"), ("tema_armas", "Armas"), ("tema_maconha", "Maconha"), ("tema_privatizacoes", "Privatizacoes"), ("tema_cotas_raciais", "Cotas raciais"), ("tema_casamento_gay", "Casamento gay")]:
        v = persona.get(field)
        if v:
            temas_lines.append(f"  - {label}: {v}")
    temas_block = ""
    if temas_lines:
        temas_block = "POSICOES EM TEMAS POLEMICOS:\n" + "\n".join(temas_lines)

    # ── Blocos detalhados ──
    vivencias_block = _build_vivencias_block(persona)
    tabu_block = _build_tabu_block(persona)
    confianca_block = _build_confianca_block(persona)
    extended_block = _build_extended_questionnaire(persona)

    # Monta bloco completo de dados da persona
    data_blocks = [b for b in [electoral_block, temas_block, confianca_block, extended_block, vivencias_block, tabu_block] if b]
    full_data_block = "\n\n".join(data_blocks) if data_blocks else "(sem dados de questionario)"

    birth_year = 2026 - age

    now = datetime.now(_BRT)
    hora_atual = now.strftime("%H:%M")
    hour = now.hour
    if 6 <= hour < 12:
        periodo = "MANHA (6h-12h)"
    elif 12 <= hour < 14:
        periodo = "HORARIO DE ALMOCO (12h-14h)"
    elif 14 <= hour < 18:
        periodo = "TARDE (14h-18h)"
    elif 18 <= hour < 22:
        periodo = "NOITE (18h-22h)"
    else:
        periodo = "MADRUGADA (22h-6h)"

    return f"""Voce e um VALIDADOR DE COERENCIA para simulacao de personas sinteticas brasileiras.

Sua funcao: verificar se a resposta gerada e COERENTE com TODOS os dados do perfil da persona.
Voce deve ser ESPECIALMENTE rigoroso com vivencias pessoais, vieses ocultos e posicoes declaradas.

## PERFIL BASICO DA PERSONA
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
- Horario atual: {hora_atual}h ({periodo})

## DADOS COMPLETOS DO QUESTIONARIO E VIVENCIAS

{full_data_block}

## MENSAGEM DO USUARIO
"{user_message}"

## RESPOSTA GERADA
"{generated_response}"

## CRITERIOS DE VALIDACAO

Verifique CADA criterio com RIGOR:

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

8. COERENCIA COM VIVENCIAS (CRITERIO CRITICO):
   Este e um dos criterios MAIS IMPORTANTES. Verifique com RIGOR MAXIMO.

   Se a persona TEM vivencias listadas acima, a resposta DEVE refletir isso:
   a) QUANDO O TEMA E TOCADO DIRETAMENTE:
      - Se alguem fala de violencia e a persona sofreu violencia → resposta VISCERAL, nao generica
      - Se alguem fala de fome e a persona passou fome → empatia REAL, nao "coitadinhos"
      - Se alguem fala de racismo e a persona sofreu racismo → INDIGNACAO pessoal, nao discurso abstrato
      - Cada vivencia tem reacoes esperadas e PROIBICOES listadas acima. Verifique CADA uma.

   b) QUANDO O TEMA E TANGENCIAL:
      - Vivencias moldam a VISAO DE MUNDO da persona, nao so reacoes diretas
      - Quem passou fome se preocupa mais com preco de comida em QUALQUER conversa sobre economia
      - Quem sofreu violencia domestica tem opiniao FORTE sobre relacionamentos
      - Quem tem depressao/ansiedade reage diferente a estresse

   c) CONTRADICOES GRAVES (= REVISE ou BLOCK):
      - Persona sofreu abuso sexual mas MINIMIZA abuso → BLOCK
      - Persona passou fome mas DESPREZA quem pede ajuda → REVISE (so se contradiz diretamente)
      - Persona sofreu racismo mas DIZ QUE racismo nao existe → BLOCK
      - Persona sofreu violencia domestica mas NORMALIZA agressao → BLOCK
      - Persona sofreu violencia policial mas DEFENDE policia incondicionalmente → REVISE

9. COERENCIA COM VIESES OCULTOS (TABU):
   Se a persona TEM vieses ocultos listados acima:
   - Os vieses devem VAZAR sutilmente, nao ser negados
   - Se o tema surge, o vies deve aparecer na escolha de palavras, no tom, no que defende
   - EXEMPLO: persona com racismo latente NAO vai dizer "racismo nao existe" abertamente,
     mas vai usar "essa gente", "essas pessoas", questionar cotas, etc.
   - Se a persona NEGA explicitamente um vies que tem = REVISE
   - Se a persona DEMONSTRA o vies de forma GROSSEIRA demais (deve ser sutil) = REVISE

10. COERENCIA COM POSICOES DECLARADAS:
    Verifique as posicoes em temas polemicos, dados eleitorais, confianca institucional e questionario:
    - Se votou em Lula, nao deveria elogiar Bolsonaro sem razao (e vice-versa)
    - Se e contra aborto, nao deveria defende-lo casualmente
    - Se tem confianca BAIXA na policia, nao deveria defender policia
    - Se tem confianca ALTA na igreja, expressoes religiosas sao esperadas
    - Se e a favor de pena de morte, nao deveria defender direitos de presos
    - Se acredita em meritocracia, nao deveria defender cotas facilmente
    - Se a midia principal e TV Record/SBT, visao de mundo diferente de quem le Folha/UOL
    - CADA posicao declarada deve ser COERENTE com o que a persona diz

11. COERENCIA TEMPORAL: O que a persona diz estar fazendo condiz com o horario atual ({hora_atual}h - {periodo})?
    - ESTE CRITERIO E CRITICO. Verifique com RIGOR MAXIMO.
    - Se sao 9h da manha, a persona NAO pode dizer que esta "no almoco" ou "jantando"
    - Se e madrugada, a persona NAO pode dizer que esta "no trabalho" (exceto se trabalha a noite)
    - Se e meio-dia, a persona NAO pode dizer que "acabou de acordar" (exceto se tem rotina noturna)
    - Atividades mencionadas devem ser PLAUSIVEIS para o horario:
      * Manha (6h-12h): acordando, cafe, indo trabalhar/estudar, no trabalho, no transito
      * Almoco (12h-14h): almocando, pausa do trabalho, descansando
      * Tarde (14h-18h): trabalhando, estudando, voltando pra casa, resolvendo coisas
      * Noite (18h-22h): em casa, jantando, descansando, assistindo TV, saindo
      * Madrugada (22h-6h): dormindo, insonia, festa, plantao (se aplicavel)
    - Se a persona menciona uma refeicao ou atividade incompativel com o horario = REVISE (OBRIGATORIO)

## RESPONDA EXATAMENTE NESTE FORMATO JSON:

{{
  "verdict": "PASS" ou "REVISE" ou "BLOCK",
  "issues": ["lista de problemas encontrados"],
  "suggestions": "como corrigir a resposta para ficar coerente (se REVISE)"
}}

Se tudo estiver coerente, retorne {{"verdict": "PASS", "issues": [], "suggestions": ""}}.
Se tiver problemas LEVES (2-3 ajustes), retorne REVISE com sugestoes.
Se a resposta CONTRADIZ uma vivencia pessoal ou e COMPLETAMENTE fora do personagem, retorne BLOCK.

PRIORIDADE DE VALIDACAO (do mais grave ao menos grave):
1. Contradizer vivencias pessoais (ex: minimizar abuso que sofreu) = BLOCK
2. Negar vieses ocultos explicitamente = REVISE
3. Contradizer posicoes declaradas = REVISE
4. Incoerencia temporal = REVISE
5. Formato/linguagem inadequados = REVISE

IMPORTANTE: Seja RIGOROSO. As vivencias pessoais sao a IDENTIDADE da persona.
Uma pessoa que sofreu violencia domestica NAO pode normalizar violencia.
Uma pessoa que passou fome NAO pode desprezar programas sociais.
Uma pessoa que sofreu racismo NAO pode dizer que racismo nao existe.
Essas contradicoes sao INADMISSIVEIS."""
