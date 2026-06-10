-- ============================================================================
-- V2 Pipeline: mariadocarmo-new
--
-- Tabelas 100% isoladas do pipeline V1. Nenhuma FK cruzada, nenhum RPC
-- compartilhado. Pode deletar esta migration inteira pra reverter tudo.
-- ============================================================================

BEGIN;

-- ─── 1. Temas V2 (cópia independente dos 31 temas do AM) ──────────────────

CREATE TABLE IF NOT EXISTS v2_themes_template (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO v2_themes_template (slug, label, category, priority, description, is_default, display_order) VALUES
('zona_franca_manaus', 'Defesa e Futuro da Zona Franca de Manaus', 'Economia e Emprego', 'CRITICA', 'O Polo Industrial de Manaus (PIM) sustenta 500 mil empregos diretos e indiretos e é alvo constante de pressões legislativas na reforma tributária. A perda de incentivos ameaça colapso econômico regional.', FALSE, 1),
('emprego_interior', 'Geração de Emprego e Renda no Interior', 'Economia e Emprego', 'CRITICA', 'A concentração econômica em Manaus deixa os 61 municípios do interior com altas taxas de informalidade, pobreza e dependência de transferências.', FALSE, 2),
('saude_interior', 'Saúde Pública - Acesso no Interior', 'Saude', 'CRITICA', 'Populações ribeirinhas percorrem horas de barco para atendimento básico. Falta de médicos especialistas, UTIs e leitos hospitalares fora de Manaus.', FALSE, 3),
('saneamento_basico', 'Saneamento Básico e Água Tratada', 'Infraestrutura', 'CRITICA', 'Apenas ~19%% dos domicílios na Amazônia Legal têm rede coletora de esgoto. Manaus tem bairros sem coleta; interior depende de água de rio sem tratamento.', FALSE, 4),
('seguranca_crime_organizado', 'Segurança Pública e Combate ao Crime Organizado', 'Seguranca Publica', 'CRITICA', 'A Amazônia virou rota do narcotráfico e a taxa de homicídios é muito superior à média nacional. Facções disputam territórios no interior e na periferia de Manaus.', FALSE, 5),
('educacao', 'Educação - Qualidade e Evasão Escolar', 'Educacao', 'CRITICA', 'Altas taxas de evasão, baixo desempenho no IDEB, escolas ribeirinhas com infraestrutura precária. Jovens nem-nem em proporção alarmante.', FALSE, 6),
('seca_clima', 'Seca e Eventos Climáticos Extremos', 'Meio Ambiente', 'ALTA', 'A seca de 2023-2024 isolou comunidades, matou animais aquáticos e deixou 250 mil pessoas sem acesso a água e alimentos.', FALSE, 7),
('transporte_fluvial', 'Transporte Fluvial e Mobilidade no Interior', 'Infraestrutura', 'ALTA', 'Rios são as rodovias do Amazonas. Barcos precários, sem fiscalização, com naufrágios recorrentes.', FALSE, 8),
('habitacao', 'Habitação e Déficit Habitacional', 'Social', 'ALTA', 'Manaus tem extensas áreas de palafitas e ocupações irregulares em igarapés. Déficit habitacional é um dos maiores do Norte.', FALSE, 9),
('desmatamento', 'Desmatamento e Queimadas', 'Meio Ambiente', 'ALTA', 'O AM preserva ~97%% de floresta, mas a pressão avança pelo sul. Queimadas recordes em 2024.', FALSE, 10),
('internet_interior', 'Internet e Conectividade Digital', 'Infraestrutura', 'ALTA', 'Municípios do interior do AM estão entre os menos conectados do Brasil.', FALSE, 11),
('energia_interior', 'Energia Elétrica no Interior', 'Infraestrutura', 'ALTA', 'Dezenas de comunidades dependem de geradores a diesel caros e poluentes, com fornecimento intermitente.', FALSE, 12),
('violencia_mulher', 'Violência Contra a Mulher', 'Seguranca Publica', 'ALTA', 'O AM tem uma das maiores taxas de feminicídio do país. Delegacias da Mulher são insuficientes.', FALSE, 13),
('povos_indigenas', 'Povos Indígenas - Saúde, Terra e Direitos', 'Social', 'ALTA', 'Crise humanitária Yanomami expôs desnutrição, malária e garimpo ilegal. O AM tem a maior população indígena do Brasil.', FALSE, 14),
('mobilidade_manaus', 'Mobilidade Urbana em Manaus', 'Infraestrutura', 'ALTA', 'Trânsito caótico, transporte coletivo precário e caro, vias alagáveis, falta de ciclovias.', FALSE, 15),
('custo_vida', 'Custo de Vida e Preços de Alimentos', 'Economia e Emprego', 'ALTA', 'O isolamento logístico do AM encarece tudo: alimentos, combustível, materiais de construção.', FALSE, 16),
('bioeconomia', 'Bioeconomia e Aproveitamento da Floresta em Pé', 'Economia e Emprego', 'MEDIA', 'O AM tem a maior biodiversidade do planeta, mas ainda não transformou isso em riqueza estruturada.', FALSE, 17),
('turismo_ecologico', 'Turismo Ecológico e Sustentável', 'Economia e Emprego', 'MEDIA', 'O potencial turístico é enorme mas infraestrutura receptiva é fraca, voos caros, pouca promoção.', FALSE, 18),
('assistencia_social', 'Assistência Social e Combate à Pobreza Extrema', 'Social', 'ALTA', 'Bolsões de miséria persistem no interior profundo e nas periferias de Manaus.', FALSE, 19),
('concursos_publicos', 'Concursos Públicos e Serviço Público', 'Governanca', 'MEDIA', 'Déficit de servidores em áreas essenciais. Milhares de vagas previstas para 2026.', FALSE, 20),
('fronteiras', 'Fronteiras e Soberania Nacional', 'Seguranca Publica', 'MEDIA', 'O AM faz fronteira com Colômbia, Venezuela e Peru. Tráfico, contrabando e imigração irregular.', FALSE, 21),
('regularizacao_fundiaria', 'Regularização Fundiária', 'Social', 'MEDIA', 'Grande parte dos imóveis do AM não tem título de propriedade, impedindo acesso a crédito.', FALSE, 22),
('saude_mental', 'Saúde Mental e Dependência Química', 'Saude', 'MEDIA', 'Aumento de transtornos mentais, suicídio juvenil e dependência de drogas nas periferias.', FALSE, 23),
('protecao_crianca', 'Proteção à Criança e ao Adolescente', 'Social', 'ALTA', 'Trabalho infantil, abuso sexual, abandono escolar e recrutamento por facções.', FALSE, 24),
('residuos_solidos', 'Gestão de Resíduos Sólidos (Lixo)', 'Meio Ambiente', 'MEDIA', 'Manaus ainda opera com lixão a céu aberto. Municípios do interior despejam lixo em rios.', FALSE, 25),
('reforma_tributaria', 'Reforma Tributária - Impactos no AM', 'Economia e Emprego', 'ALTA', 'A transição do modelo tributário nacional pode afetar a competitividade da ZFM.', FALSE, 26),
('cultura_identidade', 'Cultura, Identidade e Patrimônio Amazônico', 'Social', 'MEDIA', 'Festival de Parintins, tradições ribeirinhas, culturas indígenas são subvalorizados.', FALSE, 27),
('ciencia_tecnologia', 'Ciência, Tecnologia e Inovação', 'Economia e Emprego', 'MEDIA', 'INPA, UFAM e UEA produzem pesquisa de ponta, mas a conexão com indústria é fraca.', FALSE, 28),
('transporte_aereo', 'Transporte Aéreo Regional', 'Infraestrutura', 'MEDIA', 'Muitos municípios só são acessíveis por avião em parte do ano, mas voos regionais são caríssimos.', FALSE, 29),
('transparencia_governanca', 'Transparência, Combate à Corrupção e Governança', 'Governanca', 'MEDIA', 'Histórico de escândalos, baixa transparência de gastos, dificuldade de fiscalização no interior remoto.', FALSE, 30),
('padrao', 'Tema Padrão (fallback)', 'Geral', NULL, 'Vídeo genérico usado quando o tema do depoimento do eleitor não se encaixa em nenhum dos 30 temas específicos.', TRUE, 99)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE v2_themes_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v2_themes_template"
  ON v2_themes_template FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon pode ler temas (frontend precisa listar)
CREATE POLICY "Anon read v2_themes_template"
  ON v2_themes_template FOR SELECT
  USING (true);


-- ─── 2. Modelo base V2 ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v2_base_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,

  -- Video base (neutro, fallback quando tema não tem vídeo)
  video_storage_path TEXT NOT NULL,

  -- Voz clonada (ElevenLabs voice_id direto, sem FK pra voice_models)
  elevenlabs_voice_id TEXT NOT NULL,
  voice_name TEXT,

  -- Prompt pra GPT gerar resposta (usado no fluxo full_video/legacy)
  prompt_template TEXT NOT NULL DEFAULT '',

  -- Strategy: 'name_sync' ou 'full_video'
  video_strategy TEXT NOT NULL DEFAULT 'name_sync',

  -- Greeting: template do TTS curto do name_sync. {nome} = primeiro nome.
  greeting_template TEXT NOT NULL DEFAULT '{nome}, obrigado pelo seu vídeo!',

  -- Segundos da intro neutra do vídeo do tema que o compose deve pular
  theme_intro_seconds NUMERIC NOT NULL DEFAULT 4.9,

  -- Lipsync config (model, sync_mode, temperature, tts settings)
  lipsync_config JSONB NOT NULL DEFAULT '{"model":"lipsync-2-pro","sync_mode":"loop","temperature":0.3}',

  -- Closing video + music
  closing_video_path TEXT DEFAULT 'assets/closing_video.mp4',
  closing_music_path TEXT DEFAULT 'assets/closing_music.mp3',

  -- WhatsApp
  whatsapp_message_template TEXT NOT NULL DEFAULT 'Olá, {name}! Obrigado pela sua mensagem!',
  whatsapp_number TEXT,
  thank_you_message TEXT,

  -- Proposta PDF
  proposta_pdf_path TEXT,
  proposta_message_template TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT v2_base_models_video_strategy_check
    CHECK (video_strategy IN ('name_sync', 'full_video'))
);

