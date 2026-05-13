# Envio de DM Instagram via Apify — Guia de Replicação

Documentação técnica completa de como a página `/seguidores` (Synthetic Person) dispara DMs no Instagram usando **Apify Actors + cookies de sessão + Supabase**. Pensado para que outro app replique o fluxo do zero.

---

## 1. Visão Geral

```
┌──────────────┐  1. Conecta IG (cookies)  ┌──────────────┐
│   Frontend   │ ────────────────────────▶ │  /api/instagram│
│  (Next.js)   │                            │ -mapping/      │
│              │                            │  session       │
│              │ ◀────────────────────────  └─────┬────────┘
│              │  session ativa salva             │ INSERT
│              │                                  ▼
│              │                            ┌──────────────┐
│              │                            │  Supabase    │
│              │                            │ instagram_   │
│              │                            │  sessions    │
│              │                            └──────────────┘
│              │
│              │  2. Disparar DM            ┌──────────────┐
│              │ ────────────────────────▶  │ /api/instagram│
│              │  { username, message }     │ -mapping/     │
│              │                            │  send-dm      │
│              │                            └─────┬────────┘
│              │                                  │ POST
│              │                                  ▼
│              │                            ┌──────────────┐
│              │                            │  Apify Actor │
│              │                            │ am_production│
│              │                            │ /instagram-  │
│              │                            │ direct-      │
│              │                            │ messages-dms │
│              │                            └─────┬────────┘
│              │                                  │ executa
│              │                                  ▼
│              │                            ┌──────────────┐
│              │                            │  Instagram   │
│              │                            │  Web (DM)    │
│              │                            └──────────────┘
└──────────────┘
```

**Princípio do design:** o Apify mantém cookies do Instagram e usa **Playwright** para abrir o Instagram Web, encontrar o usuário e enviar a DM. O nosso backend é “fire-and-forget” — apenas dispara o run e marca o seguidor como contactado. Não esperamos a resposta do actor (Instagram pode levar 30-90s para enviar; bloquear a request seria ruim).

---

## 2. Stack & Dependências

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 |
| Backend | Next.js Route Handlers (Node runtime) |
| Banco | Supabase (Postgres + RLS) |
| Automação | Apify Cloud — 2 actors |
| HTTP | `fetch` nativo |

**Pacote npm necessário:**
```bash
npm install @supabase/supabase-js
```

Não é preciso SDK do Apify — usamos só REST API.

---

## 3. Apify Actors Utilizados

### 3.1 Actor de Login (opcional, modo 3)
- **ID:** `shareze001/instagram-cookies`
- **Endpoint:** `POST https://api.apify.com/v2/acts/shareze001~instagram-cookies/run-sync-get-dataset-items`
- **Input:**
  ```json
  { "username": "usuario", "password": "senha" }
  ```
- **Output (dataset items):** array de cookies `{name, value, domain, path, ...}`
- **Limitação:** **não suporta 2FA**. Se a conta tem 2FA, o usuário precisa colar cookies manualmente.
- **Custo:** assinatura mensal (rented actor) no Apify — se não estiver assinado, retorna `actor-is-not-rented`.

### 3.2 Actor de Disparo de DM (principal)
- **ID:** `am_production/instagram-direct-messages-dms-automation`
- **Endpoint:** `POST https://api.apify.com/v2/acts/am_production~instagram-direct-messages-dms-automation/runs`
  *(o `/` no actor ID precisa estar **encodado** ou usar `~` — usamos `encodeURIComponent` no código)*
- **Input:**
  ```json
  {
    "INSTAGRAM_COOKIES": [ /* cookies normalizados para Playwright */ ],
    "influencers": ["usuario_alvo"],
    "messages": ["Texto da mensagem"]
  }
  ```
- **Comportamento:** abre o IG Web com os cookies, navega até `instagram.com/usuario_alvo`, abre DM e envia a mensagem.
- **Tempo médio:** 30-90s por envio.
- **Custo:** rented actor (assinatura mensal).

> ⚠️ **IMPORTANTE:** os cookies precisam estar no formato Playwright. EditThisCookie e cópias do DevTools usam `sameSite` em lowercase (`"no_restriction"`, `"lax"`, `"strict"`) — o Playwright exige PascalCase (`"None"`, `"Lax"`, `"Strict"`). Veja função `normalizeCookies` na seção 6.

---

