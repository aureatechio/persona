"""
Carrega personas do Supabase com cache em memoria.
"""
from __future__ import annotations

import time
from typing import Any

from arena_analysis.config import settings

# Cache global
_persona_cache: list[dict[str, Any]] = []
_cache_timestamp: float = 0.0

# Supabase client singleton
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client

        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client


# Campos necessarios para o loop de personas
# Inclui TODOS os campos de questionario/opiniao para que build_persona_extras
# possa montar o perfil completo (especialmente no modo individual)
PERSONA_FIELDS = ",".join([
    # ── Demograficos basicos ──
    "id", "name", "age", "city", "state", "lat", "lng", "gender", "gender_identity",
    "education_level", "generation", "political_leaning",
    "macro_religion", "archetype_primary",
    "cluster_id", "nome_grupo", "score_economico", "score_costumes",
    "social_class", "area_type", "region_br", "civil_status",
    "apelido_politico", "cronotype", "raca_cor",
    # ── Eleitorais ──
    "voto_2022", "aprovacao_lula", "voto_2026",
    "q_avaliacao_bolsonaro", "q_reeleicao",
    # ── Temas polemicos ──
    "tema_aborto", "tema_armas", "tema_maconha",
    "tema_privatizacoes", "tema_cotas_raciais", "tema_casamento_gay",
    # ── Politico/Social ──
    "q_pena_morte", "q_familia_tradicional", "q_racismo_estrutural",
    "q_meritocracia", "q_religiao_politica", "q_feminismo_bom",
    "q_democracia_importante", "q_intervencao_militar",
    "q_impeachment_lula", "q_corrupcao_problema", "q_fake_news_problema",
    "q_redes_sociais_censuradas", "q_sistema_eleitoral_confiavel",
    "q_pt_comunista", "q_bolsonaro_ditador",
    # ── Direitos / Costumes ──
    "q_direitos_lgbt", "q_adocao_homoafetiva", "q_linguagem_neutra",
    "q_genero_biologico", "q_homeschooling", "q_voto_obrigatorio",
    # ── Seguranca / Justica ──
    "q_policia_violenta", "q_crack_internar_forcado", "q_seguranca_prioridade",
    "q_camera_facial_aceita", "q_justica_funciona", "q_prisao_perpetua",
    "q_maioridade_penal_16", "q_drogas_descriminalizar", "q_prostituicao_legalizar",
    # ── Economia ──
    "q_salario_minimo_aumentar", "q_reforma_tributaria", "q_imposto_ricos",
    "q_estado_tamanho", "q_teto_gastos", "q_previdencia_reforma",
    "q_bitcoin_confiar", "q_banco_central_independente",
    "q_auxilio_emergencial_voltar", "q_desemprego_principal",
    "q_inflacao_controle", "q_13_salario_manter",
    "q_situacao_economica", "q_perspectiva_futuro", "q_maior_problema",
    # ── Saude / Ciencia ──
    "q_mudanca_climatica_real", "q_sus_funciona", "q_vacinas_confiar",
    "q_ciencia_importante", "q_terra_plana", "q_medicina_publica_boa",
    "q_plano_saude_tem",
    # ── Educacao ──
    "q_universidade_publica_gratuita", "q_ensino_distancia",
    "q_escola_particular_melhor", "q_enem_justo",
    # ── Social / Assistencia ──
    "q_bolsa_familia_bom", "q_amazonia_preservar", "q_energia_renovavel",
    "q_agronegocio_desmata", "q_queimadas_criminosas",
    # ── Internacional ──
    "q_china_ameaca", "q_eua_aliado", "q_imigracao",
    # ── Midia ──
    "q_whatsapp_noticias",
    # ── Confianca institucional ──
    "q_confianca_stf", "q_confianca_congresso", "q_confianca_imprensa",
    "q_confianca_policia", "q_confianca_exercito", "q_confianca_igreja",
    # ── Tabu implicito ──
    "q_ti_racismo_latente", "q_ti_nao_contrataria_negro_chefia",
    "q_ti_vizinho_negro_incomoda", "q_ti_sonegaria_imposto",
    "q_ti_aceitaria_propina", "q_ti_venderia_voto",
    "q_ti_bater_filho_normal", "q_ti_mulher_roupa_culpada",
    "q_ti_homofobia_violenta", "q_ti_linchamento_apoiaria",
    "q_ti_tortura_preso_ok", "q_ti_trabalho_infantil_ok",
    "q_ti_jeitinho_furar_fila", "q_ti_assediaria_mulher_rua",
    "q_ti_intolerancia_religiosa", "q_ti_preconceito_nordestino",
    "q_ti_violencia_domestica", "q_ti_compraria_produto_roubado",
    "q_ti_menor14_sabe_o_que_faz", "q_ti_nepotismo_concurso",
    # ── Vivencias ──
    "q_vi_passou_fome", "q_vi_ja_foi_assaltado", "q_vi_desempregado_1ano",
    "q_vi_pai_ausente", "q_vi_sofreu_racismo", "q_vi_depressao_ansiedade",
    "q_vi_violencia_policial", "q_vi_dependencia", "q_vi_abuso_sexual_infancia",
    "q_vi_trabalho_infantil", "q_vi_perdeu_familiar_violencia",
    "q_vi_sofreu_assedio_sexual", "q_vi_pensou_suicidio",
    "q_vi_preso_ou_familiar_preso", "q_vi_sofreu_violencia_domestica",
    "q_vi_ja_dormiu_na_rua", "q_vi_nao_completou_estudo", "q_vi_enchente_desastre",
    # ── JSONs completos ──
    "career_json", "demographic_json", "psychology_json", "beliefs_json",
])


def load_personas(cluster_filter: str | None = None) -> list[dict[str, Any]]:
    """
    Carrega todas as personas do Supabase.
    Usa cache em memoria com TTL configuravel.
    """
    global _persona_cache, _cache_timestamp

    now = time.time()
    cache_valid = (
        len(_persona_cache) > 0
        and (now - _cache_timestamp) < settings.persona_cache_ttl
    )

    if not cache_valid:
        print("[PersonaLoader] Carregando personas do Supabase...")
        sb = _get_supabase()
        all_data: list[dict] = []
        batch_size = 1000

        # Carrega em batches de 1000 (limite do Supabase)
        offset = 0
        while True:
            resp = (
                sb.table("personas")
                .select(PERSONA_FIELDS)
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            if resp.data:
                all_data.extend(resp.data)
                if len(resp.data) < batch_size:
                    break
                offset += batch_size
            else:
                break

        _persona_cache = all_data
        _cache_timestamp = now
        print(f"[PersonaLoader] {len(_persona_cache)} personas carregadas e cacheadas.")

    # Filtra por cluster se necessario
    if cluster_filter:
        return [p for p in _persona_cache if p.get("cluster_id") == cluster_filter]

    return list(_persona_cache)
