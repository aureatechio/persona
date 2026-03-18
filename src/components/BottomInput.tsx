'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Image as ImageIcon,
  Video,
  X,
  Camera,
  Instagram,
  Tv,
  Radio,
  Newspaper,
  MapPin,
  ChevronDown,
  Sparkles,
  type LucideIcon,
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

const MEDIA_TYPES: { id: ContentMeta['mediaType']; label: string; icon: LucideIcon; color: string; bg: string; border: string }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { id: 'tv', label: 'TV', icon: Tv, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  { id: 'youtube', label: 'YouTube', icon: Video, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'tiktok', label: 'TikTok', icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { id: 'radio', label: 'Radio', icon: Radio, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'outdoor', label: 'Outdoor', icon: MapPin, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { id: 'impresso', label: 'Impresso', icon: Newspaper, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
];

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
  onSubmit,
  isProcessing,
  hasBlocks,
  personaCount = 0,
}: BottomInputProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mediaType, setMediaType] = useState<ContentMeta['mediaType'] | null>(null);
  const [candidateIdeology, setCandidateIdeology] = useState<ContentMeta['candidateIdeology'] | null>(null);
  const [selectedState, setSelectedState] = useState<string>('brasil');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<{ city: string; count: number }[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch cities when state changes
  useEffect(() => {
    if (selectedState === 'brasil' || !selectedState) {
      setAvailableCities([]);
      setSelectedCity('');
      return;
    }
    let cancelled = false;
    setLoadingCities(true);
    setSelectedCity('');
    fetch(`/api/arena/cities?state=${selectedState}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setAvailableCities(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAvailableCities([]); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [selectedState]);

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
      } else {
        continue;
      }
      setAttachments(prev => [
        ...prev,
        { id: crypto.randomUUID(), type, file, preview, name: file.name },
      ]);
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

  // When processing, show minimal bar
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
      <div className="w-full max-w-3xl space-y-6">

        {/* ═══ UPLOAD CARDS ═══ */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3 block">
            Envie seu material
          </span>
          <div className="grid grid-cols-3 gap-3">
            {/* Upload Image */}
            <button
              onClick={() => imageInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors duration-300">
                <ImageIcon size={22} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">Imagem</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Post, print, arte</p>
              </div>
            </button>

            {/* Upload Video */}
            <button
              onClick={() => videoInputRef.current?.click()}
              className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/5"
            >
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors duration-300">
                <Video size={22} className="text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">Video</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Reels, propaganda</p>
              </div>
            </button>

            {/* Record Video */}
            <button
              onClick={() => setShowRecorder(true)}
              className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors duration-300">
                <Camera size={22} className="text-cyan-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">Gravar</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Ate 2 minutos</p>
              </div>
            </button>
          </div>
        </div>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {attachments.map(att => (
              <div key={att.id}
                className="relative group/att inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] transition-all duration-200 hover:border-white/[0.15]"
              >
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
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MEDIA TYPE SELECTOR ═══ */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3 block">
            Tipo de midia
          </span>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {MEDIA_TYPES.map(mt => {
              const Icon = mt.icon;
              const isActive = mediaType === mt.id;
              return (
                <button key={mt.id} onClick={() => setMediaType(mt.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200',
                    isActive
                      ? `${mt.bg} ${mt.border} ${mt.color} shadow-lg`
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-zinc-300'
                  )}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-semibold">{mt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ IDEOLOGY + REGION ROW ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ideology */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3 block">
              Posicionamento do candidato
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCandidateIdeology('esquerda')}
                className={cn(
                  'flex items-center justify-center gap-2.5 py-3.5 rounded-xl border transition-all duration-200 font-semibold text-sm',
                  candidateIdeology === 'esquerda'
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-lg shadow-rose-500/5'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-zinc-300'
                )}>
                <div className={cn('w-2.5 h-2.5 rounded-full', candidateIdeology === 'esquerda' ? 'bg-rose-400' : 'bg-zinc-700')} />
                Esquerda
              </button>
              <button onClick={() => setCandidateIdeology('direita')}
                className={cn(
                  'flex items-center justify-center gap-2.5 py-3.5 rounded-xl border transition-all duration-200 font-semibold text-sm',
                  candidateIdeology === 'direita'
                    ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 shadow-lg shadow-blue-500/5'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-zinc-300'
                )}>
                <div className={cn('w-2.5 h-2.5 rounded-full', candidateIdeology === 'direita' ? 'bg-blue-400' : 'bg-zinc-700')} />
                Direita
              </button>
            </div>
          </div>

          {/* Region */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3 block">
              Regiao
            </span>
            <div className="space-y-2">
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
                  className="w-full pl-9 pr-8 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all duration-200">
                  <option value="brasil">Brasil (Nacional)</option>
                  {BRAZILIAN_STATES.map(s => <option key={s.uf} value={s.uf}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              </div>
              {selectedState !== 'brasil' && (
                <div className="relative">
                  <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                    disabled={loadingCities}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] disabled:opacity-50 focus:border-emerald-500/40 outline-none transition-all duration-200">
                    <option value="">{loadingCities ? 'Carregando cidades...' : 'Todas as cidades'}</option>
                    {availableCities.map(c => <option key={c.city} value={c.city}>{c.city} ({c.count})</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SUBMIT ═══ */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-[0.98]',
            canSend
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30'
              : 'bg-white/[0.04] text-zinc-600 border border-white/[0.06] cursor-not-allowed'
          )}
        >
          <Send size={16} />
          {canSend ? 'Analisar Material' : 'Selecione material, midia e posicionamento'}
        </button>

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={e => { if (e.target.files) { addFilesAsAttachments(e.target.files); e.target.value = ''; } }} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={e => { if (e.target.files) { addFilesAsAttachments(e.target.files); e.target.value = ''; } }} className="hidden" />

        {/* Video recorder modal */}
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
