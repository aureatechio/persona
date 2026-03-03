-- ==========================================
-- MAPEAMENTO INSTAGRAM - MIGRATION
-- ==========================================

-- Table 1: instagram_accounts
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  follower_count INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_accounts_active ON instagram_accounts (is_active, created_at DESC);

-- Table 2: instagram_followers
CREATE TABLE IF NOT EXISTS instagram_followers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  ai_summary      TEXT,
  category        TEXT NOT NULL DEFAULT 'outro',
  category_label  TEXT,
  metadata_json   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, username)
);

CREATE INDEX IF NOT EXISTS idx_ig_followers_account ON instagram_followers (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_followers_category ON instagram_followers (category);

-- Table 3: generated_posts
CREATE TABLE IF NOT EXISTS generated_posts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category      TEXT NOT NULL,
  title         TEXT,
  description   TEXT,
  image_url     TEXT,
  media_type    TEXT DEFAULT 'image',
  tags          TEXT[] DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gen_posts_category ON generated_posts (category, is_active);

-- ==========================================
-- RLS Policies
-- ==========================================
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read instagram_accounts" ON instagram_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert instagram_accounts" ON instagram_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update instagram_accounts" ON instagram_accounts FOR UPDATE USING (true);

CREATE POLICY "Allow read instagram_followers" ON instagram_followers FOR SELECT USING (true);
CREATE POLICY "Allow insert instagram_followers" ON instagram_followers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update instagram_followers" ON instagram_followers FOR UPDATE USING (true);

CREATE POLICY "Allow read generated_posts" ON generated_posts FOR SELECT USING (true);
CREATE POLICY "Allow insert generated_posts" ON generated_posts FOR INSERT WITH CHECK (true);

-- ==========================================
-- SEED DATA
-- ==========================================

-- Accounts
INSERT INTO instagram_accounts (id, username, display_name, avatar_url, bio, follower_count) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'politica_brasil', 'Politica Brasil', null, 'Cobertura politica nacional e internacional', 12),
  ('a1000000-0000-0000-0000-000000000002', 'tech_insights_br', 'Tech Insights BR', null, 'Tecnologia, startups e inovacao no Brasil', 8),
  ('a1000000-0000-0000-0000-000000000003', 'saude_bem_estar', 'Saude & Bem Estar', null, 'Dicas de saude, nutricao e qualidade de vida', 10)
ON CONFLICT (username) DO NOTHING;

-- Followers for politica_brasil
INSERT INTO instagram_followers (account_id, username, display_name, ai_summary, category, category_label) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'dep_silva', 'Deputado Silva', 'Politico conservador com foco em seguranca publica. Fala frequentemente sobre reducao de impostos, defesa da familia tradicional e fortalecimento das forcas armadas. Engaja muito com pautas de direita economica.', 'politico', 'Politico'),
  ('a1000000-0000-0000-0000-000000000001', 'maria_jornalista', 'Maria Santos', 'Jornalista investigativa com foco em corrupcao governamental. Publica denuncias e analises criticas. Posiciona-se como apartidaria mas demonstra vies progressista em questoes sociais.', 'jornalista', 'Jornalista'),
  ('a1000000-0000-0000-0000-000000000001', 'pastor_marcos', 'Pastor Marcos', 'Lider religioso evangelico com grande influencia digital. Mistura conteudo devocional com posicionamentos politicos conservadores. Forte engajamento com pauta de costumes.', 'religioso', 'Religioso'),
  ('a1000000-0000-0000-0000-000000000001', 'ana_ativista', 'Ana Pereira', 'Ativista de direitos humanos e ambientalista. Fala sobre desmatamento, direitos indigenas e justica social. Critica frequentemente o agronegocio e politicas de flexibilizacao ambiental.', 'ativista', 'Ativista'),
  ('a1000000-0000-0000-0000-000000000001', 'carlos_empresario', 'Carlos Mendes', 'Empresario do setor imobiliario. Defende livre mercado, reducao de burocracia e reforma tributaria. Compartilha cases de sucesso e critica intervencionismo estatal.', 'empresario', 'Empresario')
ON CONFLICT (account_id, username) DO NOTHING;

