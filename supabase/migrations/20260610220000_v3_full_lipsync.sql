-- ============================================================================
-- V3 Pipeline: Full Lipsync com Roteiro
--
-- Fluxo simplificado: transcreve → classifica tema → pega roteiro →
-- TTS completo → lipsync inteiro → compose (selfie + lipsync) → WhatsApp.
-- Zero junção de vídeo gravado. Zero problema de transição.
--
-- Tabelas 100% isoladas de V1 e V2.
-- ============================================================================

BEGIN;

-- ─── 1. Base model V3 ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_base_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,

  -- Video base (usado no lipsync)
  video_storage_path TEXT NOT NULL,

  -- Voz clonada
  elevenlabs_voice_id TEXT NOT NULL,
  voice_name TEXT,

  -- Lipsync config
  lipsync_config JSONB NOT NULL DEFAULT '{"model":"lipsync-2-pro","sync_mode":"loop","temperature":0.3}',

  -- TTS config (name_sync style)
  tts_config JSONB NOT NULL DEFAULT '{"speed":0.88,"style":0.4,"stability":1,"similarity_boost":1,"use_speaker_boost":false}',

  -- WhatsApp
  whatsapp_message_template TEXT NOT NULL DEFAULT 'Olá, {name}! Obrigado pela sua contribuição. Conte comigo nessa caminhada!',

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE v3_base_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v3_base_models"
  ON v3_base_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Anon read v3_base_models"
  ON v3_base_models FOR SELECT USING (true);


-- ─── 2. Roteiros por tema V3 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_theme_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_model_id UUID NOT NULL REFERENCES v3_base_models(id) ON DELETE CASCADE,
  theme_slug TEXT NOT NULL REFERENCES v2_themes_template(slug),
  script_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_model_id, theme_slug)
);

CREATE INDEX IF NOT EXISTS idx_v3_theme_scripts_base ON v3_theme_scripts(base_model_id);

ALTER TABLE v3_theme_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v3_theme_scripts"
  ON v3_theme_scripts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 3. Selfies V3 (fila de processamento) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS v3_video_selfies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_model_id UUID NOT NULL REFERENCES v3_base_models(id),

  -- Dados do eleitor
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  first_name TEXT,

  -- Selfie do eleitor
  selfie_video_path TEXT,

  -- Pipeline
  status TEXT NOT NULL DEFAULT 'recording',
  transcription TEXT,
  theme_slug TEXT REFERENCES v2_themes_template(slug),
  script_text TEXT,
  generated_text TEXT,
  tts_audio_path TEXT,
  lipsync_video_url TEXT,
  lipsync_cached_path TEXT,
  cached_from UUID REFERENCES v3_video_selfies(id),
  final_video_path TEXT,

  -- WhatsApp
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_provider TEXT,
  whatsapp_button_clicked_at TIMESTAMPTZ,

  -- Worker locking
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Error
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v3_video_selfies_status ON v3_video_selfies(status);
CREATE INDEX IF NOT EXISTS idx_v3_video_selfies_phone ON v3_video_selfies(phone);
CREATE INDEX IF NOT EXISTS idx_v3_selfies_lipsync_cache
  ON v3_video_selfies (base_model_id, first_name, theme_slug)
  WHERE lipsync_cached_path IS NOT NULL
    AND cached_from IS NULL
    AND status = 'completed';

ALTER TABLE v3_video_selfies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v3_video_selfies"
  ON v3_video_selfies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Anon insert v3_video_selfies"
  ON v3_video_selfies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon read v3_video_selfies"
  ON v3_video_selfies FOR SELECT USING (true);


