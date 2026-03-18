'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Image as ImageIcon,
  Video,
  X,
  Camera,
  Tv,
  Radio,
  Newspaper,
  MapPin,
  ChevronDown,
  Search,
} from 'lucide-react';
import { VideoRecorder } from './VideoRecorder';
import { cn } from '@/lib/utils';
import {
  type Attachment,
  isImageFile,
  isVideoFile,
  canAddAttachment,
  createImagePreview,
  createVideoThumbnail,
} from '@/lib/file-utils';
import type { ContentMeta } from '@/lib/arena/types';

/* ─── Brand SVG Icons ─────────────────────────────────────────────────── */

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="pointer-events-none">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)" />
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2">
          <stop stopColor="#feda75" />
          <stop offset=".3" stopColor="#fa7e1e" />
          <stop offset=".6" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function YouTubeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="pointer-events-none">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" fill="#FF0000" />
      <path d="m9.75 15.02 5.75-3.27-5.75-3.27v6.54z" fill="white" />
    </svg>
  );
}

function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="pointer-events-none">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 13.4 2h-3v13.4a2.59 2.59 0 0 1-2.6 2.6 2.59 2.59 0 0 1-2.6-2.6A2.59 2.59 0 0 1 7.8 12.8c.28 0 .55.04.8.12V9.84A5.67 5.67 0 0 0 2 15.4a5.59 5.59 0 0 0 5.8 5.6 5.59 5.59 0 0 0 5.8-5.6V9.04a7.28 7.28 0 0 0 4.4 1.48V7.44a4.38 4.38 0 0 1-1.4-1.62z" fill="#25F4EE" />
      <path d="M17.6 5.82A4.28 4.28 0 0 1 14.4 2h-3v13.4a2.59 2.59 0 0 1-2.6 2.6 2.59 2.59 0 0 1-2.6-2.6 2.59 2.59 0 0 1 2.6-2.6c.28 0 .55.04.8.12V9.84A5.67 5.67 0 0 0 3 15.4a5.59 5.59 0 0 0 5.8 5.6 5.59 5.59 0 0 0 5.8-5.6V9.04a7.28 7.28 0 0 0 4.4 1.48V7.44a4.38 4.38 0 0 1-1.4-1.62z" fill="#FE2C55" />
    </svg>
  );
}

/* ─── Constants ───────────────────────────────────────────────────────── */

const BRAZILIAN_STATES = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AM', name: 'Amazonas' },
  { uf: 'AP', name: 'Amapa' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceara' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espirito Santo' },
  { uf: 'GO', name: 'Goias' }, { uf: 'MA', name: 'Maranhao' }, { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'MS', name: 'Mato Grosso do Sul' }, { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'PA', name: 'Para' }, { uf: 'PB', name: 'Paraiba' }, { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piaui' }, { uf: 'PR', name: 'Parana' }, { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RO', name: 'Rondonia' },
  { uf: 'RR', name: 'Roraima' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'SC', name: 'Santa Catarina' }, { uf: 'SE', name: 'Sergipe' },
  { uf: 'SP', name: 'Sao Paulo' }, { uf: 'TO', name: 'Tocantins' },
];

interface MediaTypeOption {
  id: ContentMeta['mediaType'];
  label: string;
  icon: React.ReactNode;
  activeGradient: string;
  activeBorder: string;
  activeShadow: string;
}

const MEDIA_TYPES: MediaTypeOption[] = [
  {
    id: 'instagram', label: 'Instagram',
    icon: <InstagramIcon size={22} />,
    activeGradient: 'bg-gradient-to-br from-[#833ab4]/15 via-[#fd1d1d]/10 to-[#fcb045]/15',
    activeBorder: 'border-[#d62976]/40',
    activeShadow: 'shadow-[#d62976]/10',
  },
  {
    id: 'youtube', label: 'YouTube',
    icon: <YouTubeIcon size={22} />,
    activeGradient: 'bg-red-500/10',
    activeBorder: 'border-red-500/40',
    activeShadow: 'shadow-red-500/10',
  },
  {
    id: 'tiktok', label: 'TikTok',
    icon: <TikTokIcon size={22} />,
    activeGradient: 'bg-gradient-to-br from-[#25F4EE]/10 to-[#FE2C55]/10',
    activeBorder: 'border-[#25F4EE]/40',
    activeShadow: 'shadow-cyan-500/10',
  },
  {
    id: 'tv', label: 'TV',
    icon: <Tv size={20} className="text-sky-400 pointer-events-none" />,
    activeGradient: 'bg-sky-500/10',
    activeBorder: 'border-sky-500/40',
    activeShadow: 'shadow-sky-500/10',
  },
  {
    id: 'radio', label: 'Radio',
    icon: <Radio size={20} className="text-amber-400 pointer-events-none" />,
    activeGradient: 'bg-amber-500/10',
    activeBorder: 'border-amber-500/40',
    activeShadow: 'shadow-amber-500/10',
  },
  {
    id: 'outdoor', label: 'Outdoor',
    icon: <MapPin size={20} className="text-emerald-400 pointer-events-none" />,
    activeGradient: 'bg-emerald-500/10',
    activeBorder: 'border-emerald-500/40',
    activeShadow: 'shadow-emerald-500/10',
  },
  {
    id: 'impresso', label: 'Impresso',
    icon: <Newspaper size={20} className="text-zinc-400 pointer-events-none" />,
    activeGradient: 'bg-zinc-500/10',
    activeBorder: 'border-zinc-500/40',
    activeShadow: 'shadow-zinc-500/10',
  },
];