## 4. Variáveis de Ambiente

```env
# Apify
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # service role para escrever
```

O `SUPABASE_SERVICE_ROLE_KEY` é usado no backend porque precisamos ignorar RLS para ler `session_cookies` e atualizar `instagram_followers`.

---

## 5. Schema do Banco (Supabase)

### 5.1 `instagram_sessions`
Armazena cookies da conta Instagram conectada.

```sql
create table public.instagram_sessions (
  id uuid primary key default gen_random_uuid(),
  ig_username text not null,
  session_cookies jsonb not null,        -- array de cookies (formato EditThisCookie ou Playwright)
  status text not null default 'active', -- 'active' | 'expired'
  last_verified_at timestamptz,
  created_at timestamptz default now()
);

create index idx_instagram_sessions_active
  on public.instagram_sessions(status, created_at desc)
  where status = 'active';
```

**Regra:** só uma sessão `active` por vez. Ao conectar, marca-se as antigas como `expired`.

### 5.2 `instagram_followers`
Lista de seguidores importados — alvo dos DMs.

```sql
create table public.instagram_followers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references instagram_accounts(id),
  username text not null,
  display_name text,
  avatar_url text,
  ai_summary text,
  category text,                  -- grupo (POLITICO, COMERCIANTE, etc.)
  metadata_json jsonb,
  messaged boolean default false,
  messaged_at timestamptz,
  last_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(account_id, username)
);
```

**Campos chave para DM:**
- `messaged` → boolean: já recebeu DM?
- `messaged_at` → última data de envio
- `last_message` → texto enviado por último

### 5.3 `message_logs`
Auditoria — todo envio gera 1 row.

```sql
create table public.message_logs (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references instagram_followers(id),
  account_id uuid references instagram_accounts(id),
  target_username text not null,
  channel text not null,       -- 'instagram_dm'
  message_content text,
  status text not null,        -- 'sent' | 'failed'
  sent_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_message_logs_sent_at on public.message_logs(sent_at desc);
```

---

## 6. Endpoint: Conectar Instagram (`POST /api/instagram-mapping/session`)

Aceita **3 modos** de conexão:

| Modo | Body | Quando usar |
|---|---|---|
| `devtools` | `{ ig_username, session_cookies: [{name:"sessionid",...}] }` | Padrão — usuário copia do F12 |
| `json` | `{ ig_username, session_cookies: "[...JSON completo...]" }` | Extensão EditThisCookie V3 |
| `login` | `{ ig_username, password }` | Sem 2FA, login automático via Apify |

### 6.1 Código completo

```typescript
// src/app/api/instagram-mapping/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apifyToken = process.env.APIFY_API_TOKEN || '';
const COOKIES_ACTOR = 'shareze001/instagram-cookies';

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase
    .from('instagram_sessions')
    .select('id, ig_username, status, last_verified_at, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ session: data || null });
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();

  let ig_username: string;
  let cookies: Record<string, unknown>[];

  // ─── Modo 3: login com senha via Apify ───
  if (body.password) {
    ig_username = String(body.ig_username || body.username || '').replace(/^@/, '').trim();
    const password = String(body.password);

    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(COOKIES_ACTOR)}/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ig_username, password }),
      signal: AbortSignal.timeout(70000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err?.error?.message || `Apify ${res.status}` }, { status: 502 });
    }

    const results = await res.json().catch(() => []);
    const first = Array.isArray(results) ? results[0] : null;
    cookies = first?.cookies
      || (Array.isArray(results) ? results.filter((r: any) => r.name && r.value) : []);

    if (!cookies?.length) {
      return NextResponse.json({ error: 'Login falhou. Use modo manual.' }, { status: 401 });
    }
  }
  // ─── Modos 1 e 2: cookies já vindos do front ───
  else {
    ig_username = String(body.ig_username || '').replace(/^@/, '').trim();
    const session_cookies = body.session_cookies;
    if (!ig_username || !session_cookies) {
      return NextResponse.json({ error: 'ig_username e session_cookies obrigatórios' }, { status: 400 });
    }
    cookies = typeof session_cookies === 'string' ? JSON.parse(session_cookies) : session_cookies;
  }

  // Validação mínima
  const hasSessionId = cookies.some((c) => c.name === 'sessionid');
  if (!hasSessionId) {
    return NextResponse.json({ error: 'sessionid não encontrado' }, { status: 400 });
  }

  // Expira sessões antigas
  await supabase.from('instagram_sessions').update({ status: 'expired' }).eq('status', 'active');

  // Insere nova
  const { data, error } = await supabase
    .from('instagram_sessions')
    .insert({
      ig_username,
      session_cookies: cookies,
      status: 'active',
      last_verified_at: new Date().toISOString(),
    })
    .select('id, ig_username, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function DELETE() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  await supabase.from('instagram_sessions').update({ status: 'expired' }).eq('status', 'active');
  return NextResponse.json({ success: true });
}
```

