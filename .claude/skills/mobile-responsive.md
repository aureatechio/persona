# Skill: Mobile Navigation & Responsive Design Expert

TRIGGER when: user asks about mobile menu, hamburger menu, bottom navigation, responsive layout, mobile-first design, screen adaptation, breakpoints, sidebar mobile, drawer, sheet, swipe gestures, touch interactions, or mentions "mobile", "responsivo", "menu mobile", "navegacao", "breakpoint", "tela pequena", "celular", "tablet".
DO NOT TRIGGER when: desktop-only dashboards, TV/fullscreen presentations, or non-UI work.

---

## PROCESSO OBRIGATORIO

### PASSO 1: Identificar o Padrao de Navegacao

Antes de codar, determine qual pattern se aplica:

| Cenario | Pattern Recomendado |
|---|---|
| App com 3-5 secoes principais | **Bottom Tab Bar** (mobile) + Sidebar (desktop) |
| App com muitas secoes/submenus | **Hamburger Drawer** (mobile) + Sidebar (desktop) |
| App com 2-3 secoes simples | **Top Tab Bar** (mobile) + Header nav (desktop) |
| Dashboard complexo | **Bottom Tab Bar** + **Drawer** para filtros |
| Landing page / site institucional | **Hamburger overlay** full-screen |
| App com fluxo linear (wizard) | **Header com back + progress** (sem nav global) |

### PASSO 2: Definir Breakpoints

Usar os breakpoints do Tailwind v4 de forma consistente:

```
sm:  640px   — telefones grandes em landscape
md:  768px   — tablets portrait (BREAKPOINT PRINCIPAL mobile->desktop)
lg:  1024px  — tablets landscape / laptops pequenos
xl:  1280px  — desktops
2xl: 1536px  — telas grandes
```

**Regra de ouro:** Design mobile-first. Comece pelo menor e adicione complexidade com `md:`, `lg:`, etc.

### PASSO 3: Implementar com os Componentes Abaixo

---

## COMPONENTES DE NAVEGACAO MOBILE

### 1. Bottom Tab Bar (Padrao Principal)

O pattern mais nativo e intuitivo para apps mobile. Maximo 5 itens.

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Home, Search, PlusCircle, Bell, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/busca", icon: Search, label: "Busca" },
  { href: "/criar", icon: PlusCircle, label: "Criar" },
  { href: "/notificacoes", icon: Bell, label: "Alertas" },
  { href: "/perfil", icon: User, label: "Perfil" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className={cn(
      "fixed bottom-0 inset-x-0 z-50",
      "bg-zinc-950/90 backdrop-blur-2xl",
      "border-t border-white/[0.06]",
      "pb-[env(safe-area-inset-bottom)]", // Safe area para iPhone com notch
      "md:hidden" // Esconde no desktop
    )}>
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl",
                "transition-all duration-200 min-w-[64px]",
                "active:scale-[0.92]",
                isActive
                  ? "text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                {isActive && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isActive && "font-semibold"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Regras do Bottom Tab:**
- **SEMPRE** `pb-[env(safe-area-inset-bottom)]` para iPhones com notch/dynamic island
- **SEMPRE** `md:hidden` — no desktop usar sidebar ou header
- **SEMPRE** `min-w-[64px]` em cada item (area de toque minima 48x48)
- **SEMPRE** `active:scale-[0.92]` para feedback tatil
- **MAXIMO** 5 itens (mais que isso = usar drawer)
- **NUNCA** labels com mais de 7 caracteres
- Adicionar `mb-20 md:mb-0` no conteudo principal para nao ficar atras da tab bar

### 2. Hamburger Drawer (Sidebar Mobile)

Para apps com muitas secoes. Abre da esquerda com overlay.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronRight } from "lucide-react";

interface DrawerProps {
  children: React.ReactNode;
  navSections: {
    title?: string;
    items: { href: string; icon: React.ElementType; label: string; badge?: string }[];
  }[];
}