-- ─── 4. RPCs V3 ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.v3_claim_next_selfie(worker_id uuid DEFAULT NULL)
RETURNS SETOF v3_video_selfies
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE v3_video_selfies
  SET status = 'transcribing',
      locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM v3_video_selfies
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.v3_claim_stuck_selfie(worker_id uuid)
RETURNS SETOF v3_video_selfies
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE v3_video_selfies
  SET locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM v3_video_selfies
    WHERE status IN ('transcribing','generating_text','generating_tts','generating_lipsync','composing','sending')
      AND whatsapp_sent IS NOT TRUE
      AND (
        locked_at IS NULL
        OR (status = 'generating_lipsync' AND locked_at < now() - interval '10 minutes')
        OR (status != 'generating_lipsync' AND locked_at < now() - interval '60 seconds')
      )
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.v3_watchdog_stuck_selfies()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH done AS (
    UPDATE v3_video_selfies
    SET status = 'completed',
        error_message = COALESCE(error_message, '') || ' [v3-watchdog: auto-completed]',
        locked_by = NULL, locked_at = NULL, updated_at = now()
    WHERE status = 'sending' AND whatsapp_sent = TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  ) SELECT count(*)::int INTO v_count FROM done;

  WITH failed AS (
    UPDATE v3_video_selfies
    SET status = 'failed',
        error_message = COALESCE(error_message, '') || ' [v3-watchdog: stuck >30min in ' || status || ']',
        locked_by = NULL, locked_at = NULL, updated_at = now()
    WHERE status IN ('transcribing','generating_text','generating_tts','generating_lipsync','composing','sending')
      AND whatsapp_sent IS NOT TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  ) SELECT v_count + count(*)::int INTO v_count FROM failed;

  WITH abandoned AS (
    UPDATE v3_video_selfies
    SET status = 'failed',
        error_message = 'v3-watchdog: upload abandonado',
        updated_at = now()
    WHERE status = 'uploading'
      AND updated_at < now() - interval '10 minutes'
    RETURNING id
  ) SELECT v_count + count(*)::int INTO v_count FROM abandoned;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.v3_claim_whatsapp_send(selfie_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated boolean;
BEGIN
  UPDATE v3_video_selfies
  SET whatsapp_sent = TRUE, whatsapp_sent_at = now(), updated_at = now()
  WHERE id = selfie_id AND whatsapp_sent IS NOT TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;


-- ─── 5. Seed: base model + roteiros ─────────────────────────────────────────

INSERT INTO v3_base_models (
  slug, name, display_name,
  video_storage_path, elevenlabs_voice_id, voice_name,
  lipsync_config, tts_config, whatsapp_message_template, is_active
)
SELECT
  'mariadocarmo-v3',
  'Maria do Carmo V3',
  'Maria do Carmo',
  bm.video_storage_path,
  vm.elevenlabs_voice_id,
  vm.name,
  COALESCE(bm.lipsync_config, '{"model":"lipsync-2-pro","sync_mode":"loop","temperature":0.3}'::jsonb),
  '{"speed":0.88,"style":0.4,"stability":1,"similarity_boost":1,"use_speaker_boost":false}'::jsonb,
  COALESCE(bm.whatsapp_message_template, 'Olá, {name}! Obrigado pela sua contribuição.'),
  TRUE
FROM video_base_models bm
JOIN voice_models vm ON vm.id = bm.voice_model_id
WHERE bm.slug = 'mariadocarmo'
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Roteiros extraídos dos vídeos gravados (Whisper)
INSERT INTO v3_theme_scripts (base_model_id, theme_slug, script_text)
SELECT bm.id, vals.slug, vals.script
FROM v3_base_models bm,
(VALUES
  ('educacao', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Educação de qualidade e combate à evasão escolar são assuntos muito importantes para o nosso plano de governo, porque investir nos jovens é investir no futuro do Amazonas. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('saude_interior', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A saúde pública e o acesso ao atendimento no interior são assuntos muito importantes para o nosso plano de governo, porque ninguém merece passar horas viajando para conseguir atendimento médico. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('seguranca_crime_organizado', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Segurança pública, combate ao crime organizado são assuntos muito importantes para o nosso plano de governo, porque a população merece viver com mais paz, proteção e tranquilidade. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('zona_franca_manaus', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Defender a Zona Franca de Manaus é um assunto muito importante para o nosso plano de governo, porque ela garante empregos, movimenta a economia e protege milhares de famílias amazonenses. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('saneamento_basico', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Saneamento básico e água tratada são assuntos muito importantes para o nosso plano de governo, porque saúde e dignidade precisam chegar para todas as famílias amazonenses. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('emprego_interior', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A geração de emprego e renda no interior é um assunto muito importante para o nosso plano de governo, porque o desenvolvimento precisa chegar para todos os municípios do Amazonas. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('seca_clima', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O enfrentamento da seca e dos eventos climáticos extremos é um assunto muito importante para o nosso plano de governo, porque milhares de famílias sofrem todos os anos com esses impactos. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('transporte_fluvial', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O transporte fluvial e a mobilidade no interior são assuntos muito importantes para o nosso plano de governo, porque muitas comunidades dependem dos rios para viver e se deslocar com segurança. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('habitacao', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Habitação e moradia digna são assuntos muito importantes para o nosso plano de governo, porque muitas famílias ainda vivem em áreas de risco e sem infraestrutura adequada. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('desmatamento', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O combate ao desmatamento e às queimadas é um assunto muito importante para o nosso plano de governo, porque proteger a floresta é proteger o futuro do Amazonas. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('internet_interior', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Internet e conectividade digital são assuntos muito importantes para o nosso plano de governo, porque acesso à tecnologia também significa inclusão, educação e oportunidade. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('energia_interior', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Energia elétrica de qualidade no interior é um assunto muito importante para o nosso plano de governo, porque desenvolvimento também passa por infraestrutura e dignidade. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('violencia_mulher', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O combate à violência contra a mulher é um assunto muito importante para o nosso plano de governo, porque nenhuma mulher pode viver com medo ou sem proteção. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('povos_indigenas', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A proteção aos povos indígenas é um assunto muito importante para o nosso plano de governo, porque respeito, saúde e dignidade precisam ser garantidos a todos. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('mobilidade_manaus', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A mobilidade urbana em Manaus é um assunto muito importante para o nosso plano de governo, porque a população merece um transporte mais eficiente e uma cidade mais organizada. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('custo_vida', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O alto custo de vida e o preço dos alimentos são assuntos muito importantes para o nosso plano de governo, porque muitas famílias estão tendo dificuldade até para garantir o básico dentro de casa. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('bioeconomia', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O agronegócio é um assunto muito importante para o nosso plano de governo, porque fortalecer o produtor rural é gerar emprego, renda e desenvolvimento para o Amazonas. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('turismo_ecologico', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O turismo ecológico e sustentável é um assunto muito importante para o nosso plano de governo, porque pode gerar emprego, renda e desenvolvimento para o nosso Estado. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('assistencia_social', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O fortalecimento da assistência social e o combate à pobreza são assuntos muito importantes para o nosso plano de governo, porque cuidar das pessoas mais vulneráveis deve ser prioridade. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('concursos_publicos', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Concursos públicos e valorização do serviço público são assuntos muito importantes para o nosso plano de governo, porque o Amazonas precisa de profissionais preparados para atender bem a população. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('regularizacao_fundiaria', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Regularização fundiária é um assunto muito importante para o nosso plano de governo, porque garantir segurança jurídica é garantir dignidade para milhares de famílias. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('saude_mental', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Saúde mental e combate à dependência química são assuntos muito importantes para o nosso plano de governo, porque milhares de famílias convivem diariamente com essa realidade. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('protecao_crianca', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A proteção à criança e ao adolescente é um assunto muito importante para o nosso plano de governo, porque cuidar da infância é cuidar do futuro do Amazonas. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('residuos_solidos', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. A gestão de resíduos sólidos e o combate ao descarte irregular de lixo são assuntos muito importantes para o nosso plano de governo, porque preservar o meio ambiente também é cuidar da saúde da população. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('ciencia_tecnologia', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Ciência, tecnologia e inovação são assuntos muito importantes para o nosso plano de governo, porque o Amazonas tem potencial para ser referência em pesquisa e desenvolvimento sustentável. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('transporte_aereo', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. O transporte aéreo regional é um assunto muito importante para o nosso plano de governo, porque muitos municípios dependem dele para garantir acesso, mobilidade e desenvolvimento. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('transparencia_governanca', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Transparência, combate à corrupção e boa governança são assuntos muito importantes para o nosso plano de governo, porque o povo merece respeito, honestidade e responsabilidade na gestão pública. Conte comigo para tratar esse tema com responsabilidade, atenção e seriedade.'),
  ('padrao', '{nome}, muito obrigada pela sua mensagem e pela sua contribuição. Conte comigo nessa caminhada para construir um Amazonas melhor para todos. Juntos, com responsabilidade, atenção e seriedade, vamos transformar o nosso estado.')
) AS vals(slug, script)
WHERE bm.slug = 'mariadocarmo-v3'
ON CONFLICT (base_model_id, theme_slug) DO NOTHING;

COMMIT;
