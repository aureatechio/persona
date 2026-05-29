-- Arquitetura nova de cache por tema (Amazonas)
--
-- O candidato grava 30 vídeos pré-prontos, um por tema latente do AM,
-- mais 1 vídeo padrão (fallback). O eleitor manda a selfie + fala, o
-- classifier escolhe 1 dos 31 temas, e a composição final é:
--     selfie_eleitor + sync_do_nome (3s) + video_do_tema + closing
--
-- Reduz custo de ~$2/vídeo para ~$0.10-0.20 e o tempo de ~6min para <1min.
-- Quando o candidato não enviou o vídeo do tema (is_uploaded=false),
-- worker cai no fluxo antigo (gera resposta completa com GPT+TTS+lipsync).

-- ─── Tabela fonte de verdade dos 31 temas (read-only após seed) ───
CREATE TABLE IF NOT EXISTS themes_template (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO themes_template (slug, label, category, priority, description, is_default, display_order) VALUES
('zona_franca_manaus', 'Defesa e Futuro da Zona Franca de Manaus', 'Economia e Emprego', 'CRITICA', 'O Polo Industrial de Manaus (PIM) sustenta 500 mil empregos diretos e indiretos e é alvo constante de pressões legislativas na reforma tributária. A perda de incentivos ameaça colapso econômico regional.', FALSE, 1),
('emprego_interior', 'Geração de Emprego e Renda no Interior', 'Economia e Emprego', 'CRITICA', 'A concentração econômica em Manaus deixa os 61 municípios do interior com altas taxas de informalidade, pobreza e dependência de transferências. Rendimento per capita do AM (R$ 1.484) é dos mais baixos do país.', FALSE, 2),
('saude_interior', 'Saúde Pública - Acesso no Interior', 'Saude', 'CRITICA', 'Populações ribeirinhas percorrem horas de barco para atendimento básico. Falta de médicos especialistas, UTIs e leitos hospitalares fora de Manaus. Trauma da crise de oxigênio na pandemia.', FALSE, 3),
('saneamento_basico', 'Saneamento Básico e Água Tratada', 'Infraestrutura', 'CRITICA', 'Apenas ~19% dos domicílios na Amazônia Legal têm rede coletora de esgoto. Manaus tem bairros sem coleta; interior depende de água de rio sem tratamento.', FALSE, 4),
('seguranca_crime_organizado', 'Segurança Pública e Combate ao Crime Organizado', 'Seguranca Publica', 'CRITICA', 'A Amazônia virou rota do narcotráfico e a taxa de homicídios (~33/100 mil hab.) é muito superior à média nacional. Facções disputam territórios no interior e na periferia de Manaus.', FALSE, 5),
('educacao', 'Educação - Qualidade e Evasão Escolar', 'Educacao', 'CRITICA', 'Altas taxas de evasão (especialmente Ensino Médio), baixo desempenho no IDEB, escolas ribeirinhas com infraestrutura precária. Jovens nem-nem em proporção alarmante.', FALSE, 6),
('seca_clima', 'Seca e Eventos Climáticos Extremos', 'Meio Ambiente', 'ALTA', 'A seca de 2023-2024 isolou comunidades, matou animais aquáticos e deixou 250 mil pessoas sem acesso a água e alimentos. 42 dos 62 municípios declararam emergência.', FALSE, 7),
('transporte_fluvial', 'Transporte Fluvial e Mobilidade no Interior', 'Infraestrutura', 'ALTA', 'Rios são as rodovias do Amazonas. Barcos precários, sem fiscalização, com naufrágios recorrentes. Na seca, comunidades ficam completamente isoladas.', FALSE, 8),
('habitacao', 'Habitação e Déficit Habitacional', 'Social', 'ALTA', 'Manaus tem extensas áreas de palafitas e ocupações irregulares em igarapés. Déficit habitacional é um dos maiores do Norte. Enchentes periódicas destroem moradias.', FALSE, 9),
('desmatamento', 'Desmatamento e Queimadas', 'Meio Ambiente', 'ALTA', 'O AM preserva ~97% de floresta, mas a pressão avança pelo sul. Queimadas recordes em 2024. Mineração ilegal ocupa 246 mil hectares.', FALSE, 10),
('internet_interior', 'Internet e Conectividade Digital', 'Infraestrutura', 'ALTA', 'Municípios do interior do AM estão entre os menos conectados do Brasil. Sem internet, não há telemedicina, educação a distância, acesso a serviços bancários ou informação.', FALSE, 11),
('energia_interior', 'Energia Elétrica no Interior', 'Infraestrutura', 'ALTA', 'Dezenas de comunidades dependem de geradores a diesel caros e poluentes, com fornecimento intermitente. Matriz energética limpa é subutilizada.', FALSE, 12),
('violencia_mulher', 'Violência Contra a Mulher', 'Seguranca Publica', 'ALTA', 'O AM tem uma das maiores taxas de feminicídio do país. Delegacias da Mulher são insuficientes, especialmente no interior. Subnotificação é enorme.', FALSE, 13),
('povos_indigenas', 'Povos Indígenas - Saúde, Terra e Direitos', 'Social', 'ALTA', 'Crise humanitária Yanomami expôs desnutrição, malária e garimpo ilegal. O AM tem a maior população indígena do Brasil. Demarcação, saúde e educação diferenciada são urgentes.', FALSE, 14),
('mobilidade_manaus', 'Mobilidade Urbana em Manaus', 'Infraestrutura', 'ALTA', 'Trânsito caótico, transporte coletivo precário e caro, vias alagáveis, falta de ciclovias. A cidade cresceu desordenadamente.', FALSE, 15),
('custo_vida', 'Custo de Vida e Preços de Alimentos', 'Economia e Emprego', 'ALTA', 'O isolamento logístico do AM encarece tudo: alimentos, combustível, materiais de construção. Frete fluvial eleva o custo de vida acima da média nacional.', FALSE, 16),
('bioeconomia', 'Bioeconomia e Aproveitamento da Floresta em Pé', 'Economia e Emprego', 'MEDIA', 'O AM tem a maior biodiversidade do planeta, mas ainda não transformou isso em riqueza estruturada. Açaí, castanha, óleos, fitoterápicos e créditos de carbono.', FALSE, 17),
('turismo_ecologico', 'Turismo Ecológico e Sustentável', 'Economia e Emprego', 'MEDIA', 'O potencial turístico é enorme (Encontro das Águas, Anavilhanas, Pico da Neblina, Festival de Parintins) mas infraestrutura receptiva é fraca, voos caros, pouca promoção.', FALSE, 18),
('assistencia_social', 'Assistência Social e Combate à Pobreza Extrema', 'Social', 'ALTA', 'Bolsões de miséria persistem no interior profundo e nas periferias de Manaus. Insegurança alimentar atinge comunidades ribeirinhas.', FALSE, 19),
('concursos_publicos', 'Concursos Públicos e Serviço Público', 'Governanca', 'MEDIA', 'Déficit de servidores em áreas essenciais (saúde, educação, segurança, assistência social). Milhares de vagas previstas para 2026.', FALSE, 20),
('fronteiras', 'Fronteiras e Soberania Nacional', 'Seguranca Publica', 'MEDIA', 'O AM faz fronteira com Colômbia, Venezuela e Peru. Tráfico de drogas, armas, contrabando e imigração irregular cruzam fronteiras fluviais pouco vigiadas.', FALSE, 21),
('regularizacao_fundiaria', 'Regularização Fundiária', 'Social', 'MEDIA', 'Grande parte dos imóveis urbanos e rurais do AM não tem título de propriedade, impedindo acesso a crédito, investimento e segurança jurídica.', FALSE, 22),
('saude_mental', 'Saúde Mental e Dependência Química', 'Saude', 'MEDIA', 'Aumento de transtornos mentais, suicídio juvenil e dependência de drogas (especialmente crack) nas periferias de Manaus e cidades do interior.', FALSE, 23),
('protecao_crianca', 'Proteção à Criança e ao Adolescente', 'Social', 'ALTA', 'Trabalho infantil, abuso sexual, abandono escolar e recrutamento por facções atingem crianças e jovens em áreas vulneráveis.', FALSE, 24),
('residuos_solidos', 'Gestão de Resíduos Sólidos (Lixo)', 'Meio Ambiente', 'MEDIA', 'Manaus ainda opera com lixão a céu aberto. Municípios do interior despejam lixo em rios e áreas de mata. Reciclagem praticamente inexistente.', FALSE, 25),
('reforma_tributaria', 'Reforma Tributária - Impactos no AM', 'Economia e Emprego', 'ALTA', 'A transição do modelo tributário nacional pode afetar a competitividade da ZFM. O estado precisa se posicionar para garantir a manutenção dos diferenciais fiscais.', FALSE, 26),
('cultura_identidade', 'Cultura, Identidade e Patrimônio Amazônico', 'Social', 'MEDIA', 'Festival de Parintins, tradições ribeirinhas, culturas indígenas e patrimônio arqueológico são subvalorizados e subfinanciados.', FALSE, 27),
('ciencia_tecnologia', 'Ciência, Tecnologia e Inovação', 'Economia e Emprego', 'MEDIA', 'INPA, UFAM e UEA produzem pesquisa de ponta, mas a conexão com indústria e setor produtivo é fraca. O AM pode ser hub de biotecnologia.', FALSE, 28),
('transporte_aereo', 'Transporte Aéreo Regional', 'Infraestrutura', 'MEDIA', 'Muitos municípios só são acessíveis por avião em parte do ano, mas voos regionais são caríssimos ou inexistentes. Pistas precárias limitam operações.', FALSE, 29),
('transparencia_governanca', 'Transparência, Combate à Corrupção e Governança', 'Governanca', 'MEDIA', 'Histórico de escândalos, baixa transparência de gastos, dificuldade de fiscalização no interior remoto. TCE e MP subequipados.', FALSE, 30),
('padrao', 'Tema Padrão (fallback)', 'Geral', NULL, 'Vídeo genérico usado quando o tema do depoimento do eleitor não se encaixa em nenhum dos 30 temas latentes específicos do estado.', TRUE, 99)
ON CONFLICT (slug) DO NOTHING;

-- ─── Tabela de instâncias por base_model (1 row por (politico, tema)) ───
CREATE TABLE IF NOT EXISTS video_theme_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_model_id UUID NOT NULL REFERENCES video_base_models(id) ON DELETE CASCADE,
  theme_slug TEXT NOT NULL REFERENCES themes_template(slug),
  video_storage_path TEXT,
  is_uploaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_model_id, theme_slug)
);