-- Followers for tech_insights_br
INSERT INTO instagram_followers (account_id, username, display_name, ai_summary, category, category_label) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'dev_lucas', 'Lucas Tech', 'Desenvolvedor fullstack apaixonado por IA e machine learning. Compartilha tutoriais, reviews de ferramentas e opinioes sobre o futuro da tecnologia. Perfil tecnico com viés otimista sobre automacao.', 'influenciador', 'Influenciador'),
  ('a1000000-0000-0000-0000-000000000002', 'startup_julia', 'Julia Ventures', 'Investidora anjo e mentora de startups. Fala sobre venture capital, growth hacking e ecossistema de inovacao brasileiro. Defende diversidade no mundo tech.', 'empresario', 'Empresario'),
  ('a1000000-0000-0000-0000-000000000002', 'prof_rodrigo', 'Prof. Rodrigo', 'Professor universitario de ciencia da computacao. Publica sobre pesquisa academica, etica em IA e educacao em tecnologia. Critico de big techs e defensor de software livre.', 'educador', 'Educador'),
  ('a1000000-0000-0000-0000-000000000002', 'cyber_security_br', 'CyberSec BR', 'Especialista em seguranca cibernetica. Alerta sobre golpes digitais, vazamento de dados e privacidade online. Usa linguagem acessivel para educar leigos sobre seguranca digital.', 'educador', 'Educador')
ON CONFLICT (account_id, username) DO NOTHING;

-- Followers for saude_bem_estar
INSERT INTO instagram_followers (account_id, username, display_name, ai_summary, category, category_label) VALUES
  ('a1000000-0000-0000-0000-000000000003', 'dra_fernanda', 'Dra. Fernanda', 'Medica endocrinologista que combate fake news na saude. Fala sobre emagrecimento saudavel, equilibrio hormonal e saude da mulher. Critica dietas radicais e suplementos sem evidencia.', 'saude', 'Saude'),
  ('a1000000-0000-0000-0000-000000000003', 'fitness_rafael', 'Rafael Fitness', 'Personal trainer e influenciador fitness. Compartilha rotinas de treino, dicas de nutricao esportiva e transformacoes de alunos. Linguagem motivacional e comercial.', 'influenciador', 'Influenciador'),
  ('a1000000-0000-0000-0000-000000000003', 'nutri_camila', 'Camila Nutri', 'Nutricionista funcional com abordagem integrativa. Fala sobre alimentacao consciente, fitoterapicos e relacao com a comida. Posiciona-se contra a industria alimenticia ultraprocessada.', 'saude', 'Saude'),
  ('a1000000-0000-0000-0000-000000000003', 'yoga_patricia', 'Patricia Yoga', 'Instrutora de yoga e meditacao. Conteudo sobre mindfulness, autocuidado e espiritualidade. Mistura praticas orientais com psicologia positiva. Publico majoritariamente feminino.', 'religioso', 'Religioso'),
  ('a1000000-0000-0000-0000-000000000003', 'adv_saude', 'Dr. Paulo Advocacia', 'Advogado especialista em direito da saude. Fala sobre planos de saude, erro medico e direitos do paciente. Mistura conteudo juridico com orientacoes praticas para o cidadao.', 'juridico', 'Juridico')
ON CONFLICT (account_id, username) DO NOTHING;

