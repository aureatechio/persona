/* ─── Shared Instagram Group Constants ─── */

export const GROUP_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  FAMILIA:      { bg: 'bg-amber-500/15',    text: 'text-amber-300',    border: 'border-amber-500/30',    glow: 'shadow-amber-500/10' },
  EMPREENDEDOR: { bg: 'bg-violet-500/15',   text: 'text-violet-300',   border: 'border-violet-500/30',   glow: 'shadow-violet-500/10' },
  FE:           { bg: 'bg-orange-500/15',    text: 'text-orange-300',   border: 'border-orange-500/30',   glow: 'shadow-orange-500/10' },
  ESPORTE:      { bg: 'bg-emerald-500/15',   text: 'text-emerald-300',  border: 'border-emerald-500/30',  glow: 'shadow-emerald-500/10' },
  EDUCACAO:     { bg: 'bg-teal-500/15',      text: 'text-teal-300',     border: 'border-teal-500/30',     glow: 'shadow-teal-500/10' },
  SAUDE:        { bg: 'bg-rose-500/15',      text: 'text-rose-300',     border: 'border-rose-500/30',     glow: 'shadow-rose-500/10' },
  TECH:         { bg: 'bg-cyan-500/15',      text: 'text-cyan-300',     border: 'border-cyan-500/30',     glow: 'shadow-cyan-500/10' },
  POLITICA:     { bg: 'bg-red-500/15',       text: 'text-red-300',      border: 'border-red-500/30',      glow: 'shadow-red-500/10' },
  MODA:         { bg: 'bg-fuchsia-500/15',   text: 'text-fuchsia-300',  border: 'border-fuchsia-500/30',  glow: 'shadow-fuchsia-500/10' },
  ARTE:         { bg: 'bg-purple-500/15',    text: 'text-purple-300',   border: 'border-purple-500/30',   glow: 'shadow-purple-500/10' },
  MUSICA:       { bg: 'bg-indigo-500/15',    text: 'text-indigo-300',   border: 'border-indigo-500/30',   glow: 'shadow-indigo-500/10' },
  GASTRONOMIA:  { bg: 'bg-yellow-500/15',    text: 'text-yellow-300',   border: 'border-yellow-500/30',   glow: 'shadow-yellow-500/10' },
  AGRO:         { bg: 'bg-lime-500/15',      text: 'text-lime-300',     border: 'border-lime-500/30',     glow: 'shadow-lime-500/10' },
  PET:          { bg: 'bg-amber-400/15',     text: 'text-amber-200',    border: 'border-amber-400/30',    glow: 'shadow-amber-400/10' },
  VIAGEM:       { bg: 'bg-sky-500/15',       text: 'text-sky-300',      border: 'border-sky-500/30',      glow: 'shadow-sky-500/10' },
  FITNESS:      { bg: 'bg-green-500/15',     text: 'text-green-300',    border: 'border-green-500/30',    glow: 'shadow-green-500/10' },
  JURIDICO:     { bg: 'bg-slate-400/15',     text: 'text-slate-300',    border: 'border-slate-400/30',    glow: 'shadow-slate-400/10' },
  INFLUENCER:   { bg: 'bg-pink-500/15',      text: 'text-pink-300',     border: 'border-pink-500/30',     glow: 'shadow-pink-500/10' },
  COMUNIDADE:   { bg: 'bg-blue-500/15',      text: 'text-blue-300',     border: 'border-blue-500/30',     glow: 'shadow-blue-500/10' },
  LIFESTYLE:    { bg: 'bg-pink-400/15',      text: 'text-pink-200',     border: 'border-pink-400/30',     glow: 'shadow-pink-400/10' },
  OUTRO:        { bg: 'bg-zinc-500/15',      text: 'text-zinc-300',     border: 'border-zinc-500/30',     glow: 'shadow-zinc-500/10' },
};

export const GROUP_LABELS: Record<string, string> = {
  FAMILIA: 'Família', EMPREENDEDOR: 'Empreendedor', FE: 'Fé', ESPORTE: 'Esporte',
  EDUCACAO: 'Educação', SAUDE: 'Saúde', TECH: 'Tech', POLITICA: 'Política',
  MODA: 'Moda', ARTE: 'Arte', MUSICA: 'Música', GASTRONOMIA: 'Gastronomia',
  AGRO: 'Agro', PET: 'Pet', VIAGEM: 'Viagem', FITNESS: 'Fitness',
  JURIDICO: 'Jurídico', INFLUENCER: 'Influencer', COMUNIDADE: 'Comunidade', LIFESTYLE: 'Lifestyle',
  OUTRO: 'Outro',
};

export const GRUPO_OPTIONS = [
  'FAMILIA', 'EMPREENDEDOR', 'FE', 'ESPORTE', 'EDUCACAO',
  'SAUDE', 'TECH', 'POLITICA', 'MODA', 'ARTE',
  'MUSICA', 'GASTRONOMIA', 'AGRO', 'PET', 'VIAGEM',
  'FITNESS', 'JURIDICO', 'INFLUENCER', 'COMUNIDADE', 'LIFESTYLE',
];

export function getGroupColor(grupo: string) {
  return GROUP_COLORS[grupo] || GROUP_COLORS.OUTRO;
}
