# Skill: Dashboard Architect — Beautiful Data Visualization

TRIGGER when: user asks to create dashboards, data visualization pages, analytics screens, metrics panels, charts, KPI displays, report pages, or any data-heavy UI. Also trigger when user says "dashboard", "dados", "metricas", "graficos", "analytics", "relatorio", "painel".
DO NOT TRIGGER when: simple forms, auth pages, settings pages, or non-data UI.

---

## PROCESSO OBRIGATORIO — Siga TODOS os passos

Quando o usuario pedir um dashboard, NUNCA comece codando direto. Siga este processo:

### PASSO 1: Entender os Dados
Antes de qualquer coisa:
- Identifique quais dados o usuario quer visualizar
- Leia as tabelas/schemas do Supabase relevantes
- Entenda as metricas: o que e KPI principal? O que e contexto?
- Pergunte se necessario: periodo padrao? Filtros? Comparacoes?

### PASSO 2: Hierarquia Visual (3 Segundos)
O usuario deve entender o estado geral em 3 segundos. Organize os dados em:
1. **Tier 1 (KPIs)** — 3-5 numeros grandes no topo (responde: "como estamos?")
2. **Tier 2 (Tendencias)** — 1-2 graficos principais (responde: "pra onde vamos?")
3. **Tier 3 (Detalhes)** — tabelas, rankings, feeds (responde: "por que?")

### PASSO 3: Escolher Visualizacoes Corretas
Use esta matriz de decisao:

| Pergunta que responde | Tipo de dado | Visualizacao ideal |
|---|---|---|
| "Quanto?" | Numero unico | KPI Card com variacao |
| "Como evolui?" | Serie temporal | Area Chart (1 serie) ou Line Chart (2+ series) |
| "Como compara?" | Categorias | Bar Chart horizontal ou vertical |
| "Qual a proporcao?" | Partes de um todo | Donut Chart (max 6 fatias) |
| "Qual o ranking?" | Top N | Leaderboard com barra de progresso |
| "O que aconteceu?" | Eventos cronologicos | Activity Feed / Timeline |
| "Onde?" | Dados geograficos | Mapa (Leaflet) |
| "Qual a distribuicao?" | Faixas de valores | Histogram ou Heatmap |
| "Qual a relacao?" | Duas variaveis | Scatter plot |
| "Como esta agora?" | Status em tempo real | Status badges + indicadores |

### PASSO 4: Compor o Layout
Siga a anatomia padrao e adapte:

```
+---------------------------------------------------------+
|  HEADER: Titulo + Periodo selector + Filtros + Refresh   |
+---------------------------------------------------------+
|  KPI ROW: 3-5 metric cards com icone + variacao + spark  |
+---------------------------------------------------------+
|  CHART PRINCIPAL (area/line) — 60% da largura visual     |
+------------------------+--------------------------------+
|  CHART SECUNDARIO      |  RANKING / LEADERBOARD          |
|  (bar/donut)           |  ou ACTIVITY FEED               |
+------------------------+--------------------------------+
|  TABELA DE DADOS com search, filtros, paginacao          |
+---------------------------------------------------------+
```

### PASSO 5: Implementar com os Componentes Abaixo

---

## REGRAS ESPECIFICAS PARA TV DASHBOARDS (DashBird)

Ao criar ou modificar telas de apresentacao TV (fullscreen 16:9):

### Contextualizacao Obrigatoria
NUNCA exibir um percentual sozinho. Sempre acompanhar de label descritivo:
- `67% A Favor` (nao apenas `67%`)
- `43% da amostra` (distribuicao)
- `62% Aprovacao` (figuras politicas)
- `38% sao Centro-Esquerda` (spectrum dominante)

### Hierarquia de Informacao
- **Hero (Tendencia)**: `text-6xl font-black` — O numero mais importante da tela
- **Stats secundarios**: `text-3xl` — Favor/Contra/Neutros
- **Metricas de card**: `text-xl` a `text-2xl`
- **Labels e legendas**: `text-xs` MINIMO (12px). NUNCA usar `text-[8px]`, `text-[9px]`, `text-[7px]`

### Proporcionalidade
- Donuts: `w-[55%]` do card (nao limitar a 140px)
- Barras: `h-[18px]` minimo
- Bubble markers (spectrum): minimo 18px

### Dupla Metrica por Segmento
Cada item de segmento deve mostrar DUAS informacoes:
- **Distribuicao**: quanto % da amostra total este grupo representa
- **Sentimento**: quanto % deste grupo concorda/discorda
- Formato: `[dot] Label  43%  ·  67% A Favor`

### Layout Padrao TV
```
[Top Bar - 48px: Live + Question + Progress]
[Hero Zone - ~160px: TrendHero + Stats + Right Slot]
[Main Grid - flex-1: Cards de segmento]
[Progress Bar - 3px]
```