### 6.2 Construção dos cookies no front (modo DevTools — recomendado)

O usuário só precisa do `sessionid`. O front monta o array:

```typescript
function buildCookiesFromValues(sessionId: string, csrfToken?: string, dsUserId?: string) {
  const cookies = [];
  if (sessionId.trim()) {
    cookies.push({
      name: 'sessionid', value: sessionId.trim(),
      domain: '.instagram.com', path: '/',
      secure: true, httpOnly: true, sameSite: 'None',
    });
  }
  if (csrfToken?.trim()) {
    cookies.push({
      name: 'csrftoken', value: csrfToken.trim(),
      domain: '.instagram.com', path: '/',
      secure: true, httpOnly: false, sameSite: 'None',
    });
  }
  if (dsUserId?.trim()) {
    cookies.push({
      name: 'ds_user_id', value: dsUserId.trim(),
      domain: '.instagram.com', path: '/',
      secure: true, httpOnly: false, sameSite: 'None',
    });
  }
  return cookies;
}
```

Como instruir o usuário a pegar o `sessionid`:
1. Abrir `instagram.com` no Chrome (logado)
2. F12 → aba **Application**
3. Sidebar: **Cookies → instagram.com**
4. Procurar `sessionid` → duplo clique no valor → Ctrl+C

---

## 7. Endpoint: Disparar DM (`POST /api/instagram-mapping/send-dm`)

### 7.1 Fluxo

1. Validar payload (`targetUsername`, `message`).
2. Buscar a sessão ativa em `instagram_sessions`.
3. Normalizar cookies (EditThisCookie → Playwright).
4. Disparar o actor `am_production/...` via Apify REST (**não esperar fim da execução**).
5. Se HTTP 2xx → marcar `messaged=true`, gravar log e retornar sucesso.
6. Se 401/403 → expirar sessão, retornar 401.

### 7.2 Função `normalizeCookies` (essencial)

Converte qualquer formato de cookie para o que o Playwright (e portanto o actor) aceita:

```typescript
function normalizeCookies(cookies: Record<string, unknown>[]) {
  return cookies.map((c) => {
    const sameSite = String(c.sameSite || '').toLowerCase();
    let normalizedSameSite = 'None';
    if (sameSite === 'strict') normalizedSameSite = 'Strict';
    else if (sameSite === 'lax')  normalizedSameSite = 'Lax';

    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      sameSite: normalizedSameSite,
      ...(c.expirationDate ? { expires: c.expirationDate } : {}),
    };
  });
}
```

### 7.3 Código completo do endpoint

