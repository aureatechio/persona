'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import {
  Menu,
  Plus,
  Send,
  Mic,
  MicOff,
  X,
  Users,
  Loader2,
  ChevronDown,
  ThumbsUp,
  Minus,
  ThumbsDown,
  User,
  Play,
  Square,
  Trash2,
  RotateCcw,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface PersonaFilters {
  regionBr: string;
  genderIdentity: string;
  civilStatus: string;
  socialClass: string;
  minAge: string;
  maxAge: string;
}

interface SentimentItem {
  comment: string;
  feeling: 'positive' | 'neutral' | 'negative';
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CONTEXT_OPTIONS = [
  'Economia',
  'Política',
  'Segurança Pública',
  'Mercado Financeiro',
  'Criminalidade',
  'Tecnologia',
];

const FILTER_ENUMS = {
  regionBr: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
  genderIdentity: ['Masculino', 'Feminino', 'Não-Binário', 'Outro'],
  civilStatus: ['Solteiro', 'Casado', 'União Estável', 'Divorciado', 'Viúvo'],
  socialClass: ['A', 'B1', 'B2', 'C1', 'C2', 'D', 'E'],
};

const INITIAL_FILTERS: PersonaFilters = {
  regionBr: '',
  genderIdentity: '',
  civilStatus: '',
  socialClass: '',
  minAge: '',
  maxAge: '',
};

const WEBHOOK_URL = 'https://webhook.aureatech.io/webhook/persona-aurea-campanha';

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CampanhasPage() {
  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Context chips
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [customContext, setCustomContext] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Message input
  const [message, setMessage] = useState('');

  // Image attachment
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Persona filters
  const [personaFilters, setPersonaFilters] = useState<PersonaFilters>(INITIAL_FILTERS);
  const [personaCount, setPersonaCount] = useState<number | null>(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const personaMenuRef = useRef<HTMLDivElement>(null);

  // Loading / send
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [results, setResults] = useState<SentimentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snapshot of what was submitted (shown in results view)
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [submittedContexts, setSubmittedContexts] = useState<string[]>([]);
  const [submittedImage, setSubmittedImage] = useState<string | null>(null);
  const [submittedAudioUrl, setSubmittedAudioUrl] = useState<string | null>(null);

  // ── Build Supabase query with filters ────────────────────────────────────
  const buildPersonaQuery = useCallback((selectFields: string) => {
    let query = supabase.from('personas').select(selectFields);
    if (personaFilters.genderIdentity) query = query.eq('gender_identity', personaFilters.genderIdentity);
    if (personaFilters.regionBr) query = query.eq('region_br', personaFilters.regionBr);
    if (personaFilters.socialClass) query = query.eq('social_class', personaFilters.socialClass);
    if (personaFilters.civilStatus) query = query.eq('civil_status', personaFilters.civilStatus);
    if (personaFilters.minAge) query = query.gte('age', parseInt(personaFilters.minAge));
    if (personaFilters.maxAge) query = query.lte('age', parseInt(personaFilters.maxAge));
    return query;
  }, [personaFilters]);

  // ── Fetch persona count on filter change (debounced) ─────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      let query = supabase.from('personas').select('id', { count: 'exact', head: true });
      if (personaFilters.genderIdentity) query = query.eq('gender_identity', personaFilters.genderIdentity);
      if (personaFilters.regionBr) query = query.eq('region_br', personaFilters.regionBr);
      if (personaFilters.socialClass) query = query.eq('social_class', personaFilters.socialClass);
      if (personaFilters.civilStatus) query = query.eq('civil_status', personaFilters.civilStatus);
      if (personaFilters.minAge) query = query.gte('age', parseInt(personaFilters.minAge));
      if (personaFilters.maxAge) query = query.lte('age', parseInt(personaFilters.maxAge));

      const { count, error } = await query;
      if (!error && count !== null) {
        setPersonaCount(count);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [personaFilters]);

  // ── Close persona menu on outside click ──────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setShowPersonaMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Countdown timer during send ──────────────────────────────────────────
  useEffect(() => {
    if (isSending) {
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isSending]);

  // ── Context chip handlers ────────────────────────────────────────────────
  const toggleContext = (ctx: string) => {
    setSelectedContexts(prev =>
      prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
    );
  };

  const addCustomContext = () => {
    const trimmed = customContext.trim();
    if (trimmed && !selectedContexts.includes(trimmed)) {
      setSelectedContexts(prev => [...prev, trimmed]);
    }
    setCustomContext('');
    setShowCustomInput(false);
  };

  // ── Image attachment ─────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setImageBase64(null);
    setImagePreview(null);
  };

  // ── Audio recording (WhatsApp-style) ─────────────────────────────────────
  const startRecording = async () => {
    try {
      // Clear any previous audio
      removeAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create blob URL for playback
        const blobUrl = URL.createObjectURL(audioBlob);
        setAudioBlobUrl(blobUrl);
        // Also convert to base64 for sending
        const reader = new FileReader();
        reader.onload = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setError('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const removeAudio = () => {
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setAudioBase64(null);
    setAudioBlobUrl(null);
    setIsPlayingAudio(false);
  };

  const togglePlayAudio = () => {
    if (!audioBlobUrl) return;
    if (isPlayingAudio && audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      const audio = new Audio(audioBlobUrl);
      audioElementRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
      setIsPlayingAudio(true);
    }
  };

  // ── Send campaign ────────────────────────────────────────────────────────
  const handleSend = async () => {
    try {
      if (!message.trim() && selectedContexts.length === 0) {
        setError('Adicione uma mensagem ou selecione pelo menos um contexto.');
        return;
      }

      setError(null);
      setResults(null);

      // Fetch persona IDs matching filters
      let personaIds: string[] = [];
      try {
        const { data: personaData, error: personaError } = await buildPersonaQuery('id');
        if (personaError) {
          setError('Erro ao buscar personas: ' + personaError.message);
          return;
        }
        personaIds = (personaData || []).map((p: any) => p.id as string);
      } catch (err: any) {
        setError('Erro ao buscar personas. Verifique sua conexão.');
        console.error('Erro Supabase:', err);
        return;
      }

      if (personaIds.length === 0) {
        setError('Nenhuma persona encontrada para os filtros selecionados. Ajuste os filtros.');
        return;
      }

      // Save snapshot of what is being submitted
      setSubmittedMessage(message.trim());
      setSubmittedContexts([...selectedContexts]);
      setSubmittedImage(imageBase64);
      setSubmittedAudioUrl(audioBlobUrl);

      // Open loading modal
      setIsSending(true);

      const body: Record<string, unknown> = {
        message: message.trim(),
        context: selectedContexts,
        personas: personaIds,
      };
      if (imageBase64) body.image = imageBase64;
      if (audioBase64) body.audio = audioBase64;

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Servidor retornou status ${response.status}`);

      const data = await response.json();

      // The response may be an array directly or wrapped
      const items: SentimentItem[] = Array.isArray(data) ? data : data.results || data.data || [];
      setResults(items);
    } catch (err: any) {
      console.error('Erro ao enviar campanha:', err);
      setError('Erro de conexão com o servidor. Verifique o webhook do n8n e tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  // ── Reset to create a new campaign ──────────────────────────────────────
  const handleNewCampaign = () => {
    setResults(null);
    setError(null);
    setMessage('');
    setSelectedContexts([]);
    setImageBase64(null);
    setImagePreview(null);
    removeAudio();
    setPersonaFilters(INITIAL_FILTERS);
    setSubmittedMessage('');
    setSubmittedContexts([]);
    setSubmittedImage(null);
    setSubmittedAudioUrl(null);
  };

  // ── Compute sentiment stats ──────────────────────────────────────────────
  const sentimentStats = results
    ? {
        positive: results.filter(r => r.feeling === 'positive'),
        neutral: results.filter(r => r.feeling === 'neutral'),
        negative: results.filter(r => r.feeling === 'negative'),
        total: results.length,
      }
    : null;

  const pct = (count: number) =>
    sentimentStats && sentimentStats.total > 0
      ? Math.round((count / sentimentStats.total) * 100)
      : 0;

  // ── Format countdown ─────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const showResults = results !== null && sentimentStats !== null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-black text-white overflow-x-hidden font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto lg:pl-64">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8 md:mb-12">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-1 tracking-tight">Campanhas</h1>
                <p className="text-zinc-400 text-sm md:text-base">
                  {showResults
                    ? 'Resultado da pesquisa de sentimento.'
                    : 'Pesquisa de sentimento com personas sintéticas.'}
                </p>
              </div>
            </div>

            {showResults && (
              <button
                onClick={handleNewCampaign}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5 shrink-0"
              >
                <RotateCcw size={16} />
                Criar Nova Campanha
              </button>
            )}
          </header>

          {/* ══════════════ INPUT VIEW ══════════════ */}
          {!showResults && (
            <>
              {/* ── Context chips ─────────────────────────────────────────── */}
              <section className="mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 px-1">
                  Contexto da pesquisa
                </p>
                <div className="flex flex-wrap gap-3">
                  {CONTEXT_OPTIONS.map(ctx => {
                    const selected = selectedContexts.includes(ctx);
                    return (
                      <button
                        key={ctx}
                        onClick={() => toggleContext(ctx)}
                        className={`px-5 py-2.5 rounded-2xl text-sm font-semibold border transition-all duration-200 flex items-center gap-2 ${
                          selected
                            ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {ctx}
                        {selected && <X size={14} className="opacity-60" />}
                      </button>
                    );
                  })}

                  {/* Custom contexts already added */}
                  {selectedContexts
                    .filter(c => !CONTEXT_OPTIONS.includes(c))
                    .map(ctx => (
                      <button
                        key={ctx}
                        onClick={() => toggleContext(ctx)}
                        className="px-5 py-2.5 rounded-2xl text-sm font-semibold border bg-white text-black border-white shadow-lg shadow-white/10 flex items-center gap-2 transition-all duration-200"
                      >
                        {ctx}
                        <X size={14} className="opacity-60" />
                      </button>
                    ))}

                  {/* "Outro..." chip */}
                  {!showCustomInput ? (
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="px-5 py-2.5 rounded-2xl text-sm font-semibold border bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 transition-all duration-200"
                    >
                      Outro...
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Digite o contexto..."
                        value={customContext}
                        onChange={e => setCustomContext(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomContext()}
                        className="bg-zinc-900 border border-zinc-700 rounded-2xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-zinc-500 w-48"
                      />
                      <button
                        onClick={addCustomContext}
                        className="p-2 bg-white text-black rounded-xl hover:bg-zinc-200 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => { setShowCustomInput(false); setCustomContext(''); }}
                        className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Chat input area ───────────────────────────────────────── */}
              <section className="mb-8">
                {/* Image preview */}
                {imagePreview && (
                  <div className="mb-4 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Anexo"
                      className="max-h-40 rounded-2xl border border-zinc-800 object-cover"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Main input box */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] shadow-2xl">
                  <textarea
                    rows={4}
                    placeholder="Descreva o tema ou pergunta para a pesquisa de sentimento..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-transparent px-6 pt-5 pb-3 text-white placeholder-zinc-600 focus:outline-none resize-none text-sm md:text-base rounded-t-[2rem]"
                  />

                  {/* Action bar */}
                  <div className="flex items-center justify-between px-4 pb-4">
                    <div className="flex items-center gap-1">
                      {/* Attach image */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                        title="Anexar imagem"
                      >
                        <Plus size={20} />
                      </button>

                      {/* Persona filter menu */}
                      <div className="relative" ref={personaMenuRef}>
                        <button
                          onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            showPersonaMenu
                              ? 'bg-white text-black'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <Users size={16} />
                          Ajustes de Personas
                          <ChevronDown size={14} className={`transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Floating menu – opens DOWNWARD */}
                        {showPersonaMenu && (
                          <div className="absolute top-full left-0 mt-3 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Filtros demográficos
                              </p>
                              <button
                                onClick={() => setPersonaFilters(INITIAL_FILTERS)}
                                className="text-[10px] font-bold text-zinc-600 hover:text-zinc-300 transition-colors"
                              >
                                Limpar
                              </button>
                            </div>

                            <div className="space-y-3">
                              {/* Localidade */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                                  Localidade
                                </label>
                                <select
                                  value={personaFilters.regionBr}
                                  onChange={e => setPersonaFilters({ ...personaFilters, regionBr: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer"
                                >
                                  <option value="">Todas</option>
                                  {FILTER_ENUMS.regionBr.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Gênero */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                                  Gênero
                                </label>
                                <select
                                  value={personaFilters.genderIdentity}
                                  onChange={e => setPersonaFilters({ ...personaFilters, genderIdentity: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer"
                                >
                                  <option value="">Todos</option>
                                  {FILTER_ENUMS.genderIdentity.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Estado Civil */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                                  Estado Civil
                                </label>
                                <select
                                  value={personaFilters.civilStatus}
                                  onChange={e => setPersonaFilters({ ...personaFilters, civilStatus: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer"
                                >
                                  <option value="">Todos</option>
                                  {FILTER_ENUMS.civilStatus.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Socioeconômico */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                                  Socioeconômico
                                </label>
                                <select
                                  value={personaFilters.socialClass}
                                  onChange={e => setPersonaFilters({ ...personaFilters, socialClass: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer"
                                >
                                  <option value="">Todas</option>
                                  {FILTER_ENUMS.socialClass.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Idade */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                                  Idade
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="de"
                                    value={personaFilters.minAge}
                                    onChange={e => setPersonaFilters({ ...personaFilters, minAge: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                                  />
                                  <span className="text-zinc-600 text-xs shrink-0">até</span>
                                  <input
                                    type="number"
                                    placeholder="até"
                                    value={personaFilters.maxAge}
                                    onChange={e => setPersonaFilters({ ...personaFilters, maxAge: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Persona count */}
                            <div className="mt-4 pt-3 border-t border-zinc-800">
                              <p className="text-sm text-center">
                                <span className="font-black text-white">
                                  {personaCount !== null ? personaCount.toLocaleString('pt-BR') : '...'}
                                </span>{' '}
                                <span className="text-zinc-500">personas disponíveis</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Audio – WhatsApp style */}
                      {audioBlobUrl && !isRecording ? (
                        /* Recorded audio: play / delete controls */
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                          <button
                            onClick={togglePlayAudio}
                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-zinc-800 transition-all"
                            title={isPlayingAudio ? 'Pausar' : 'Ouvir'}
                          >
                            {isPlayingAudio ? <Square size={16} /> : <Play size={16} />}
                          </button>
                          <span className="text-xs text-zinc-400 select-none">Áudio</span>
                          <button
                            onClick={removeAudio}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-zinc-800 transition-all"
                            title="Descartar áudio"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        /* Mic button: idle or recording */
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`p-2.5 rounded-xl transition-all ${
                            isRecording
                              ? 'bg-red-500/20 text-red-400 animate-pulse'
                              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                          }`}
                          title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                        >
                          {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                      )}

                      {/* Send button */}
                      <button
                        onClick={handleSend}
                        disabled={isSending}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                      >
                        Enviar
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Error message ─────────────────────────────────────────── */}
              {error && (
                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-medium">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ══════════════ RESULTS VIEW ══════════════ */}
          {showResults && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header with submitted content */}
              <div className="mb-10 p-6 md:p-8 bg-zinc-950 border border-zinc-900 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-4">
                  Pesquisa enviada
                </p>

                {/* Submitted message */}
                {submittedMessage && (
                  <p className="text-base md:text-lg text-white leading-relaxed mb-4">
                    &ldquo;{submittedMessage}&rdquo;
                  </p>
                )}

                {/* Context chips (read-only) */}
                {submittedContexts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {submittedContexts.map(ctx => (
                      <span
                        key={ctx}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                )}

                {/* Submitted image */}
                {submittedImage && (
                  <div className="mb-4">
                    <img
                      src={submittedImage}
                      alt="Imagem enviada"
                      className="max-h-48 rounded-2xl border border-zinc-800 object-cover"
                    />
                  </div>
                )}

                {/* Submitted audio */}
                {submittedAudioUrl && (
                  <div className="mb-2">
                    <audio controls src={submittedAudioUrl} className="h-10 max-w-xs [&::-webkit-media-controls-panel]:bg-zinc-800 rounded-xl" />
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Análise de Sentimento
                </h2>
              </div>

              {/* Percentage summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="text-center p-6 bg-zinc-950 border border-zinc-900 rounded-3xl">
                  <p className="text-4xl md:text-5xl font-black text-emerald-400 mb-1">
                    {pct(sentimentStats.positive.length)}%
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-2">
                    Positivo
                  </p>
                  <p className="text-xs text-zinc-600">
                    {sentimentStats.positive.length} de {sentimentStats.total} respostas
                  </p>
                </div>
                <div className="text-center p-6 bg-zinc-950 border border-zinc-900 rounded-3xl">
                  <p className="text-4xl md:text-5xl font-black text-amber-400 mb-1">
                    {pct(sentimentStats.neutral.length)}%
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-2">
                    Neutro
                  </p>
                  <p className="text-xs text-zinc-600">
                    {sentimentStats.neutral.length} de {sentimentStats.total} respostas
                  </p>
                </div>
                <div className="text-center p-6 bg-zinc-950 border border-zinc-900 rounded-3xl">
                  <p className="text-4xl md:text-5xl font-black text-red-400 mb-1">
                    {pct(sentimentStats.negative.length)}%
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-2">
                    Crítico
                  </p>
                  <p className="text-xs text-zinc-600">
                    {sentimentStats.negative.length} de {sentimentStats.total} respostas
                  </p>
                </div>
              </div>

              {/* Comment columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Positive */}
                <div>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <ThumbsUp size={16} className="text-emerald-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      Positivo
                    </p>
                  </div>
                  <div className="space-y-3">
                    {sentimentStats.positive.map((item, i) => (
                      <SentimentCard key={`pos-${i}`} item={item} index={i} color="emerald" />
                    ))}
                    {sentimentStats.positive.length === 0 && (
                      <EmptyColumn />
                    )}
                  </div>
                </div>

                {/* Neutral */}
                <div>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Minus size={16} className="text-amber-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Neutro
                    </p>
                  </div>
                  <div className="space-y-3">
                    {sentimentStats.neutral.map((item, i) => (
                      <SentimentCard key={`neu-${i}`} item={item} index={i} color="amber" />
                    ))}
                    {sentimentStats.neutral.length === 0 && (
                      <EmptyColumn />
                    )}
                  </div>
                </div>

                {/* Negative / Critical */}
                <div>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <ThumbsDown size={16} className="text-red-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                      Crítico
                    </p>
                  </div>
                  <div className="space-y-3">
                    {sentimentStats.negative.map((item, i) => (
                      <SentimentCard key={`neg-${i}`} item={item} index={i} color="red" />
                    ))}
                    {sentimentStats.negative.length === 0 && (
                      <EmptyColumn />
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ── Loading Modal ───────────────────────────────────────────── */}
      {isSending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-10 flex flex-col items-center gap-6 shadow-2xl max-w-sm w-full mx-4">
            <Loader2 size={48} className="text-white animate-spin" />
            <div className="text-center">
              <p className="text-lg font-bold mb-1">Processando campanha...</p>
              <p className="text-zinc-500 text-sm">
                As personas estão analisando sua pesquisa
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black tabular-nums tracking-wide">
                {formatTime(countdown)}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">
                Tempo estimado
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SentimentCard({
  item,
  index,
  color,
}: {
  item: SentimentItem;
  index: number;
  color: 'emerald' | 'amber' | 'red';
}) {
  const borderColors = {
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    amber: 'border-amber-500/20 hover:border-amber-500/40',
    red: 'border-red-500/20 hover:border-red-500/40',
  };

  const bgColors = {
    emerald: 'bg-emerald-500/5',
    amber: 'bg-amber-500/5',
    red: 'bg-red-500/5',
  };

  const textColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div
      className={`p-4 rounded-2xl border ${borderColors[color]} ${bgColors[color]} transition-all duration-200`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center`}>
          <User size={14} className={textColors[color]} />
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest ${textColors[color]}`}>
          Persona {index + 1}
        </span>
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">
        &ldquo;{item.comment}&rdquo;
      </p>
    </div>
  );
}

function EmptyColumn() {
  return (
    <div className="p-6 rounded-2xl border border-dashed border-zinc-800 text-center">
      <p className="text-xs text-zinc-600">Nenhuma resposta nesta categoria</p>
    </div>
  );
}