ALTER TABLE v2_base_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v2_base_models"
  ON v2_base_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon pode ler (frontend precisa do base_model_id pelo slug)
CREATE POLICY "Anon read v2_base_models"
  ON v2_base_models FOR SELECT
  USING (true);


-- ─── 3. Vídeos por tema V2 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS v2_theme_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_model_id UUID NOT NULL REFERENCES v2_base_models(id) ON DELETE CASCADE,
  theme_slug TEXT NOT NULL REFERENCES v2_themes_template(slug),
  video_storage_path TEXT,
  is_uploaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_model_id, theme_slug)
);

CREATE INDEX IF NOT EXISTS idx_v2_theme_models_base ON v2_theme_models(base_model_id);
CREATE INDEX IF NOT EXISTS idx_v2_theme_models_uploaded
  ON v2_theme_models(base_model_id, theme_slug) WHERE is_uploaded = TRUE;

ALTER TABLE v2_theme_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v2_theme_models"
  ON v2_theme_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 4. Selfies V2 (fila de processamento) ────────────────────────────────

CREATE TABLE IF NOT EXISTS v2_video_selfies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_model_id UUID NOT NULL REFERENCES v2_base_models(id),

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
  generated_text TEXT,
  tts_processed_text TEXT,
  tts_audio_path TEXT,
  lipsync_job_id TEXT,
  lipsync_video_url TEXT,
  final_video_path TEXT,
  video_strategy TEXT,

  -- Cache
  name_sync_cached_path TEXT,
  lipsync_cached_path TEXT,
  cached_from UUID REFERENCES v2_video_selfies(id),
  category TEXT,

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

