"""Helper to build extra persona data for arena prompts (DRY)."""
from __future__ import annotations

from typing import Any


def build_persona_extras(p: dict[str, Any]) -> str:
    """
    Build compact extra persona data string for arena prompt lines.
    Includes: electoral, temas, questionnaire-key, confiança, tabu, vivências.
    Returns pipe-separated string, or empty string if no data.
    """
    parts: list[str] = []

    # Electoral
    voto22 = p.get("voto_2022")
    aprov = p.get("aprovacao_lula")
    voto26 = p.get("voto_2026")
    if voto22:
        parts.append(f"Voto22:{voto22}")
    if aprov:
        parts.append(f"AprovLula:{aprov}")
    if voto26:
        parts.append(f"Voto26:{voto26}")

    # Temas polêmicos
    for field, label in [
        ("tema_aborto", "Aborto"),
        ("tema_armas", "Armas"),
        ("tema_maconha", "Maconha"),
        ("tema_privatizacoes", "Privat"),
        ("tema_cotas_raciais", "Cotas"),
        ("tema_casamento_gay", "CasGay"),
    ]:
        v = p.get(field)
        if v:
            parts.append(f"{label}:{v}")

    # Questionnaire key fields
    for field, label in [
        ("q_maior_problema", "Problema"),
        ("q_avaliacao_bolsonaro", "AvalBolso"),
        ("q_situacao_economica", "SitEcon"),
        ("q_perspectiva_futuro", "Futuro"),
    ]:
        v = p.get(field)
        if v:
            parts.append(f"{label}:{v}")

    # Confiança institucional
    conf_parts = []
    for field, label in [
        ("q_confianca_stf", "STF"),
        ("q_confianca_congresso", "Cong"),
        ("q_confianca_imprensa", "Imp"),
        ("q_confianca_policia", "Pol"),
        ("q_confianca_exercito", "Ex"),
        ("q_confianca_igreja", "Igr"),
    ]:
        v = p.get(field)
        if v is not None:
            conf_parts.append(f"{label}:{v}")
    if conf_parts:
        parts.append(f"Conf[{','.join(conf_parts)}]")

    # Tabu implícito (only "Sim")
    tabu_sim = []
    for f, d in [
        ("q_ti_racismo_latente", "RacismoLat"),
        ("q_ti_nao_contrataria_negro_chefia", "NaoContratNegro"),
        ("q_ti_vizinho_negro_incomoda", "VizNegro"),
        ("q_ti_sonegaria_imposto", "Sonegaria"),
        ("q_ti_aceitaria_propina", "Propina"),
        ("q_ti_venderia_voto", "VendeVoto"),
        ("q_ti_bater_filho_normal", "BateFilho"),
        ("q_ti_mulher_roupa_culpada", "CulpaMulher"),
        ("q_ti_homofobia_violenta", "Homofobia"),
        ("q_ti_linchamento_apoiaria", "Linchamento"),
        ("q_ti_tortura_preso_ok", "TorturaOk"),
        ("q_ti_trabalho_infantil_ok", "TrabInfOk"),
        ("q_ti_jeitinho_furar_fila", "Jeitinho"),
        ("q_ti_assediaria_mulher_rua", "AssedioRua"),
        ("q_ti_intolerancia_religiosa", "IntolRelig"),
        ("q_ti_preconceito_nordestino", "PrecNord"),
        ("q_ti_violencia_domestica", "ViolDomest"),
        ("q_ti_compraria_produto_roubado", "CompraRoubado"),
        ("q_ti_menor14_sabe_o_que_faz", "Menor14Ok"),
        ("q_ti_nepotismo_concurso", "Nepotismo"),
    ]:
        if p.get(f) == "Sim":
            tabu_sim.append(d)
    if tabu_sim:
        parts.append(f"VIESES[{','.join(tabu_sim)}]")

    # Vivências (only "Sim")
    viv_sim = []
    for f, d in [
        ("q_vi_passou_fome", "Fome"),
        ("q_vi_ja_foi_assaltado", "Assaltado"),
        ("q_vi_desempregado_1ano", "Desempreg"),
        ("q_vi_pai_ausente", "PaiAusente"),
        ("q_vi_sofreu_racismo", "Racismo"),
        ("q_vi_depressao_ansiedade", "Depressao"),
        ("q_vi_violencia_policial", "ViolPolicial"),
        ("q_vi_dependencia", "Dependencia"),
        ("q_vi_abuso_sexual_infancia", "AbusoInf"),
        ("q_vi_trabalho_infantil", "TrabInfantil"),
        ("q_vi_perdeu_familiar_violencia", "PerdeuFamiliar"),
        ("q_vi_sofreu_assedio_sexual", "AssedioSex"),
        ("q_vi_pensou_suicidio", "Suicidio"),
        ("q_vi_preso_ou_familiar_preso", "Preso"),
        ("q_vi_sofreu_violencia_domestica", "ViolDomestica"),
        ("q_vi_ja_dormiu_na_rua", "DormiuRua"),
        ("q_vi_nao_completou_estudo", "NaoEstudou"),
        ("q_vi_enchente_desastre", "Enchente"),
    ]:
        if p.get(f) == "Sim":
            viv_sim.append(d)
    if viv_sim:
        parts.append(f"VIVENCIAS[{','.join(viv_sim)}]")

    return " | ".join(parts)