CREATE INDEX IF NOT EXISTS idx_video_theme_models_base ON video_theme_models(base_model_id);
CREATE INDEX IF NOT EXISTS idx_video_theme_models_uploaded ON video_theme_models(base_model_id, theme_slug) WHERE is_uploaded = TRUE;

ALTER TABLE video_theme_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on video_theme_models"
  ON video_theme_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE themes_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on themes_template"
  ON themes_template FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Colunas novas em video_selfies ───
ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS theme_slug TEXT REFERENCES themes_template(slug),
  ADD COLUMN IF NOT EXISTS name_sync_cached_path TEXT;

-- Cache do sync do nome: lookup por (base_model_id, first_name).
-- Independente de tema — o sync do nome só depende do candidato e do
-- primeiro nome do eleitor.
CREATE INDEX IF NOT EXISTS idx_video_selfies_name_sync_cache
  ON video_selfies (base_model_id, first_name)
  WHERE name_sync_cached_path IS NOT NULL
    AND status = 'completed';

-- ─── Backfill: garante que TODOS os base_model existentes já têm as
-- 31 linhas em video_theme_models (com is_uploaded=false), pra dash
-- nunca encontrar um modelo sem temas inicializados.
INSERT INTO video_theme_models (base_model_id, theme_slug)
SELECT bm.id, tt.slug
FROM video_base_models bm
CROSS JOIN themes_template tt
ON CONFLICT (base_model_id, theme_slug) DO NOTHING;