CREATE INDEX IF NOT EXISTS idx_v2_video_selfies_status ON v2_video_selfies(status);
CREATE INDEX IF NOT EXISTS idx_v2_video_selfies_phone ON v2_video_selfies(phone);
CREATE INDEX IF NOT EXISTS idx_v2_video_selfies_base_model ON v2_video_selfies(base_model_id);

-- Cache name_sync: (base_model_id, first_name, theme_slug)
CREATE INDEX IF NOT EXISTS idx_v2_selfies_name_sync_cache
  ON v2_video_selfies (base_model_id, first_name, theme_slug)
  WHERE name_sync_cached_path IS NOT NULL
    AND status = 'completed';

-- Cache lipsync: (base_model_id, first_name, theme_slug)
CREATE INDEX IF NOT EXISTS idx_v2_selfies_lipsync_cache
  ON v2_video_selfies (base_model_id, first_name, theme_slug)
  WHERE lipsync_cached_path IS NOT NULL
    AND cached_from IS NULL
    AND status = 'completed';

ALTER TABLE v2_video_selfies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on v2_video_selfies"
  ON v2_video_selfies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon pode inserir (frontend faz upload) e ler status
CREATE POLICY "Anon insert v2_video_selfies"
  ON v2_video_selfies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon read own v2_video_selfies"
  ON v2_video_selfies FOR SELECT
  USING (true);


-- ─── 5. RPCs V2 (claim, stuck, watchdog) ──────────────────────────────────

