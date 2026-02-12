# Synthetic Person - Design & Development Guide

## Identidade do Projeto

Este projeto usa **dark mode premium** com estética minimalista sofisticada. Toda interface deve transmitir elegância, modernidade e profissionalismo absoluto.

## Stack de Design

- **Framework:** Next.js 16 + React 19 (App Router)
- **Estilo:** Tailwind CSS v4 (utility-first, sem CSS-in-JS)
- **Tipografia:** Manrope (Google Fonts)
- **Ícones:** lucide-react
- **Utilitários CSS:** clsx + tailwind-merge
- **Mapas:** Leaflet + react-leaflet (dark CartoDB basemap)

## Skill: Frontend Design Impecável

Ao criar ou modificar qualquer componente visual, siga RIGOROSAMENTE estas diretrizes:

### 1. PALETA DE CORES (Dark Premium)

```
Backgrounds:
  - Principal:      #000000 (bg-black)
  - Superfície:     bg-zinc-950 / bg-zinc-900
  - Card elevado:   bg-zinc-900/80 backdrop-blur-xl
  - Card hover:     bg-zinc-800/60
  - Overlay:        bg-black/60 backdrop-blur-sm

Bordas:
  - Sutil:          border-zinc-800/50
  - Visível:        border-zinc-700/40
  - Hover:          border-zinc-600/50
  - Accent:         border-emerald-500/30

Texto:
  - Principal:      text-white
  - Secundário:     text-zinc-400
  - Terciário:      text-zinc-500
  - Muted:          text-zinc-600

Acentos (usar com moderação):
  - Primário:       emerald-400/500 (ações, sucesso, CTA)
  - Alerta:         amber-400/500
  - Perigo:         red-400/500
  - Info:           sky-400/500
  - Destaque:       violet-400/500
```

### 2. GRADIENTES MODERNOS

Sempre que possível, use gradientes sutis para dar profundidade:

```
// Background com grain (efeito premium)
bg-gradient-to-br from-zinc-950 via-black to-zinc-950

// Card com glass effect
bg-zinc-900/40 backdrop-blur-2xl border border-white/[0.06]

// Glow sutil em botões primários
bg-emerald-500 shadow-lg shadow-emerald-500/25

// Gradiente de texto para títulos hero
bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent

// Orb decorativo (background)
bg-gradient-to-r from-emerald-500/10 via-transparent to-violet-500/10
```

### 3. ESPAÇAMENTO (Generoso e Respirável)

```
Padding de página:       p-6 md:p-8 lg:p-10
Padding de card:         p-5 md:p-6
Gap entre cards:         gap-4 md:gap-6
Margem entre seções:     space-y-8 md:space-y-12
Padding de botão:        px-4 py-2.5 (md) / px-6 py-3 (lg)
```

### 4. BORDAS E RAIOS

```
Cards grandes:           rounded-2xl ou rounded-3xl
Cards médios:            rounded-xl
Botões:                  rounded-xl
Inputs:                  rounded-xl
Tags/badges:             rounded-full
Avatares:                rounded-full
Modais:                  rounded-2xl
```

### 5. SOMBRAS E ELEVAÇÃO

```
Card sutil:              shadow-xl shadow-black/20
Card hover:              shadow-2xl shadow-black/40
Botão primário:          shadow-lg shadow-emerald-500/20
Dropdown/Menu:           shadow-2xl shadow-black/50
Modal:                   shadow-2xl shadow-black/60
Glow:                    shadow-[0_0_60px_-15px] shadow-emerald-500/20
```

### 6. ANIMAÇÕES E TRANSIÇÕES

TODA interação deve ter feedback visual suave:

```
Transição padrão:        transition-all duration-300 ease-out
Hover rápido:            transition-colors duration-200
Entrada de card:         animate-in fade-in slide-in-from-bottom-4 duration-500
Hover de card:           hover:scale-[1.02] hover:-translate-y-1
Botão press:             active:scale-[0.97]
Skeleton loading:        animate-pulse bg-zinc-800/50 rounded-xl
```

### 7. GLASSMORPHISM (Efeito Glass)

Usar em cards, sidebars, modais e dropdowns:

```tsx
// Glass card
className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-2xl"

// Glass navbar
className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-50"

// Glass modal overlay
className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"

// Glass sidebar
className="bg-zinc-950/90 backdrop-blur-2xl border-r border-white/[0.06]"
```

### 8. TIPOGRAFIA

```
Título hero (h1):        text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight
Título seção (h2):       text-2xl md:text-3xl font-semibold tracking-tight
Subtítulo (h3):          text-xl font-semibold
Body large:              text-lg text-zinc-300 leading-relaxed
Body:                    text-sm text-zinc-400 leading-relaxed
Caption:                 text-xs text-zinc-500
Label:                   text-xs font-medium uppercase tracking-wider text-zinc-500
```

### 9. COMPONENTES PADRÃO

#### Botão Primário
```tsx
<button className="
  inline-flex items-center gap-2 px-5 py-2.5
  bg-emerald-500 hover:bg-emerald-400
  text-black font-semibold text-sm
  rounded-xl
  shadow-lg shadow-emerald-500/25
  hover:shadow-emerald-400/30
  active:scale-[0.97]
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">

#### Botão Secundário (Ghost)
```tsx
<button className="
  inline-flex items-center gap-2 px-5 py-2.5
  bg-white/[0.05] hover:bg-white/[0.1]
  text-zinc-300 hover:text-white
  border border-white/[0.08] hover:border-white/[0.15]
  rounded-xl font-medium text-sm
  active:scale-[0.97]
  transition-all duration-200