```typescript
// src/app/api/instagram-mapping/send-dm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID   = 'am_production/instagram-direct-messages-dms-automation';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function normalizeCookies(cookies: Record<string, unknown>[]) {
  return cookies.map((c) => {
    const ss = String(c.sameSite || '').toLowerCase();
    const sameSite = ss === 'strict' ? 'Strict' : ss === 'lax' ? 'Lax' : 'None';
    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      sameSite,
      ...(c.expirationDate ? { expires: c.expirationDate } : {}),
    };
  });
}

export async function POST(request: NextRequest) {
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN ausente' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { targetUsername, message } = await request.json();
  if (!targetUsername || !message) {
    return NextResponse.json({ error: 'targetUsername e message obrigatórios' }, { status: 400 });
  }

  // 1) Sessão ativa
  const { data: session } = await supabase
    .from('instagram_sessions')
    .select('id, session_cookies')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Sem sessão Instagram ativa' }, { status: 401 });
  }

  // 2) Cookies normalizados
  const cleanCookies = normalizeCookies(session.session_cookies as Record<string, unknown>[]);

  // 3) Dispara actor (FIRE-AND-FORGET — não espera completion)
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${apifyToken}`;
  const apifyRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      INSTAGRAM_COOKIES: cleanCookies,
      influencers: [targetUsername],
      messages: [message],
    }),
    signal: AbortSignal.timeout(15000), // 15s só pra confirmar START
  });

  if (!apifyRes.ok) {
    const err = await apifyRes.json().catch(() => ({}));
    const type = err?.error?.type || '';
    const msg  = err?.error?.message || `Apify ${apifyRes.status}`;

    if (type === 'actor-is-not-rented' || apifyRes.status === 403) {
      return NextResponse.json({
        error: 'Actor não assinado. Acesse o Apify e assine am_production/instagram-direct-messages-dms-automation.',
      }, { status: 402 });
    }

    if (apifyRes.status === 401 || /login/i.test(msg)) {
      await supabase.from('instagram_sessions').update({ status: 'expired' }).eq('id', session.id);
      return NextResponse.json({ error: 'Sessão expirada. Reconecte.' }, { status: 401 });
    }

    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 4) Marca seguidor como contactado (otimista — actor roda em background)
  await supabase.from('instagram_followers').update({
    messaged: true,
    messaged_at: new Date().toISOString(),
    last_message: message,
    updated_at: new Date().toISOString(),
  }).eq('username', targetUsername);

  // 5) Log
  const { data: follower } = await supabase
    .from('instagram_followers')
    .select('id, account_id')
    .eq('username', targetUsername)
    .limit(1)
    .maybeSingle();

  if (follower) {
    await supabase.from('message_logs').insert({
      follower_id: follower.id,
      account_id: follower.account_id,
      target_username: targetUsername,
      channel: 'instagram_dm',
      message_content: message,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true, username: targetUsername });
}
```

### 7.4 Por que “fire-and-forget”

O actor leva 30-90s. Se a request HTTP esperar, o Vercel/proxy mata por timeout (10-30s default). Solução:
- Usamos `/runs` (e **não** `/run-sync`) → retorna assim que o run for **agendado**.
- Marcamos `messaged=true` otimisticamente.
- Aceitamos pequeno risco de falsa-positiva (raro — se o actor crashar). Se quiser robustez, criar um worker que consulta `https://api.apify.com/v2/acts/{ACTOR_ID}/runs/{runId}` e reverte `messaged` em caso de fail.

---

## 8. Frontend: envio único + bulk

### 8.1 Envio único

```typescript
async function sendDM(username: string, message: string) {
  const res = await fetch('/api/instagram-mapping/send-dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername: username, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
```

### 8.2 Envio em lote (sequencial com delay)

A página `/seguidores` permite disparar para 3, 5, 10, 20, **TODOS** ou IDs selecionados. **Crítico:** envios são **sequenciais** com 2s de delay entre cada — paralelismo dispara rate-limit do Apify e do próprio Instagram.

```typescript
const targets = [
  { username: 'maria',  message: 'Oi Maria! ...' },
  { username: 'joao',   message: 'Oi João! ...' },
];

const results: Array<{ username: string; success: boolean; error?: string }> = [];

for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  setProgress({ current: i, total: targets.length });

  try {
    const res = await fetch('/api/instagram-mapping/send-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername: t.username, message: t.message }),
    });
    const data = await res.json();
    results.push({
      username: t.username,
      success: res.ok && data.success,
      error: !res.ok ? data.error : undefined,
    });
  } catch {
    results.push({ username: t.username, success: false, error: 'Erro de conexão' });
  }

  // 2 segundos entre envios
  if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 2000));
}
```

### 8.3 Personalização com `{{nome}}`

Template simples para personalizar a mensagem:

```typescript
const personalized = template.replace(/\{\{nome\}\}/gi, follower.display_name || follower.username);
```

Ex.: `"Oi {{nome}}! Vi seu perfil..."` → `"Oi Maria Silva! Vi seu perfil..."`

### 8.4 UX: pular já-contactados

```typescript
const targets = selectedFollowers.filter((f) => !f.messaged);
```

Mostre quantos foram pulados:
```
Enviar para 8 não contactados de 12 selecionados (4 já contactados — pulados)
```

---

## 9. Tratamento de Erros

