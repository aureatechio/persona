-- ============================================================================
-- Living Personas - Migration
-- Run this in Supabase SQL Editor
-- Sistema de sentimento eleitoral em tempo real
-- ============================================================================

-- ============================================================================
-- 1. TABELA: candidates
-- Candidatos à presidência (escala para N candidatos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.candidates (
  id text PRIMARY KEY,                          -- ex: 'lula', 'flavio', 'ratinho', 'caiado'
  name text NOT NULL,
  party text NOT NULL,
  position text DEFAULT 'Pré-candidato',        -- 'Presidente', 'Senador', 'Governador'
  leaning text NOT NULL,                        -- 'esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita'
  photo_url text,
  is_active boolean DEFAULT true,
  polling_percent numeric(5,2) DEFAULT 0,       -- última porcentagem do nosso polling sintético
  polling_updated_at timestamptz,
  sentiment_trend numeric(5,3) DEFAULT 0,       -- trend 7 dias: positivo = ganhando
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb            -- extensível: plataforma, slogans, etc.
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_read" ON public.candidates FOR SELECT USING (true);

-- Seed: candidatos iniciais
INSERT INTO public.candidates (id, name, party, position, leaning) VALUES
  ('lula',    'Lula',              'PT',           'Presidente',  'esquerda'),
  ('flavio',  'Flávio Bolsonaro',  'PL',           'Senador',     'direita'),
  ('ratinho', 'Ratinho Jr.',       'PSD',          'Governador',  'centro-direita'),
  ('caiado',  'Ronaldo Caiado',    'União Brasil', 'Governador',  'direita')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 2. TABELA: persona_sentiments
-- Sentimento por persona × candidato (dinâmica, escala para N candidatos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.persona_sentiments (
  persona_id    uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  candidate_id  text NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  sentiment     numeric(5,4) DEFAULT 0,          -- -1.0 a +1.0
  initial_sentiment numeric(5,4),                -- valor da calibração inicial (drift check)
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (persona_id, candidate_id)
);

ALTER TABLE public.persona_sentiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persona_sentiments_read" ON public.persona_sentiments FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_persona_sentiments_candidate
  ON public.persona_sentiments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_persona_sentiments_persona
  ON public.persona_sentiments(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_sentiments_sentiment
  ON public.persona_sentiments(candidate_id, sentiment);


-- ============================================================================
-- 3. TABELA: update_cycles
-- Registro de cada rodada 3x/dia do living worker
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.update_cycles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'running',                -- 'running' | 'completed' | 'failed' | 'rolled_back'
  news_count integer DEFAULT 0,
  news_applied integer DEFAULT 0,
  news_skipped integer DEFAULT 0,
  updates_applied integer DEFAULT 0,
  snapshot_id uuid REFERENCES public.persona_snapshots(id),
  summary jsonb DEFAULT '{}'::jsonb,            -- resumo gerado: { validation: {...}, polling_before: {...}, polling_after: {...} }
  error_message text
);

ALTER TABLE public.update_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "update_cycles_read" ON public.update_cycles FOR SELECT USING (true);


-- ============================================================================
-- 4. TABELA: news_events
-- Notícias coletadas via Tavily + análise de impacto
-- Serve como cache para o Arena Worker também
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  candidate_id text REFERENCES public.candidates(id),
  headline text NOT NULL,
  summary text,                                 -- resumo AI
  source_url text,
  tavily_raw jsonb,                             -- resposta bruta do Tavily (debug)
  impact_analysis jsonb,                        -- saída do impact_analyzer: { news_type, magnitude, affected_segments, sensitivity_fields }
  status text DEFAULT 'pending',                -- 'pending' | 'analyzed' | 'applied' | 'skipped'
  impact_magnitude numeric(4,3),                -- 0.0 a 1.0
  impact_direction text,                        -- 'positive' | 'negative' | 'neutral'
  affected_clusters text[],                     -- ex: {'P1','P2','M3','C5'}
  cycle_id uuid REFERENCES public.update_cycles(id)
);

ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_events_read" ON public.news_events FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_news_events_candidate ON public.news_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_news_events_created ON public.news_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_cycle ON public.news_events(cycle_id);
CREATE INDEX IF NOT EXISTS idx_news_events_url ON public.news_events(source_url);


-- ============================================================================
-- 5. TABELA: sentiment_updates
-- Auditoria: cada delta aplicado, em qual cluster, por qual notícia
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sentiment_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  news_event_id uuid REFERENCES public.news_events(id),  -- NULL se for calibração de pesquisa
  cycle_id uuid NOT NULL REFERENCES public.update_cycles(id),
  cluster_id text NOT NULL,                     -- ex: 'P1', 'M3', 'C5' ou 'P%' para macro
  candidate_id text NOT NULL REFERENCES public.candidates(id),
  delta_applied numeric(6,4),                   -- ex: +0.019, -0.002
  personas_affected integer,
  reasoning text                                -- ex: 'policy:auxilio_gas' ou 'calibracao_pesquisa:Datafolha'
);

ALTER TABLE public.sentiment_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sentiment_updates_read" ON public.sentiment_updates FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_sentiment_updates_cycle ON public.sentiment_updates(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_updates_candidate ON public.sentiment_updates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_updates_created ON public.sentiment_updates(created_at DESC);


-- ============================================================================
-- 6. TABELA: polling_anchors
-- Pesquisas eleitorais reais (Datafolha, Quaest, IPEC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.polling_anchors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  source text NOT NULL,                         -- 'Datafolha', 'Quaest', 'IPEC', 'AtlasIntel'
  poll_date date NOT NULL,
  scenario text NOT NULL DEFAULT '1turno',      -- '1turno' ou '2turno'
  results jsonb NOT NULL,                       -- {"lula": 46.0, "flavio": 47.2, "caiado": 4.5}
  source_url text,
  fetched_by text DEFAULT 'auto'                -- 'auto' (Tavily) ou 'manual' (admin)
);

ALTER TABLE public.polling_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polling_anchors_read" ON public.polling_anchors FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_polling_anchors_date ON public.polling_anchors(poll_date DESC);


-- ============================================================================
-- 7. RPCs
-- ============================================================================

-- 7a. Aplicar delta de sentimento por cluster para um candidato
CREATE OR REPLACE FUNCTION apply_sentiment_delta(
  p_cluster_prefix text,
  p_candidate_id text,
  p_delta numeric
) RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.persona_sentiments ps
  SET
    sentiment = LEAST(1.0, GREATEST(-1.0, COALESCE(sentiment, 0) + p_delta)),
    updated_at = now()
  FROM public.personas p
  WHERE ps.persona_id = p.id
    AND ps.candidate_id = p_candidate_id
    AND p.cluster_id LIKE p_cluster_prefix || '%';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7b. Criar snapshot de sentimentos (para rollback)
CREATE OR REPLACE FUNCTION create_sentiment_snapshot(p_label text) RETURNS uuid AS $$
DECLARE
  snap_id uuid;
BEGIN
  INSERT INTO public.persona_snapshots (label, data)
  SELECT p_label, jsonb_agg(jsonb_build_object(
    'persona_id', persona_id,
    'candidate_id', candidate_id,
    'sentiment', sentiment
  ))
  FROM public.persona_sentiments
  RETURNING id INTO snap_id;

  RETURN snap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7c. Restaurar sentimentos de um snapshot
CREATE OR REPLACE FUNCTION restore_sentiment_snapshot(p_snapshot_id uuid) RETURNS integer AS $$
DECLARE
  snapshot_data jsonb;
  row_data jsonb;
  affected integer := 0;
BEGIN
  SELECT data INTO snapshot_data FROM public.persona_snapshots WHERE id = p_snapshot_id;

  IF snapshot_data IS NULL THEN
    RAISE EXCEPTION 'Snapshot not found: %', p_snapshot_id;
  END IF;

  FOR row_data IN SELECT * FROM jsonb_array_elements(snapshot_data)
  LOOP
    UPDATE public.persona_sentiments
    SET
      sentiment = (row_data->>'sentiment')::numeric,
      updated_at = now()
    WHERE persona_id = (row_data->>'persona_id')::uuid
      AND candidate_id = row_data->>'candidate_id';

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7d. Distribuição de sentimentos por cluster × candidato (para tela de sentimento)
CREATE OR REPLACE FUNCTION get_sentiment_distribution() RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_data)
    FROM (
      SELECT jsonb_build_object(
        'cluster_macro', cluster_macro,
        'candidate_id', ps.candidate_id,
        'avg_sentiment', ROUND(AVG(ps.sentiment)::numeric, 4),
        'positive_count', COUNT(*) FILTER (WHERE ps.sentiment > 0.05),
        'negative_count', COUNT(*) FILTER (WHERE ps.sentiment < -0.05),
        'neutral_count', COUNT(*) FILTER (WHERE ps.sentiment BETWEEN -0.05 AND 0.05),
        'total_count', COUNT(*),
        'min_sentiment', ROUND(MIN(ps.sentiment)::numeric, 4),
        'max_sentiment', ROUND(MAX(ps.sentiment)::numeric, 4),
        'pct_positive', ROUND((COUNT(*) FILTER (WHERE ps.sentiment > 0.05))::numeric / NULLIF(COUNT(*), 0) * 100, 1)
      ) as row_data
      FROM public.persona_sentiments ps
      JOIN public.personas p ON p.id = ps.persona_id
      JOIN public.candidates c ON c.id = ps.candidate_id AND c.is_active = true
      CROSS JOIN LATERAL (SELECT LEFT(p.cluster_id, 1) as cluster_macro) cm
      GROUP BY cm.cluster_macro, ps.candidate_id
      ORDER BY cm.cluster_macro, ps.candidate_id
    ) sub
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7e. Calcular polling percentages a partir dos sentimentos
CREATE OR REPLACE FUNCTION compute_polling() RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  total_voters integer := 0;
  candidate record;
  vote_count integer;
