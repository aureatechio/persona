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


def build_persona_extras_expanded(p: dict[str, Any]) -> str:
    """
    Build EXPANDED persona data for individual mode prompts.
    Each section on its own line for maximum AI attention.
    """
    sections: list[str] = []

    def _section(title: str, fields: list[tuple[str, str]]) -> str | None:
        items = []
        for field, label in fields:
            v = p.get(field)
            if v is not None and v != "" and v != "Não respondeu":
                items.append(f"  {label}: {v}")
        if items:
            return f"[{title}]\n" + "\n".join(items)
        return None

    # Electoral
    s = _section("ELEIÇÃO & VOTO", [
        ("voto_2022", "Voto 2022"),
        ("aprovacao_lula", "Aprovação Lula"),
        ("voto_2026", "Intenção voto 2026"),
        ("q_avaliacao_bolsonaro", "Avaliação Bolsonaro"),
        ("q_reeleicao", "Reeleição"),
    ])
    if s: sections.append(s)

    # Controversial topics
    s = _section("TEMAS POLÊMICOS", [
        ("tema_aborto", "Aborto"),
        ("tema_armas", "Armas"),
        ("tema_maconha", "Maconha"),
        ("tema_privatizacoes", "Privatizações"),
        ("tema_cotas_raciais", "Cotas raciais"),
        ("tema_casamento_gay", "Casamento gay"),
    ])
    if s: sections.append(s)

    # Political/social
    s = _section("OPINIÃO POLÍTICA/SOCIAL", [
        ("q_pena_morte", "Pena de morte"),
        ("q_familia_tradicional", "Família tradicional"),
        ("q_racismo_estrutural", "Racismo estrutural"),
        ("q_meritocracia", "Meritocracia"),
        ("q_religiao_politica", "Religião na política"),
        ("q_feminismo_bom", "Feminismo"),
        ("q_democracia_importante", "Democracia"),
        ("q_intervencao_militar", "Intervenção militar"),
        ("q_impeachment_lula", "Impeachment Lula"),
        ("q_corrupcao_problema", "Corrupção"),
        ("q_fake_news_problema", "Fake news"),
        ("q_redes_sociais_censuradas", "Censura redes sociais"),
        ("q_sistema_eleitoral_confiavel", "Sistema eleitoral"),
        ("q_pt_comunista", "PT é comunista"),
        ("q_bolsonaro_ditador", "Bolsonaro é ditador"),
    ])
    if s: sections.append(s)

    # Rights / customs
    s = _section("DIREITOS & COSTUMES", [
        ("q_direitos_lgbt", "Direitos LGBT"),
        ("q_adocao_homoafetiva", "Adoção homoafetiva"),
        ("q_linguagem_neutra", "Linguagem neutra"),
        ("q_genero_biologico", "Gênero = biológico"),
        ("q_homeschooling", "Homeschooling"),
        ("q_voto_obrigatorio", "Voto obrigatório"),
    ])
    if s: sections.append(s)

    # Security / Justice
    s = _section("SEGURANÇA & JUSTIÇA", [
        ("q_policia_violenta", "Polícia violenta"),
        ("q_crack_internar_forcado", "Internação forçada crack"),
        ("q_seguranca_prioridade", "Segurança prioridade"),
        ("q_camera_facial_aceita", "Câmera facial"),
        ("q_justica_funciona", "Justiça funciona"),
        ("q_prisao_perpetua", "Prisão perpétua"),
        ("q_maioridade_penal_16", "Maioridade penal 16"),
        ("q_drogas_descriminalizar", "Descriminalizar drogas"),
        ("q_prostituicao_legalizar", "Legalizar prostituição"),
    ])
    if s: sections.append(s)

    # Economy
    s = _section("ECONOMIA", [
        ("q_salario_minimo_aumentar", "Aumentar salário mínimo"),
        ("q_reforma_tributaria", "Reforma tributária"),
        ("q_imposto_ricos", "Imposto sobre ricos"),
        ("q_estado_tamanho", "Tamanho do Estado"),
        ("q_teto_gastos", "Teto de gastos"),
        ("q_previdencia_reforma", "Reforma previdência"),
        ("q_bitcoin_confiar", "Confia em Bitcoin"),
        ("q_banco_central_independente", "BC independente"),
        ("q_auxilio_emergencial_voltar", "Voltar auxílio emergencial"),
        ("q_desemprego_principal", "Desemprego é principal problema"),
        ("q_inflacao_controle", "Inflação sob controle"),
        ("q_13_salario_manter", "Manter 13o salário"),
        ("q_situacao_economica", "Situação econômica"),
        ("q_perspectiva_futuro", "Perspectiva futuro"),
        ("q_maior_problema", "Maior problema do Brasil"),
    ])
    if s: sections.append(s)

    # Health / Science
    s = _section("SAÚDE & CIÊNCIA", [
        ("q_mudanca_climatica_real", "Mudança climática real"),
        ("q_sus_funciona", "SUS funciona"),
        ("q_vacinas_confiar", "Confia em vacinas"),
        ("q_ciencia_importante", "Ciência importante"),
        ("q_terra_plana", "Terra plana"),
        ("q_medicina_publica_boa", "Medicina pública boa"),
        ("q_plano_saude_tem", "Tem plano de saúde"),
    ])
    if s: sections.append(s)

    # Education
    s = _section("EDUCAÇÃO", [
        ("q_universidade_publica_gratuita", "Universidade pública gratuita"),
        ("q_ensino_distancia", "Ensino a distância"),
        ("q_escola_particular_melhor", "Escola particular melhor"),
        ("q_enem_justo", "ENEM justo"),
    ])
    if s: sections.append(s)

    # Social / Assistance
    s = _section("SOCIAL & MEIO AMBIENTE", [
        ("q_bolsa_familia_bom", "Bolsa Família bom"),
        ("q_amazonia_preservar", "Preservar Amazônia"),
        ("q_energia_renovavel", "Energia renovável"),
        ("q_agronegocio_desmata", "Agronegócio desmata"),
        ("q_queimadas_criminosas", "Queimadas criminosas"),
    ])
    if s: sections.append(s)

    # International
    s = _section("INTERNACIONAL", [
        ("q_china_ameaca", "China é ameaça"),
        ("q_eua_aliado", "EUA é aliado"),
        ("q_imigracao", "Imigração"),
    ])
    if s: sections.append(s)

    # Media
    s = _section("MÍDIA", [
        ("q_whatsapp_noticias", "WhatsApp para notícias"),
    ])
    if s: sections.append(s)

    # Institutional trust
    conf_items = []
    for field, label in [
        ("q_confianca_stf", "STF"),
        ("q_confianca_congresso", "Congresso"),
        ("q_confianca_imprensa", "Imprensa"),
        ("q_confianca_policia", "Polícia"),
        ("q_confianca_exercito", "Exército"),
        ("q_confianca_igreja", "Igreja"),
    ]:
        v = p.get(field)
        if v is not None:
            conf_items.append(f"  {label}: {v}/10")
    if conf_items:
        sections.append("[CONFIANÇA INSTITUCIONAL]\n" + "\n".join(conf_items))

    # Hidden biases (only "Sim")
    tabu_items = []
    for field, label in [
        ("q_ti_racismo_latente", "Racismo latente"),
        ("q_ti_nao_contrataria_negro_chefia", "Não contrataria negro p/ chefia"),
        ("q_ti_vizinho_negro_incomoda", "Vizinho negro incomoda"),
        ("q_ti_sonegaria_imposto", "Sonegaria imposto"),
        ("q_ti_aceitaria_propina", "Aceitaria propina"),
        ("q_ti_venderia_voto", "Venderia voto"),
        ("q_ti_bater_filho_normal", "Bater em filho é normal"),
        ("q_ti_mulher_roupa_culpada", "Mulher culpada pela roupa"),
        ("q_ti_homofobia_violenta", "Homofobia violenta"),
        ("q_ti_linchamento_apoiaria", "Apoiaria linchamento"),
        ("q_ti_tortura_preso_ok", "Tortura de preso OK"),
        ("q_ti_trabalho_infantil_ok", "Trabalho infantil OK"),
        ("q_ti_jeitinho_furar_fila", "Jeitinho / furar fila"),
        ("q_ti_assediaria_mulher_rua", "Assediaria mulher na rua"),
        ("q_ti_intolerancia_religiosa", "Intolerância religiosa"),
        ("q_ti_preconceito_nordestino", "Preconceito nordestino"),
        ("q_ti_violencia_domestica", "Violência doméstica"),
        ("q_ti_compraria_produto_roubado", "Compraria produto roubado"),
        ("q_ti_menor14_sabe_o_que_faz", "Menor de 14 sabe o que faz"),
        ("q_ti_nepotismo_concurso", "Nepotismo em concurso"),
    ]:
        if p.get(field) == "Sim":
            tabu_items.append(f"  ⚠️ {label}")
    if tabu_items:
        sections.append("[VIESES OCULTOS (tabu)]\n" + "\n".join(tabu_items))

    # Lived experiences (only "Sim")
    viv_items = []
    for field, label in [
        ("q_vi_passou_fome", "Passou fome"),
        ("q_vi_ja_foi_assaltado", "Já foi assaltado"),
        ("q_vi_desempregado_1ano", "Desempregado +1 ano"),
        ("q_vi_pai_ausente", "Pai ausente"),
        ("q_vi_sofreu_racismo", "Sofreu racismo"),
        ("q_vi_depressao_ansiedade", "Depressão/ansiedade"),
        ("q_vi_violencia_policial", "Sofreu violência policial"),
        ("q_vi_dependencia", "Dependência química"),
        ("q_vi_abuso_sexual_infancia", "Abuso sexual na infância"),
        ("q_vi_trabalho_infantil", "Trabalho infantil"),
        ("q_vi_perdeu_familiar_violencia", "Perdeu familiar p/ violência"),
        ("q_vi_sofreu_assedio_sexual", "Sofreu assédio sexual"),
        ("q_vi_pensou_suicidio", "Pensou em suicídio"),
        ("q_vi_preso_ou_familiar_preso", "Preso ou familiar preso"),
        ("q_vi_sofreu_violencia_domestica", "Violência doméstica"),
        ("q_vi_ja_dormiu_na_rua", "Já dormiu na rua"),
        ("q_vi_nao_completou_estudo", "Não completou estudo"),
        ("q_vi_enchente_desastre", "Enchente/desastre"),
    ]:
        if p.get(field) == "Sim":
            viv_items.append(f"  • {label}")
    if viv_items:
        sections.append("[VIVÊNCIAS REAIS]\n" + "\n".join(viv_items))

    return "\n\n".join(sections)