export function MobileDrawer({ children, navSections }: DrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Fechar ao navegar
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Travar scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Hamburger button — apenas mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "md:hidden fixed top-4 left-4 z-50",
          "p-2.5 rounded-xl",
          "bg-zinc-900/80 backdrop-blur-xl",
          "border border-white/[0.08]",
          "text-zinc-400 hover:text-white",
          "active:scale-[0.95]",
          "transition-all duration-200",
          "shadow-lg shadow-black/30"
        )}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm",
          "transition-opacity duration-300",
          "md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-[70] w-72",
          "bg-zinc-950/95 backdrop-blur-2xl",
          "border-r border-white/[0.06]",
          "transform transition-transform duration-300 ease-out",
          "md:hidden",
          "flex flex-col",
          "pt-[env(safe-area-inset-top)]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header do drawer */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              "p-2 rounded-xl",
              "hover:bg-white/[0.06] text-zinc-400 hover:text-white",
              "transition-colors duration-200"
            )}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-3 mb-2">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, icon: Icon, label, badge }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        "transition-all duration-200",
                        "active:scale-[0.98]",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      {badge && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full">
                          {badge}
                        </span>
                      )}
                      {isActive && <ChevronRight size={14} className="text-emerald-400/50" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Desktop sidebar (sempre visivel) */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:border-r md:border-white/[0.06] md:bg-zinc-950/90 md:backdrop-blur-2xl">
        {/* Mesmo conteudo da nav acima, sem animacao */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-3 mb-2">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, icon: Icon, label, badge }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        "transition-all duration-200",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      {badge && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Conteudo principal */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </>
  );
}
```

**Regras do Drawer:**
- **SEMPRE** travar body scroll quando aberto (`overflow: hidden`)
- **SEMPRE** fechar ao navegar (useEffect em pathname)
- **SEMPRE** fechar com ESC e click no overlay
- **SEMPRE** `z-index` correto: overlay < drawer < header
- **SEMPRE** `pt-[env(safe-area-inset-top)]` para notch do iPhone
- **SEMPRE** `ease-out` no slide (nao `ease-in` — sai rapido, entra suave)
- **NUNCA** drawer mais largo que 80vw (ideal: `w-72` = 288px)

### 3. Mobile Header Fixo

Header responsivo que adapta entre mobile e desktop.

```tsx
export function ResponsiveHeader({ title }: { title: string }) {
  return (
    <header className={cn(
      "sticky top-0 z-40",
      "bg-zinc-950/80 backdrop-blur-xl",
      "border-b border-white/[0.06]",
      "pt-[env(safe-area-inset-top)]"
    )}>
      <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6 lg:px-8">
        {/* Titulo — trunca em mobile */}
        <h1 className="text-base md:text-lg font-semibold text-white truncate">
          {title}
        </h1>

        {/* Actions */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-4">
          {/* Botoes de acao aqui */}
        </div>
      </div>
    </header>
  );
}
```

### 4. Sheet/Bottom Sheet (Alternativa ao Modal em Mobile)

Modais em mobile devem subir de baixo, nao aparecer no centro.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Altura: "auto" | "half" | "full" */
  height?: "auto" | "half" | "full";
}

export function BottomSheet({ isOpen, onClose, title, children, height = "auto" }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const heightClass = {
    auto: "max-h-[85vh]",
    half: "h-[50vh]",
    full: "h-[95vh]",
  }[height];

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm",
          "transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sheet — sobe de baixo no mobile, vira modal centrado no desktop */}
      <div className={cn(
        "fixed z-[90]",
        // Mobile: bottom sheet
        "inset-x-0 bottom-0 md:inset-auto",
        // Desktop: modal centrado
        "md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
        "md:w-full md:max-w-lg md:rounded-2xl",
        // Shared
        "bg-zinc-950 border border-white/[0.08]",
        "rounded-t-2xl md:rounded-2xl",
        heightClass,
        "flex flex-col",
        "shadow-2xl shadow-black/60",
        "transform transition-all duration-300 ease-out",
        "pb-[env(safe-area-inset-bottom)]",
        isOpen
          ? "translate-y-0 md:translate-y-[-50%] opacity-100"
          : "translate-y-full md:translate-y-[-40%] opacity-0 pointer-events-none"
      )}>
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">{title}</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors duration-200"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </>
  );
}
```

---

## PATTERNS DE RESPONSIVIDADE

### 1. Layout Adaptativo (Sidebar -> Bottom Tab)

```tsx
// layout.tsx — App Router
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-black">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 border-r border-white/[0.06] bg-zinc-950/90">
        <DesktopSidebar />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* Bottom bar mobile */}
      <BottomTabBar />
    </div>
  );
}
```

### 2. Grid Responsivo (Colapsa Graciosamente)

```tsx
// 4 colunas -> 2 -> 1
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-6">

// 3 colunas -> 1 (pula o 2)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

// Sidebar + main (stacked em mobile)
<div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
  <div className="lg:w-80 lg:shrink-0">{/* sidebar content */}</div>
  <div className="flex-1">{/* main content */}</div>
</div>
```

### 3. Texto Responsivo

```tsx
// Hero que escala
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">

// Body que nao fica apertado
<p className="text-sm md:text-base text-zinc-400 leading-relaxed max-w-prose">

// Label que nao quebra
<span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-zinc-500 whitespace-nowrap">
```

### 4. Padding Responsivo

```tsx
// Pagina
<div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">

// Card
<div className="p-4 md:p-5 lg:p-6">

// Secoes
<div className="space-y-6 md:space-y-8 lg:space-y-10">
```

### 5. Tabelas Responsivas

Em mobile, tabelas viram cards:

```tsx
{/* Desktop: tabela */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full">
    {/* ... */}
  </table>
</div>

{/* Mobile: lista de cards */}
<div className="md:hidden space-y-3">
  {data.map(item => (
    <div key={item.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{item.name}</span>
        <StatusBadge status={item.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <div><span className="text-zinc-600">Valor:</span> {item.value}</div>
        <div><span className="text-zinc-600">Data:</span> {item.date}</div>
      </div>
    </div>
  ))}
</div>
```

### 6. Botoes Responsivos

```tsx
{/* Stack vertical em mobile, horizontal em desktop */}
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
  <button className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 ...">Confirmar</button>
  <button className="w-full sm:w-auto px-5 py-2.5 bg-white/[0.05] ...">Cancelar</button>
</div>

{/* Botao flutuante (FAB) — mobile only */}
<button className={cn(
  "md:hidden fixed bottom-24 right-5 z-40",
  "w-14 h-14 rounded-full",
  "bg-emerald-500 shadow-lg shadow-emerald-500/30",
  "flex items-center justify-center",
  "active:scale-[0.92] transition-all duration-200",
  "pb-[env(safe-area-inset-bottom,0px)]"
)}>
  <Plus size={24} className="text-black" />
</button>
```

### 7. Imagens e Midias Responsivas

```tsx
{/* Aspect ratio preservado */}
<div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900">
  <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
</div>

{/* Avatar que escala */}
<div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0">
```

---

## REGRAS ABSOLUTAS DE MOBILE

1. **SEMPRE** `env(safe-area-inset-*)` em elementos fixos (bottom bar, header, sheets)
2. **SEMPRE** area de toque minima 44x44px (melhor: 48x48) — usar `min-h-[44px] min-w-[44px]`
3. **SEMPRE** `pb-20 md:pb-0` no conteudo quando tem bottom nav
4. **SEMPRE** `overflow-hidden` no body/root quando drawer/modal esta aberto
5. **SEMPRE** fechar drawers/sheets ao navegar
6. **SEMPRE** inputs com `text-base` (16px) em mobile para evitar auto-zoom no iOS Safari
7. **SEMPRE** `touch-manipulation` em elementos clicaveis (previne delay de 300ms)
8. **SEMPRE** `will-change-transform` em elementos animados com translate
9. **SEMPRE** testar com viewport de 375px (iPhone SE) como minimo
10. **NUNCA** hover-only interactions — sempre ter fallback touch/click
11. **NUNCA** scroll horizontal acidental — verificar com `overflow-x-hidden` no container
12. **NUNCA** fontes menores que 12px em mobile (ilegivel)
13. **NUNCA** modais centrais em mobile — usar bottom sheet
14. **NUNCA** tooltips em mobile — usar tap para revelar info
15. **NUNCA** fixed positioning sem considerar teclado virtual (use `visual-viewport` API se necessario)

## CHECKLIST ANTES DE ENTREGAR

- [ ] Testou em 375px (iPhone SE)?
- [ ] Testou em 390px (iPhone 14)?
- [ ] Testou em 768px (iPad portrait)?
- [ ] Safe areas configuradas?
- [ ] Bottom nav com `pb-[env(safe-area-inset-bottom)]`?
- [ ] Conteudo nao fica atras de nav fixa?
- [ ] Inputs nao causam zoom no iOS?
- [ ] Drawer/modal trava scroll do body?
- [ ] Drawer/modal fecha com ESC e click fora?
- [ ] Areas de toque >= 44px?
- [ ] Textos legiveis sem zoom?
- [ ] Imagens com `sizes` prop correto?
- [ ] Sem scroll horizontal acidental?