-- Claim: pega o mais antigo com status 'queued'
CREATE OR REPLACE FUNCTION public.v2_claim_next_selfie(worker_id uuid DEFAULT NULL)
RETURNS SETOF v2_video_selfies
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE v2_video_selfies
  SET status = 'transcribing',
      locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM v2_video_selfies
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- Claim stuck: pega selfie travada (lock expirado)
CREATE OR REPLACE FUNCTION public.v2_claim_stuck_selfie(worker_id uuid)
RETURNS SETOF v2_video_selfies
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE v2_video_selfies
  SET locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM v2_video_selfies
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

-- Watchdog: auto-fail selfies travadas
CREATE OR REPLACE FUNCTION public.v2_watchdog_stuck_selfies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_count integer := 0;
  v_completed_count integer := 0;
  v_upload_failed integer := 0;
BEGIN
  -- Auto-completa: WhatsApp já saiu mas worker perdeu tracking
  WITH done AS (
    UPDATE v2_video_selfies
    SET status = 'completed',
        error_message = COALESCE(error_message, '') ||
                        ' [v2-watchdog: auto-completed (whatsapp_sent=true, stuck >30min)]',
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE status = 'sending'
      AND whatsapp_sent = TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_completed_count FROM done;

  -- Auto-falha: travado em passo intermediário
  WITH failed AS (
    UPDATE v2_video_selfies
    SET status = 'failed',
        error_message = COALESCE(error_message, '') ||
                        ' [v2-watchdog: stuck >30min in ' || status || ']',
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE status IN (
        'transcribing','generating_text','generating_tts',
        'generating_lipsync','composing','sending'
      )
      AND whatsapp_sent IS NOT TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_failed_count FROM failed;

  -- Auto-falha: uploads abandonados
  WITH abandoned AS (
    UPDATE v2_video_selfies
    SET status = 'failed',
        error_message = 'v2-watchdog: upload abandonado (>10min sem confirm)',
        updated_at = now()
    WHERE status = 'uploading'
      AND updated_at < now() - interval '10 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_upload_failed FROM abandoned;

  RETURN v_failed_count + v_completed_count + v_upload_failed;
END;
$$;

-- Claim WhatsApp send (atomic, evita duplicação)
CREATE OR REPLACE FUNCTION public.v2_claim_whatsapp_send(selfie_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE v2_video_selfies
  SET whatsapp_sent = TRUE,
      whatsapp_sent_at = now(),
      updated_at = now()
  WHERE id = selfie_id
    AND whatsapp_sent IS NOT TRUE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;


-- ─── 6. Seed: modelo base da Maria do Carmo (mariadocarmo-new) ────────────
--
-- Puxa elevenlabs_voice_id e video_storage_path direto da jornada oficial
-- (slug 'mariadocarmo' em video_base_models + voice_models). Assim o V2
-- usa exatamente a mesma voz clonada sem hardcodar IDs que podem mudar.

INSERT INTO v2_base_models (
  slug,
  name,
  display_name,
  video_storage_path,
  elevenlabs_voice_id,
  voice_name,
  video_strategy,
  greeting_template,
  theme_intro_seconds,
  lipsync_config,
  closing_video_path,
  closing_music_path,
  whatsapp_message_template,
  thank_you_message,
  prompt_template,
  is_active
)
SELECT
  'mariadocarmo-new',
  'Maria do Carmo V2',
  'Maria do Carmo',
  bm.video_storage_path,
  vm.elevenlabs_voice_id,
  vm.name,
  COALESCE(bm.video_strategy, 'name_sync'),
  COALESCE((bm.lipsync_config->>'greeting_template'), '{nome}, obrigado pela sua mensagem!'),
  COALESCE(bm.theme_intro_seconds, 4.9),
  COALESCE(bm.lipsync_config, '{"model":"lipsync-2-pro","sync_mode":"loop","temperature":0.3}'::jsonb),
  bm.closing_video_path,
  'assets/closing_music.mp3',
  bm.whatsapp_message_template,
  bm.thank_you_message,
  '',
  TRUE
FROM video_base_models bm
JOIN voice_models vm ON vm.id = bm.voice_model_id
WHERE bm.slug = 'mariadocarmo'
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Cria as 31 linhas de tema pro modelo (todas is_uploaded=false por enquanto)
INSERT INTO v2_theme_models (base_model_id, theme_slug)
SELECT bm.id, tt.slug
FROM v2_base_models bm
CROSS JOIN v2_themes_template tt
WHERE bm.slug = 'mariadocarmo-new'
ON CONFLICT (base_model_id, theme_slug) DO NOTHING;

COMMIT;
