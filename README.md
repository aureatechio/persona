# Persona - Sistema de Personas Sintéticas

Sistema web para criação, visualização e teste de personas sintéticas com perfis psicológicos completos.

## Funcionalidades

- **Lista de Personas**: Visualização em grid com filtros por nome e gênero
- **Mapa Interativo**: Visualização geográfica com clusterização (focado no Brasil)
- **Perfil Completo**: 7 abas com todos os dados psicológicos, demográficos e históricos
- **Chat com IA**: Interface estilo WhatsApp para conversar com as personas

## Tecnologias

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Mapas**: Leaflet.js com MarkerCluster
- **IA**: Integração via Webhook (n8n)

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/persona.git
cd persona
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

### 4. Execute o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Deploy na Vercel

1. Faça push do código para o GitHub
2. Importe o projeto na [Vercel](https://vercel.com)
3. Configure as variáveis de ambiente no painel da Vercel
4. Deploy automático!

## Estrutura do Banco de Dados

### Tabela `personas`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador único |
| name | Text | Nome completo |
| age | Integer | Idade |
| gender | Text | Gênero |
| city | Text | Cidade |
| state | Char(2) | UF |
| lat/lng | Float | Coordenadas |
| demographic_json | JSONB | Dados demográficos IBGE |
| psychology_json | JSONB | Big Five, DISC, Eneagrama, Arquétipos |
| beliefs_json | JSONB | Religião, política, vieses cognitivos |
| career_json | JSONB | Cargo, skills, contexto profissional |
| lifestyle_json | JSONB | Rotinas, mídias, hábitos |
| health_json | JSONB | Atividades, saúde mental |
| history_json | JSONB | Biografia, traumas, aspirações |

## Licença

MIT
