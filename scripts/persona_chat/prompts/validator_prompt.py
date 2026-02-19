"""
Prompt do agente validador de coerencia.
Verifica se a resposta gerada faz sentido para a persona.
"""
from __future__ import annotations

from typing import Any
from datetime import datetime
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

    # ── Questionnaire / Electoral data ──
    quest_lines = []
    voto22 = persona.get("voto_2022")
    aprov = persona.get("aprovacao_lula")
    voto26 = persona.get("voto_2026")
    if voto22:
        quest_lines.append(f"- Voto 2022 (2o turno): {voto22}")
    if aprov:
        quest_lines.append(f"- Aprovacao Lula: {aprov}")
    if voto26:
        quest_lines.append(f"- Intencao voto 2026: {voto26}")
    for field, label in [("tema_aborto", "Aborto"), ("tema_armas", "Armas"), ("tema_maconha", "Maconha"), ("tema_privatizacoes", "Privatizacoes"), ("tema_cotas_raciais", "Cotas raciais"), ("tema_casamento_gay", "Casamento gay")]:
        v = persona.get(field)
        if v:
            quest_lines.append(f"- {label}: {v}")

    # Tabu (only "Sim")
    tabu_sim = []
    for field, desc in [
        ("q_ti_racismo_latente", "racismo latente"), ("q_ti_nao_contrataria_negro_chefia", "nao contrataria negro para chefia"),
        ("q_ti_vizinho_negro_incomoda", "vizinho negro incomoda"), ("q_ti_sonegaria_imposto", "sonegaria imposto"),
        ("q_ti_aceitaria_propina", "aceitaria propina"), ("q_ti_venderia_voto", "venderia voto"),
        ("q_ti_bater_filho_normal", "bater em filho normal"), ("q_ti_mulher_roupa_culpada", "culpa mulher pela roupa"),
        ("q_ti_homofobia_violenta", "homofobia violenta"), ("q_ti_linchamento_apoiaria", "apoiaria linchamento"),
        ("q_ti_tortura_preso_ok", "tortura de preso ok"), ("q_ti_trabalho_infantil_ok", "trabalho infantil ok"),
        ("q_ti_jeitinho_furar_fila", "usa jeitinho/fura fila"), ("q_ti_assediaria_mulher_rua", "assediaria mulher na rua"),
        ("q_ti_intolerancia_religiosa", "intolerancia religiosa"), ("q_ti_preconceito_nordestino", "preconceito com nordestinos"),
        ("q_ti_violencia_domestica", "normaliza violencia domestica"), ("q_ti_compraria_produto_roubado", "compraria produto roubado"),
        ("q_ti_menor14_sabe_o_que_faz", "menor de 14 sabe o que faz"), ("q_ti_nepotismo_concurso", "usaria nepotismo"),
    ]:
        if persona.get(field) == "Sim":
            tabu_sim.append(desc)
    if tabu_sim:
        quest_lines.append(f"- Vieses ocultos (tabu): {', '.join(tabu_sim)}")

    # Vivências (only "Sim")
    viv_sim = []
    for field, desc in [
        ("q_vi_passou_fome", "passou fome"), ("q_vi_ja_foi_assaltado", "ja foi assaltado"),
        ("q_vi_desempregado_1ano", "desempregado 1+ ano"), ("q_vi_pai_ausente", "pai ausente"),
        ("q_vi_sofreu_racismo", "sofreu racismo"), ("q_vi_depressao_ansiedade", "depressao/ansiedade"),
        ("q_vi_violencia_policial", "violencia policial"), ("q_vi_dependencia", "dependencia quimica"),
        ("q_vi_abuso_sexual_infancia", "abuso sexual infancia"), ("q_vi_trabalho_infantil", "trabalho infantil"),
        ("q_vi_perdeu_familiar_violencia", "perdeu familiar por violencia"), ("q_vi_sofreu_assedio_sexual", "assedio sexual"),
        ("q_vi_pensou_suicidio", "pensou em suicidio"), ("q_vi_preso_ou_familiar_preso", "preso ou familiar preso"),
        ("q_vi_sofreu_violencia_domestica", "violencia domestica"), ("q_vi_ja_dormiu_na_rua", "ja dormiu na rua"),
        ("q_vi_nao_completou_estudo", "nao completou estudo"), ("q_vi_enchente_desastre", "enchente/desastre"),
    ]:
        if persona.get(field) == "Sim":
            viv_sim.append(desc)
    if viv_sim:
        quest_lines.append(f"- Vivencias: {', '.join(viv_sim)}")

    quest_block = chr(10).join(quest_lines) if quest_lines else ""

    birth_year = 2026 - age

    now = datetime.now()
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
- Horario atual: {hora_atual}h ({periodo})
{quest_block}

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

8. COERENCIA COM QUESTIONARIO: A resposta condiz com os dados do questionario?
   - Se a persona votou em Lula, nao deveria elogiar Bolsonaro sem razao (e vice-versa)
   - Se a persona e contra aborto, nao deveria defende-lo casualmente
   - Se a persona tem vieses ocultos (tabu), eles devem VAZAR sutilmente, nao ser negados
   - Posicoes em temas polemicos devem ser refletidas quando esses temas surgem

9. COERENCIA COM VIVENCIAS: Se a persona viveu experiencias marcantes, a resposta reflete?
   - Se o tema toca numa vivencia (fome, violencia, racismo), a persona reage com MAIS emocao
   - Se a persona nunca viveu algo, nao deve falar com autoridade sobre aquilo
   - Vivencias geram respostas mais VISCERAIS e pessoais, nao genericas

10. COERENCIA TEMPORAL: O que a persona diz estar fazendo condiz com o horario atual ({hora_atual}h - {periodo})?
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
   - Contradicao temporal entre respostas anteriores e atual = REVISE (OBRIGATORIO)

## RESPONDA EXATAMENTE NESTE FORMATO JSON:

{{
  "verdict": "PASS" ou "REVISE" ou "BLOCK",
  "issues": ["lista de problemas encontrados"],
  "suggestions": "como corrigir a resposta para ficar coerente (se REVISE)"
}}

Se tudo estiver coerente, retorne {{"verdict": "PASS", "issues": [], "suggestions": ""}}.
Se tiver problemas LEVES (2-3 ajustes), retorne REVISE com sugestoes.
Se a resposta for COMPLETAMENTE fora do personagem, retorne BLOCK.

IMPORTANTE: Seja RIGOROSO com coerencia de idade, escolaridade e TEMPORAL. Esses sao os erros mais comuns.
Coerencia temporal e CRITICA — dizer "to no almoco" as 9h da manha e um erro GRAVE que DEVE ser corrigido."""