-- Generated posts (2-3 per category)
INSERT INTO generated_posts (category, title, description, image_url, media_type, tags) VALUES
  ('politico', 'Transparencia no Poder', 'A democracia se fortalece quando cobramos transparencia dos nossos representantes. Acompanhe, cobre, fiscalize.', null, 'image', ARRAY['politica', 'transparencia', 'democracia']),
  ('politico', 'Seu Voto Importa', 'Cada voto e uma voz. Informe-se sobre os candidatos e faca escolhas conscientes para o futuro do Brasil.', null, 'image', ARRAY['voto', 'eleicoes', 'cidadania']),
  ('religioso', 'Fe e Esperanca', 'Em tempos desafiadores a fe nos une e a esperanca nos move. Juntos somos mais fortes.', null, 'image', ARRAY['fe', 'esperanca', 'uniao']),
  ('religioso', 'Valores que Transformam', 'Os valores que carregamos definem quem somos. Cultive o amor, a empatia e a solidariedade no seu dia a dia.', null, 'image', ARRAY['valores', 'amor', 'solidariedade']),
  ('empresario', 'Empreender e Transformar', 'O empreendedorismo brasileiro transforma vidas e comunidades. Apoie negocios locais e faca a economia girar.', null, 'image', ARRAY['empreendedorismo', 'negocios', 'economia']),
  ('empresario', 'Inovacao sem Fronteiras', 'A inovacao nao tem limites. Invista em conhecimento, tecnologia e pessoas para crescer de forma sustentavel.', null, 'image', ARRAY['inovacao', 'crescimento', 'tecnologia']),
  ('influenciador', 'Sua Voz Tem Poder', 'Na era digital, cada pessoa e um formador de opiniao. Use sua influencia para inspirar e educar.', null, 'image', ARRAY['influencia', 'digital', 'inspiracao']),
  ('influenciador', 'Conteudo que Conecta', 'Criar conteudo autentico e a melhor forma de se conectar com quem importa. Seja voce, seja real.', null, 'image', ARRAY['conteudo', 'autenticidade', 'conexao']),
  ('jornalista', 'Informacao de Qualidade', 'Jornalismo serio e a base de uma sociedade informada. Valorize quem investiga e apura os fatos.', null, 'image', ARRAY['jornalismo', 'informacao', 'fatos']),
  ('jornalista', 'A Verdade Importa', 'Em um mundo de desinformacao, a busca pela verdade e mais importante do que nunca. Apoie o jornalismo independente.', null, 'image', ARRAY['verdade', 'desinformacao', 'independencia']),
  ('ativista', 'Juntos por um Mundo Melhor', 'Cada acao conta. Participe, engaje e lute pelas causas que acredita. A mudanca comeca por voce.', null, 'image', ARRAY['ativismo', 'mudanca', 'causas']),
  ('ativista', 'Sustentabilidade Agora', 'O planeta precisa de nos agora. Pequenas atitudes no dia a dia fazem uma grande diferenca para o futuro.', null, 'image', ARRAY['sustentabilidade', 'meioambiente', 'futuro']),
  ('celebridade', 'Inspiracao e Talento', 'O talento brasileiro brilha no mundo. Celebre nossa cultura, nossa arte e nossa gente.', null, 'image', ARRAY['cultura', 'talento', 'brasil']),
  ('funcionario_publico', 'Servir ao Publico', 'O servico publico de qualidade transforma vidas. Reconheca e valorize quem trabalha pelo bem comum.', null, 'image', ARRAY['servicopublico', 'dedicacao', 'comunidade']),
  ('educador', 'Educacao Transforma', 'Investir em educacao e investir no futuro. Apoie professores, incentive o aprendizado e transforme realidades.', null, 'image', ARRAY['educacao', 'futuro', 'aprendizado']),
  ('educador', 'Conhecimento Acessivel', 'A democratizacao do conhecimento e o caminho para uma sociedade mais justa. Compartilhe o que voce sabe.', null, 'image', ARRAY['conhecimento', 'acessibilidade', 'justica']),
  ('saude', 'Saude e Prioridade', 'Cuide do seu corpo e da sua mente. A saude e o bem mais precioso que temos. Prevencao salva vidas.', null, 'image', ARRAY['saude', 'prevencao', 'bemestar']),
  ('saude', 'Ciencia e Vida', 'Confie na ciencia, busque profissionais qualificados e nao caia em fake news sobre saude.', null, 'image', ARRAY['ciencia', 'saude', 'evidencias']),
  ('juridico', 'Seus Direitos', 'Conhecer seus direitos e o primeiro passo para exerce-los. Informe-se e nao deixe de buscar justica.', null, 'image', ARRAY['direitos', 'justica', 'cidadania']),
  ('juridico', 'Justica para Todos', 'Uma sociedade justa se constroi com acesso igualitario a justica. Defenda seus direitos e os dos outros.', null, 'image', ARRAY['justica', 'igualdade', 'direito']),
  ('outro', 'Conexao Humana', 'Em um mundo cada vez mais digital, nunca se esqueca do valor das conexoes humanas reais.', null, 'image', ARRAY['conexao', 'humanidade', 'valores']),
  ('outro', 'Cada Dia Conta', 'Aproveite cada dia para ser melhor do que ontem. Pequenos passos levam a grandes conquistas.', null, 'image', ARRAY['motivacao', 'crescimento', 'diario'])
ON CONFLICT DO NOTHING;