### Componentes TV (em `src/components/apresentacao/charts.tsx`)
- `TrendHero` — Hero zone compartilhada entre telas
- `SentimentBar` — Barra empilhada com legenda (rightSlot do Dashboard)
- `DonutCard` — Donut grande + legenda dual-metrica
- `HBarChart` — Barras horizontais com badge de sentimento
- `SpectrumGauge` — Eixo esquerda-direita com bubbles
- `QuadrantGrid` — Grid 2x2 com dupla metrica

---

## FUNDACAO: Imports e Setup

```tsx
// === IMPORTS PADRAO PARA QUALQUER DASHBOARD ===
"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  TrendingUp, TrendingDown, BarChart3, Activity, Users, DollarSign,
  Calendar, Clock, Target, ArrowUpRight, ArrowDownRight, RefreshCw,
  Search, Filter, ChevronLeft, ChevronRight, ChevronDown, X,
  Download, Share2, MoreHorizontal, Eye, Zap, Globe, MapPin,
  Sparkles, Star, Heart, MessageCircle, Play, Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
```

### Chart Theme (OBRIGATORIO em todo dashboard)

```tsx
const CHART_THEME = {
  grid: { stroke: "rgba(255,255,255,0.04)" },
  axis: {
    stroke: "rgba(255,255,255,0.08)",
    fontSize: 11,
    fill: "#71717a",
    fontFamily: "Manrope, sans-serif",
  },
  tooltip: {
    contentStyle: {
      backgroundColor: "rgba(9,9,11,0.95)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      backdropFilter: "blur(16px)",
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
      padding: "12px 16px",
    },
    labelStyle: { color: "#a1a1aa", fontSize: 11, marginBottom: 6, fontFamily: "Manrope" },
    itemStyle: { color: "#ffffff", fontSize: 13, fontWeight: 600, fontFamily: "Manrope" },
    cursor: { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 },
  },
  colors: {
    primary: "#34d399",     // emerald-400
    secondary: "#38bdf8",   // sky-400
    tertiary: "#a78bfa",    // violet-400
    quaternary: "#fbbf24",  // amber-400
    danger: "#f87171",      // red-400
    pink: "#f472b6",        // pink-400
    muted: "#52525b",       // zinc-600
  },
  gradients: {
    emerald: { start: "rgba(52,211,153,0.25)", end: "rgba(52,211,153,0)" },
    sky:     { start: "rgba(56,189,248,0.25)", end: "rgba(56,189,248,0)" },
    violet:  { start: "rgba(167,139,250,0.25)", end: "rgba(167,139,250,0)" },
    amber:   { start: "rgba(251,191,36,0.25)", end: "rgba(251,191,36,0)" },
    red:     { start: "rgba(248,113,113,0.25)", end: "rgba(248,113,113,0)" },
    pink:    { start: "rgba(244,114,182,0.25)", end: "rgba(244,114,182,0)" },
  },
} as const;

const DONUT_COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#f87171", "#f472b6"];
```

---

## REGRAS ABSOLUTAS PARA DASHBOARDS

1. **SEMPRE** usar `tabular-nums` em numeros/metricas
2. **SEMPRE** formatar com `toLocaleString("pt-BR")` — nunca "1000000" cru
3. **SEMPRE** incluir contexto de periodo em cada grafico
4. **SEMPRE** legendas nos graficos (nao depender so de cores)
5. **SEMPRE** `ResponsiveContainer` width="100%" nos Recharts
6. **SEMPRE** incluir empty state e loading skeleton
7. **SEMPRE** feedback visual no hover de linhas de tabela
8. **SEMPRE** margin left negativo (-20) no YAxis
9. **SEMPRE** animacoes suaves (isAnimationActive animationDuration={800})
10. **SEMPRE** custom Tooltip com dark theme (NUNCA o default branco)
11. **SEMPRE** `vertical={false}` no CartesianGrid de charts com eixo X temporal
12. **SEMPRE** `tickLine={false} axisLine={false}` nos eixos (visual limpo)
13. **NUNCA** mais de 6 cores num unico grafico
14. **NUNCA** decimais desnecessarias em KPIs (R$ 1.500,00 -> R$ 1.5K)
15. **NUNCA** cores parecidas demais no mesmo grafico
16. **NUNCA** charts sem grid sutil
17. **NUNCA** esquecer responsividade (grid-cols-1 md:grid-cols-2 lg:...)
18. **NUNCA** mostrar dados sem loading state
19. **NUNCA** percentuais sem label descritivo em TV dashboards
20. **NUNCA** fontes menores que text-xs (12px) em TV dashboards
