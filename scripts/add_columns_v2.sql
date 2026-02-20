-- ══════════════════════════════════════════════════════════════════════
-- Synthetic Person — Add q_ti_* (Tabu Implícito) and q_vi_* (Vivência) columns
-- Run this in Supabase Dashboard > SQL Editor BEFORE importing CSV
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.personas
  -- ── Tabu Implícito (20 colunas) ──
  ADD COLUMN IF NOT EXISTS q_ti_racismo_latente text,
  ADD COLUMN IF NOT EXISTS q_ti_nao_contrataria_negro_chefia text,
  ADD COLUMN IF NOT EXISTS q_ti_vizinho_negro_incomoda text,
  ADD COLUMN IF NOT EXISTS q_ti_sonegaria_imposto text,
  ADD COLUMN IF NOT EXISTS q_ti_aceitaria_propina text,
  ADD COLUMN IF NOT EXISTS q_ti_venderia_voto text,
  ADD COLUMN IF NOT EXISTS q_ti_bater_filho_normal text,
  ADD COLUMN IF NOT EXISTS q_ti_mulher_roupa_culpada text,
  ADD COLUMN IF NOT EXISTS q_ti_homofobia_violenta text,
  ADD COLUMN IF NOT EXISTS q_ti_linchamento_apoiaria text,
  ADD COLUMN IF NOT EXISTS q_ti_tortura_preso_ok text,
  ADD COLUMN IF NOT EXISTS q_ti_trabalho_infantil_ok text,
  ADD COLUMN IF NOT EXISTS q_ti_jeitinho_furar_fila text,
  ADD COLUMN IF NOT EXISTS q_ti_assediaria_mulher_rua text,
  ADD COLUMN IF NOT EXISTS q_ti_intolerancia_religiosa text,
  ADD COLUMN IF NOT EXISTS q_ti_preconceito_nordestino text,
  ADD COLUMN IF NOT EXISTS q_ti_violencia_domestica text,
  ADD COLUMN IF NOT EXISTS q_ti_compraria_produto_roubado text,
  ADD COLUMN IF NOT EXISTS q_ti_menor14_sabe_o_que_faz text,
  ADD COLUMN IF NOT EXISTS q_ti_nepotismo_concurso text,

  -- ── Vivências e Vulnerabilidades (18 colunas) ──
  ADD COLUMN IF NOT EXISTS q_vi_abuso_sexual_infancia text,
  ADD COLUMN IF NOT EXISTS q_vi_passou_fome text,
  ADD COLUMN IF NOT EXISTS q_vi_trabalho_infantil text,
  ADD COLUMN IF NOT EXISTS q_vi_ja_foi_assaltado text,
  ADD COLUMN IF NOT EXISTS q_vi_perdeu_familiar_violencia text,
  ADD COLUMN IF NOT EXISTS q_vi_desempregado_1ano text,
  ADD COLUMN IF NOT EXISTS q_vi_pai_ausente text,
  ADD COLUMN IF NOT EXISTS q_vi_sofreu_racismo text,
  ADD COLUMN IF NOT EXISTS q_vi_sofreu_assedio_sexual text,
  ADD COLUMN IF NOT EXISTS q_vi_depressao_ansiedade text,
  ADD COLUMN IF NOT EXISTS q_vi_pensou_suicidio text,
  ADD COLUMN IF NOT EXISTS q_vi_preso_ou_familiar_preso text,
  ADD COLUMN IF NOT EXISTS q_vi_sofreu_violencia_domestica text,
  ADD COLUMN IF NOT EXISTS q_vi_ja_dormiu_na_rua text,
  ADD COLUMN IF NOT EXISTS q_vi_violencia_policial text,
  ADD COLUMN IF NOT EXISTS q_vi_nao_completou_estudo text,
  ADD COLUMN IF NOT EXISTS q_vi_enchente_desastre text,
  ADD COLUMN IF NOT EXISTS q_vi_dependencia text;