BEGIN
  -- Para cada candidato ativo, contar personas onde ele tem o maior sentimento
  FOR candidate IN
    SELECT id FROM public.candidates WHERE is_active = true
  LOOP
    SELECT COUNT(*) INTO vote_count
    FROM (
      SELECT ps.persona_id
      FROM public.persona_sentiments ps
      JOIN public.personas p ON p.id = ps.persona_id
      WHERE ps.candidate_id = candidate.id
        AND ps.sentiment > 0.05  -- threshold mínimo (não abstém)
        AND ps.sentiment = (
          -- maior sentimento entre todos os candidatos ativos para esta persona
          SELECT MAX(ps2.sentiment)
          FROM public.persona_sentiments ps2
          JOIN public.candidates c2 ON c2.id = ps2.candidate_id AND c2.is_active = true
          WHERE ps2.persona_id = ps.persona_id
        )
        -- desempate: se dois candidatos empatam, não conta (indeciso)
        AND NOT EXISTS (
          SELECT 1 FROM public.persona_sentiments ps3
          JOIN public.candidates c3 ON c3.id = ps3.candidate_id AND c3.is_active = true
          WHERE ps3.persona_id = ps.persona_id
            AND ps3.candidate_id != candidate.id
            AND ABS(ps3.sentiment - ps.sentiment) < 0.03
            AND ps3.sentiment > 0.05
        )
        -- cluster T1 precisa de sentimento mais alto para votar
        AND (p.cluster_id != 'T1' OR ps.sentiment > 0.15)
    ) voters;

    total_voters := total_voters + vote_count;
    result := result || jsonb_build_object(candidate.id, vote_count);
  END LOOP;

  -- Converter para percentuais
  IF total_voters > 0 THEN
    FOR candidate IN
      SELECT id FROM public.candidates WHERE is_active = true
    LOOP
      UPDATE public.candidates
      SET
        polling_percent = ROUND(((result->>candidate.id)::integer * 100.0 / total_voters)::numeric, 2),
        polling_updated_at = now()
      WHERE id = candidate.id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'total_voters', total_voters,
    'votes', result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7e. Obter drift atual por cluster × candidato
CREATE OR REPLACE FUNCTION get_drift_report() RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'cluster_id', cluster_id,
      'candidate_id', candidate_id,
      'avg_drift', avg_drift,
      'max_drift', max_drift,
      'personas_count', cnt
    ))
    FROM (
      SELECT
        LEFT(p.cluster_id, 2) as cluster_id,
        ps.candidate_id,
        ROUND(AVG(ps.sentiment - COALESCE(ps.initial_sentiment, 0))::numeric, 4) as avg_drift,
        ROUND(MAX(ABS(ps.sentiment - COALESCE(ps.initial_sentiment, 0)))::numeric, 4) as max_drift,
        COUNT(*) as cnt
      FROM public.persona_sentiments ps
      JOIN public.personas p ON p.id = ps.persona_id
      GROUP BY LEFT(p.cluster_id, 2), ps.candidate_id
      ORDER BY LEFT(p.cluster_id, 2), ps.candidate_id
    ) drift
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