/* ─── City Autocomplete ──────────────────────────────────────────────── */

function CityAutocomplete({
  state,
  value,
  onChange,
}: {
  state: string;
  value: string;
  onChange: (city: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [cities, setCities] = useState<{ city: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load cities once when state changes
  useEffect(() => {
    if (!state || state === 'brasil') { setCities([]); return; }
    setLoading(true);
    fetch(`/api/arena/cities?state=${state}`)
      .then(r => r.json())
      .then(data => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, [state]);

  // Reset query when value changes externally
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? cities.filter(c => c.city.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : cities.slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? 'Carregando cidades...' : 'Buscar cidade (opcional)'}
        className="w-full pl-9 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-zinc-600 hover:bg-white/[0.05] hover:border-white/[0.12] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all duration-200"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/60 overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map(c => (
            <button key={c.city}
              onClick={() => { onChange(c.city); setQuery(c.city); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.06] transition-colors duration-150 text-left"
            >
              <span className="text-sm text-zinc-200">{c.city}</span>
              <span className="text-[10px] text-zinc-600 tabular-nums">{c.count} personas</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Props ────────────────────────────────────────────────────────────── */

interface BottomInputProps {
  onSubmit: (value: string) => void;
  isProcessing: boolean;
  placeholder?: string;
  customInput?: React.ReactNode;
  hasBlocks: boolean;
  personaCount?: number;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function BottomInput({
  isProcessing,
  hasBlocks,
}: BottomInputProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mediaType, setMediaType] = useState<ContentMeta['mediaType'] | null>(null);
  const [candidateIdeology, setCandidateIdeology] = useState<ContentMeta['candidateIdeology'] | null>(null);
  const [selectedState, setSelectedState] = useState<string>('brasil');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [showRecorder, setShowRecorder] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const addFilesAsAttachments = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!canAddAttachment(attachments)) break;
      let type: Attachment['type'] = 'image';
      let preview: string | undefined;
      if (isImageFile(file)) {
        type = 'image';
        try { preview = await createImagePreview(file); } catch { /* skip */ }
      } else if (isVideoFile(file)) {
        type = 'video';
        try { preview = await createVideoThumbnail(file); } catch { /* skip */ }
      } else { continue; }
      setAttachments(prev => [...prev, { id: crypto.randomUUID(), type, file, preview, name: file.name }]);
    }
  }, [attachments]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSubmit = () => {
    if (isProcessing || !mediaType || !candidateIdeology || attachments.length === 0) return;
    const contentMeta: ContentMeta = {
      mediaType,
      candidateIdeology,
      region: selectedState,
      ...(selectedCity && { city: selectedCity }),
    };
    window.dispatchEvent(new CustomEvent('arena-rich-submit', {
      detail: { question: '', contextText: '', attachments, contentMeta },
    }));
    setAttachments([]);
  };

  const canSend = !isProcessing && !!mediaType && !!candidateIdeology && attachments.length > 0;

  if (hasBlocks) {
    return (
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-sm text-zinc-500">Analise em andamento...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 pb-6 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-5">

        {/* ═══ UPLOAD CARDS ═══ */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2.5 block">
            Envie seu material
          </span>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => imageInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-white/[0.03] hover:bg-emerald-500/[0.06] border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                <ImageIcon size={20} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-200">Imagem</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">Post, print, arte</p>
              </div>
            </button>

            <button onClick={() => videoInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-white/[0.03] hover:bg-violet-500/[0.06] border border-white/[0.06] hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/5">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 group-hover:scale-110 transition-all duration-300">
                <Video size={20} className="text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-200">Video</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">Reels, propaganda</p>
              </div>
            </button>

            <button onClick={() => setShowRecorder(true)}
              className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-white/[0.03] hover:bg-cyan-500/[0.06] border border-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/5">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-300">
                <Camera size={20} className="text-cyan-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-200">Gravar</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">Ate 2 minutos</p>
              </div>
            </button>
          </div>
        </div>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {attachments.map(att => (
              <div key={att.id}
                className="relative inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
                {att.type === 'image' && att.preview ? (
                  <img src={att.preview} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Video size={16} className="text-violet-400" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-zinc-300 font-medium max-w-[140px] truncate">{att.name}</span>
                  <span className="text-[10px] text-zinc-600">
                    {att.type === 'video' ? 'Audio sera transcrito' : 'Contexto sera extraido'}
                  </span>
                </div>
                <button onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors duration-200">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MEDIA TYPE SELECTOR ═══ */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2.5 block">
            Plataforma
          </span>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {MEDIA_TYPES.map(mt => {
              const isActive = mediaType === mt.id;
              return (
                <button key={mt.id} onClick={() => setMediaType(mt.id)} type="button"
                  className={cn(
                    'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border cursor-pointer transition-all duration-200',
                    isActive
                      ? `${mt.activeGradient} ${mt.activeBorder} shadow-lg ${mt.activeShadow}`
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
                  )}>
                  <div className={cn('pointer-events-none transition-transform duration-200', isActive && 'scale-110')}>
                    {mt.icon}
                  </div>
                  <span className={cn(
                    'pointer-events-none text-[10px] font-semibold transition-colors duration-200',
                    isActive ? 'text-white' : 'text-zinc-500'
                  )}>{mt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ IDEOLOGY + REGION ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ideology */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2.5 block">
              Posicionamento
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCandidateIdeology('esquerda')}
                className={cn(
                  'relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-300 overflow-hidden',
                  candidateIdeology === 'esquerda'
                    ? 'bg-gradient-to-br from-rose-500/15 to-red-600/10 border-rose-500/40 shadow-lg shadow-rose-500/10'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
                )}>
                {candidateIdeology === 'esquerda' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent" />
                )}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                  candidateIdeology === 'esquerda'
                    ? 'bg-rose-500/20 ring-2 ring-rose-500/30'
                    : 'bg-white/[0.04]'
                )}>
                  <div className={cn(
                    'w-3 h-3 rounded-full transition-all duration-300',
                    candidateIdeology === 'esquerda' ? 'bg-rose-400 shadow-lg shadow-rose-500/50' : 'bg-zinc-700'
                  )} />
                </div>
                <span className={cn(
                  'text-sm font-bold relative z-10 transition-colors duration-200',
                  candidateIdeology === 'esquerda' ? 'text-rose-300' : 'text-zinc-500'
                )}>Esquerda</span>
              </button>

              <button onClick={() => setCandidateIdeology('direita')}
                className={cn(
                  'relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-300 overflow-hidden',
                  candidateIdeology === 'direita'
                    ? 'bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
                )}>
                {candidateIdeology === 'direita' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                )}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                  candidateIdeology === 'direita'
                    ? 'bg-blue-500/20 ring-2 ring-blue-500/30'
                    : 'bg-white/[0.04]'
                )}>
                  <div className={cn(
                    'w-3 h-3 rounded-full transition-all duration-300',
                    candidateIdeology === 'direita' ? 'bg-blue-400 shadow-lg shadow-blue-500/50' : 'bg-zinc-700'
                  )} />
                </div>
                <span className={cn(
                  'text-sm font-bold relative z-10 transition-colors duration-200',
                  candidateIdeology === 'direita' ? 'text-blue-300' : 'text-zinc-500'
                )}>Direita</span>
              </button>
            </div>
          </div>

          {/* Region */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2.5 block">
              Regiao
            </span>
            <div className="space-y-2">
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedCity(''); }}
                  className="w-full pl-9 pr-8 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all duration-200">
                  <option value="brasil">Brasil (Nacional)</option>
                  {BRAZILIAN_STATES.map(s => <option key={s.uf} value={s.uf}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              </div>
              {selectedState !== 'brasil' && (
                <CityAutocomplete
                  state={selectedState}
                  value={selectedCity}
                  onChange={setSelectedCity}
                />
              )}
            </div>
          </div>
        </div>

        {/* ═══ SUBMIT ═══ */}
        <button onClick={handleSubmit} disabled={!canSend}
          className={cn(
            'w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-[0.98]',
            canSend
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30'
              : 'bg-white/[0.04] text-zinc-600 border border-white/[0.06] cursor-not-allowed'
          )}>
          <Send size={16} />
          {canSend ? 'Analisar Material' : 'Selecione material, plataforma e posicionamento'}
        </button>

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={e => { if (e.target.files) { addFilesAsAttachments(e.target.files); e.target.value = ''; } }} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={e => { if (e.target.files) { addFilesAsAttachments(e.target.files); e.target.value = ''; } }} className="hidden" />

        <VideoRecorder
          isOpen={showRecorder}
          onClose={() => setShowRecorder(false)}
          onRecorded={(file) => addFilesAsAttachments([file])}
          maxDurationSec={120}
        />
      </div>
    </div>
  );
}
