-- Tabela para armazenar o perfil estatístico pré-computado das 20k personas.
-- Usado pelo aggregate engine para derivar scores sem iterar persona por persona.

CREATE TABLE IF NOT EXISTS arena_sentiment_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  version INTEGER DEFAULT 1,
  total_personas INTEGER NOT NULL,
  demographics JSONB NOT NULL,
  electoral JSONB NOT NULL,
  ideological JSONB NOT NULL,
  clusters JSONB NOT NULL,
  thematic_opinions JSONB NOT NULL,
  geographic JSONB NOT NULL,
  cross_tabulations JSONB NOT NULL,
  persona_samples JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now()
);