| Status | `error` | Causa | Ação no front |
|---|---|---|---|
| 401 | "Sem sessão Instagram ativa" | Nenhuma `instagram_sessions.status='active'` | Abrir modal de conectar |
| 401 | "Sessão expirada. Reconecte." | Cookie `sessionid` foi invalidado pelo IG | Abrir modal de conectar |
| 402 | "Actor não assinado" | Actor não foi alugado no Apify | Mostrar link pro Apify Store |
| 400 | "sessionid não encontrado" | Usuário colou cookies sem sessionid | Pedir só o sessionid (modo DevTools) |
| 502 | "Apify retornou 5xx" | Falha temporária do Apify | Tentar de novo |
| 500 | "APIFY_API_TOKEN ausente" | env var não setada | Configurar no Vercel/env |

---

## 10. Custos & Limites Práticos

- **Apify rented actor:** ~$30-50/mês cada. Você precisa **assinar** o `am_production/instagram-direct-messages-dms-automation` antes de usar.
- **Compute Units (CU):** cada execução do actor consome CUs. Plano Hobby (US$ 5/mês) tem ~5GB de CU — suficiente para ~200-300 DMs/mês.
- **Limites do Instagram:**
  - ~30-50 DMs/dia para conta nova
  - ~80-100 DMs/dia para conta com histórico
  - **2s entre envios** + **distribuir ao longo do dia** reduz risco de ban
  - Mensagens idênticas em massa = ban quase certo. **Sempre personalize com `{{nome}}` ou variações.**

---

## 11. Checklist de Replicação em Outro App

Para colocar isso em outro app:

- [ ] Criar tabelas `instagram_sessions`, `instagram_followers`, `message_logs` no Supabase (seção 5)
- [ ] Configurar env vars `APIFY_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Assinar (rent) os actors no Apify Store:
  - `am_production/instagram-direct-messages-dms-automation` (obrigatório)
  - `shareze001/instagram-cookies` (opcional, só pra modo login)
- [ ] Copiar `POST /api/.../session/route.ts` (seção 6.1)
- [ ] Copiar `POST /api/.../send-dm/route.ts` (seção 7.3)
- [ ] Implementar UI de Conectar Instagram com 3 abas (DevTools / JSON / Login)
- [ ] Implementar UI de listagem de seguidores + botão "Enviar DM"
- [ ] Implementar bulk-send sequencial com delay 2s (seção 8.2)
- [ ] Testar:
  - [ ] Conectar via cookies do F12 → request `GET /session` deve retornar a sessão
  - [ ] Enviar 1 DM para conta de teste — verificar que chega no Instagram
  - [ ] Em 2-3 minutos, conferir o log em `message_logs`
  - [ ] Repetir envio para o mesmo user → `messaged_at` deve atualizar

---

## 12. Pontos de Atenção / Aprendizados

1. **`encodeURIComponent` no actor ID** — `am_production/instagram-direct-messages-dms-automation` tem `/` no meio. Sem encodar, a URL quebra.
2. **`sameSite` PascalCase** — Playwright só aceita `None | Lax | Strict`. Cookies de extensão vêm como `no_restriction | lax | strict`. Sempre normalize.
3. **Apify `/runs` vs `/run-sync`** — usamos `/runs` (assíncrono) porque `/run-sync` espera fim e estoura timeout do Vercel.
4. **Otimista no `messaged=true`** — marcamos antes do actor terminar. Se quiser 100% confiável, polleie o status do run e atualize depois.
5. **Sessão expirada** — quando o cookie `sessionid` expira, o actor retorna `login`/401. Capture isso e marque a sessão como `expired` automaticamente para forçar reconexão.
6. **Rate-limit Apify** — com paralelismo, o Apify retorna 429. Use sequencial + 2s.
7. **Conta queimada do IG** — se a conta receber muitos `action blocked`, o cookie `sessionid` continua válido mas o actor não consegue enviar. Solução: trocar de conta IG.
8. **Sem 2FA no modo Login** — o actor `shareze001/instagram-cookies` não passa por 2FA. Para contas com 2FA (a maioria das contas sérias), use modo DevTools.

---

## 13. Referências

- **Apify REST API:** https://docs.apify.com/api/v2
- **Actor de DM:** https://apify.com/am_production/instagram-direct-messages-dms-automation
- **Actor de cookies:** https://apify.com/shareze001/instagram-cookies
- **Playwright cookie format:** https://playwright.dev/docs/api/class-browsercontext#browser-context-add-cookies

---

**Última atualização:** 2026-05-07
**Autor:** Synthetic Person — `/seguidores` flow