">

#### Input
```tsx
<input className="
  w-full px-4 py-3
  bg-white/[0.04] hover:bg-white/[0.06]
  border border-white/[0.08] focus:border-emerald-500/50
  rounded-xl text-sm text-white placeholder:text-zinc-600
  outline-none focus:ring-2 focus:ring-emerald-500/20
  transition-all duration-200
" />

#### Card
```tsx
<div className="
  group relative
  bg-white/[0.03] hover:bg-white/[0.06]
  border border-white/[0.06] hover:border-white/[0.12]
  rounded-2xl p-6
  shadow-xl shadow-black/20 hover:shadow-2xl
  transition-all duration-300 ease-out
  hover:-translate-y-1
">

#### Badge/Tag
```tsx
<span className="
  inline-flex items-center gap-1.5 px-3 py-1
  bg-emerald-500/10 text-emerald-400
  border border-emerald-500/20
  rounded-full text-xs font-medium
">

#### Stat/Metric Card
```tsx
<div className="
  bg-white/[0.03] border border-white/[0.06]
  rounded-2xl p-5
  flex flex-col gap-2
">
  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Label</span>
  <span className="text-3xl font-bold text-white">42.5K</span>
  <span className="text-xs text-emerald-400 flex items-center gap-1">
    <TrendingUp size={12} /> +12.5%
  </span>
</div>
```

### 10. LAYOUTS

#### Grid Responsivo de Cards
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">

#### Dashboard Layout
```tsx
<div className="flex min-h-screen bg-black">
  {/* Sidebar */}
  <aside className="w-64 shrink-0 ...">
  {/* Main */}
  <main className="flex-1 overflow-y-auto">
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">

#### Header de Página
```tsx
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
  <div>
    <h1 className="text-3xl font-bold text-white tracking-tight">Título</h1>
    <p className="text-zinc-500 mt-1">Descrição curta</p>
  </div>
  <div className="flex items-center gap-3">
    {/* Action buttons */}
  </div>
</div>
```

### 11. PADRÕES DE MICRO-INTERAÇÃO

```tsx
// Hover glow em ícones
<div className="p-2 rounded-xl hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 transition-colors duration-200 cursor-pointer">
  <Icon size={20} />
</div>

// Divider sutil
<div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

// Empty state
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
    <Icon size={32} className="text-zinc-600" />
  </div>
  <p className="text-zinc-500 text-sm">Nenhum item encontrado</p>
</div>

// Loading skeleton
<div className="space-y-4">
  {[...Array(3)].map((_, i) => (
    <div key={i} className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse" />
  ))}
</div>

// Notification dot
<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-black" />
```

### 12. REGRAS ABSOLUTAS

1. **NUNCA** use cores cruas sem opacidade (ex: `border-zinc-800` -> use `border-zinc-800/50`)
2. **SEMPRE** adicione `transition-all duration-200` ou `duration-300` em elementos interativos
3. **SEMPRE** use `backdrop-blur` quando tiver background semi-transparente
4. **NUNCA** use cantos quadrados - mínimo `rounded-lg`, preferencialmente `rounded-xl` ou maior
5. **SEMPRE** dê feedback visual em hover, focus e active states
6. **SEMPRE** use `tracking-tight` em títulos grandes (text-2xl+)
7. **NUNCA** use text-white para texto secundário - use `text-zinc-400` ou `text-zinc-500`
8. **SEMPRE** garanta contraste adequado (WCAG AA mínimo)
9. **SEMPRE** use layout responsivo (mobile-first com md: e lg:)
10. **NUNCA** crie componentes sem estados de loading e empty

### 13. EFEITOS ESPECIAIS (Usar com Critério)

```tsx
// Animated gradient border
<div className="relative rounded-2xl p-px bg-gradient-to-r from-emerald-500/50 via-transparent to-violet-500/50">
  <div className="bg-zinc-950 rounded-2xl p-6">
    {/* content */}
  </div>
</div>

// Dot grid pattern background
<div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_zinc-800_1px,_transparent_0)] bg-[size:24px_24px] opacity-30" />

// Spotlight hover effect (precisa de JS para mouse position)
// Glow orbs decorativos
<div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
```

### 14. UTILITÁRIO cn() - SEMPRE USAR

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usar `cn()` para compor classes dinamicamente em vez de template literals.

---

## Referência Rápida de Ícones (lucide-react)

Navegação: Menu, X, ChevronRight, ChevronDown, ArrowLeft, ArrowRight
Ações: Plus, Search, Filter, Settings, Edit, Trash2, Download, Upload, Share2
Status: Check, AlertCircle, Info, AlertTriangle, XCircle
Dados: TrendingUp, TrendingDown, BarChart3, PieChart, Activity
Pessoas: User, Users, UserPlus, UserCheck
Comunicação: MessageCircle, Send, Mail, Bell
Mídia: Image, Camera, Mic, Play, Pause
Outros: Sparkles, Zap, Globe, MapPin, Calendar, Clock, Star, Heart
