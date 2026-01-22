## Resumo do Projeto

Um sistema web de criação e teste de personas sintéticas chamado "Persona". 

## 🗺️ Página: Lista de Personas & Mapa

Esta página precisa alternar entre a densidade de dados da lista e a visualização geográfica.

### 1. Visualização em Lista (Grid de Cards)

* **Card de Persona:** Deve exibir a "Identidade Básica" de forma rápida: foto (avatar gerado), nome, idade, cidade/estado e um pequeno "badge" com o arquétipo principal (ex: "Analítico", "Impulsivo").
* **Filtros Dinâmicos:** Filtros por faixa etária, gênero, estado e nível de renda.
* **Acesso Rápido:** Botão direto para "Iniciar Chat" ou "Ver Perfil Completo".

### 2. Visualização de Mapa (Brasil)

* **Mapa Interativo:** Utilizar uma biblioteca como *Leaflet* ou *Mapbox* com o foco inicial no Brasil.
* **Clusterização:** Como a meta é chegar a 20 mil personas, o mapa deve usar "clusters" (círculos que mostram a quantidade de personas em uma região) para evitar poluição visual.
* **Pins Detalhados:** Ao clicar em um ponto individual, abre-se um *popup* com o resumo demográfico e um link para o chat.

---

## 💬 Página: Chat com a Persona

O diferencial aqui é dar ao usuário a sensação de que ele está conversando com alguém que tem história e vícios reais.

* **Sidebar de Contexto (Drawer):** Um painel lateral que pode ser recolhido, exibindo o "Resumo da História" e os "Objetivos e Sonhos" da persona para que o usuário saiba com quem está falando.
* **Interface de Chat:** Layout limpo estilo WhatsApp/Telegram.
* **Indicador de "Pensamento":** Um pequeno box opcional que mostra quais campos do JSON estão sendo "ativados" no prompt (ex: *"Influenciado por: Viés de Confirmação + Hobby: Futebol"*). Isso ajuda a validar se a persona está agindo conforme os dados.
* **Ações de Reset:** Botão para limpar o histórico e reiniciar a conversa do zero (essencial para testes limpos).

Funcionamento: Ao enviar a mensagem para a persona, ativa um gatilho de webhook do meu n8n com um fluxo de agente IA enviando o id da persona, a mensagem do usuário e o id do usuário. Assim o fluxo de IA gera a mensagem de resposta e envia para o front.

Design: Parecido com um WhatsApp mesmo.

---

## 🗄️ Estrutura de Banco de Dados (MVP)

Você pode estruturar a tabela principal de forma a permitir filtros rápidos nas colunas demográficas e flexibilidade total nos campos complexos através de JSONB (se usar PostgreSQL).

### Tabela: `personas`

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | UUID | Identificador único. |
| `name` | String | Nome completo da persona. |
| `age` | Integer | Idade (para filtros rápidos). |
| `gender` | String | Gênero. |
| `city` | String | Cidade de moradia. |
| `state` | String (2) | UF (essencial para o mapa). |
| `lat / lng` | Float | Coordenadas geográficas para plotagem no mapa. |
| `psychology_json` | JSONB | **Arquitetura Psicológica:** Big Five, DISC, Valores. |
| `beliefs_json` | JSONB | **Vieses e Crenças:** Religião, política, objeções. |
| `career_json` | JSONB | **Conhecimentos e Carreira:** Cargo, hard/soft skills. |
| `lifestyle_json` | JSONB | **Rotinas e Hábitos:** Cronotipo, mídias, vícios. |
| `health_json` | JSONB | **Hobbies e Saúde:** Esportes, estresse, lazer. |
| `history_json` | JSONB | **História e Momento:** Resumo, traumas e sonhos. |

### Tabela: `users`

* `id`, `email`, `password_hash`, `created_at`.
* `saved_personas`: Uma lista de IDs de personas que o usuário marcou como favoritas para testes recorrentes.