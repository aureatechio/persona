"""Helper to build extra persona data for arena prompts (DRY)."""
from __future__ import annotations

from typing import Any


def _add_fields(parts: list[str], p: dict[str, Any], fields: list[tuple[str, str]]) -> None:
    """Add non-empty field values to parts list."""
    for field, label in fields:
        v = p.get(field)
        if v is not None and v != "" and v != "Não respondeu":
            parts.append(f"{label}:{v}")


def _add_sim_only(prefix: str, p: dict[str, Any], fields: list[tuple[str, str]]) -> str | None:
    """Collect fields where value is 'Sim' into a compact bracket notation."""
    sim = [label for field, label in fields if p.get(field) == "Sim"]
    return f"{prefix}[{','.join(sim)}]" if sim else None


def build_persona_extras(p: dict[str, Any]) -> str:
    """
    Build COMPLETE persona data string for arena prompt lines.
    Sends ALL opinion/questionnaire fields so the AI has the full profile.
    Returns pipe-separated string, or empty string if no data.
    """
    parts: list[str] = []

    # ── Electoral ──────────────────────────────────────────────
    _add_fields(parts, p, [
        ("voto_2022", "Voto22"),
        ("aprovacao_lula", "AprovLula"),
        ("voto_2026", "Voto26"),
        ("q_avaliacao_bolsonaro", "AvalBolso"),
        ("q_reeleicao", "Reeleição"),
    ])

    # ── Temas polêmicos ───────────────────────────────────────
    _add_fields(parts, p, [
        ("tema_aborto", "Aborto"),
        ("tema_armas", "Armas"),
        ("tema_maconha", "Maconha"),
        ("tema_privatizacoes", "Privat"),
        ("tema_cotas_raciais", "Cotas"),
        ("tema_casamento_gay", "CasGay"),
    ])

    # ── Político/Social ───────────────────────────────────────
    _add_fields(parts, p, [
        ("q_pena_morte", "PenaMorte"),
        ("q_familia_tradicional", "FamTradi"),
        ("q_racismo_estrutural", "RacismoEstr"),
        ("q_meritocracia", "Meritocr"),
        ("q_religiao_politica", "ReligPol"),
        ("q_feminismo_bom", "Feminismo"),
        ("q_democracia_importante", "Democracia"),
        ("q_intervencao_militar", "IntervMil"),
        ("q_impeachment_lula", "ImpeachLula"),
        ("q_corrupcao_problema", "Corrupção"),
        ("q_fake_news_problema", "FakeNews"),
        ("q_redes_sociais_censuradas", "CensuraRedes"),
        ("q_sistema_eleitoral_confiavel", "SistEleit"),
        ("q_pt_comunista", "PTComun"),
        ("q_bolsonaro_ditador", "BolsoDitador"),
    ])

    # ── Direitos / Costumes ───────────────────────────────────
    _add_fields(parts, p, [
        ("q_direitos_lgbt", "DirLGBT"),
        ("q_adocao_homoafetiva", "AdoçãoHomo"),
        ("q_linguagem_neutra", "LingNeutra"),
        ("q_genero_biologico", "GênBiol"),
        ("q_homeschooling", "HomeSchool"),
        ("q_voto_obrigatorio", "VotoObrig"),
    ])

    # ── Segurança / Justiça ───────────────────────────────────
    _add_fields(parts, p, [
        ("q_policia_violenta", "PolViolenta"),
        ("q_crack_internar_forcado", "InternForçada"),
        ("q_seguranca_prioridade", "SegPrior"),
        ("q_camera_facial_aceita", "CamFacial"),
        ("q_justica_funciona", "JustiçaFunc"),
        ("q_prisao_perpetua", "PrisãoPerp"),
        ("q_maioridade_penal_16", "Maior16"),
        ("q_drogas_descriminalizar", "DescrimDrogas"),
        ("q_prostituicao_legalizar", "LegalProst"),
    ])

    # ── Economia ──────────────────────────────────────────────
    _add_fields(parts, p, [
        ("q_salario_minimo_aumentar", "SalMin"),
        ("q_reforma_tributaria", "RefTrib"),
        ("q_imposto_ricos", "ImpRicos"),
        ("q_estado_tamanho", "TamEstado"),
        ("q_teto_gastos", "TetoGastos"),
        ("q_previdencia_reforma", "RefPrev"),
        ("q_bitcoin_confiar", "Bitcoin"),
        ("q_banco_central_independente", "BCIndep"),
        ("q_auxilio_emergencial_voltar", "AuxEmerg"),
        ("q_desemprego_principal", "Desemprego"),
        ("q_inflacao_controle", "Inflação"),
        ("q_13_salario_manter", "13Sal"),
        ("q_situacao_economica", "SitEcon"),
        ("q_perspectiva_futuro", "Futuro"),
        ("q_maior_problema", "Problema"),
    ])

    # ── Saúde / Ciência ──────────────────────────────────────
    _add_fields(parts, p, [
        ("q_mudanca_climatica_real", "MudClima"),
        ("q_sus_funciona", "SUS"),
        ("q_vacinas_confiar", "Vacinas"),
        ("q_ciencia_importante", "Ciência"),
        ("q_terra_plana", "TerraPlana"),
        ("q_medicina_publica_boa", "MedPub"),
        ("q_plano_saude_tem", "PlanoSaúde"),
    ])

    # ── Educação ─────────────────────────────────────────────
    _add_fields(parts, p, [
        ("q_universidade_publica_gratuita", "UniGratis"),
        ("q_ensino_distancia", "EAD"),
        ("q_escola_particular_melhor", "EscParticular"),
        ("q_enem_justo", "ENEM"),
    ])

    # ── Social / Assistência ─────────────────────────────────
    _add_fields(parts, p, [
        ("q_bolsa_familia_bom", "BolsaFam"),
        ("q_amazonia_preservar", "Amazônia"),
        ("q_energia_renovavel", "EnergRenov"),
        ("q_agronegocio_desmata", "AgroDesmata"),
        ("q_queimadas_criminosas", "Queimadas"),
    ])

    # ── Internacional ────────────────────────────────────────
    _add_fields(parts, p, [
        ("q_china_ameaca", "China"),
        ("q_eua_aliado", "EUA"),
        ("q_imigracao", "Imigração"),
    ])

    # ── Mídia ────────────────────────────────────────────────
    _add_fields(parts, p, [
        ("q_whatsapp_noticias", "WhatsNews"),
    ])

    # ── Confiança institucional (escala 1-10) ────────────────
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

    # ── Tabu implícito (só "Sim") ────────────────────────────
    tabu = _add_sim_only("VIESES", p, [
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
    ])
    if tabu:
        parts.append(tabu)

    # ── Vivências (só "Sim") ─────────────────────────────────
    viv = _add_sim_only("VIVENCIAS", p, [
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
    ])
    if viv:
        parts.append(viv)

    return " | ".join(parts)
