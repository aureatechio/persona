'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Loader2,
  Video,
  FileText,
  Settings2,
  MessageCircle,
  Film,
  IdCard,
  Check,
  AlertCircle,
  Power,
  FileType2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoThemesSection from './VideoThemesSection';

export interface VoiceModel {
  id: string;
  name: string;
  status: string;
  elevenlabs_voice_id: string | null;
}

export interface LipsyncConfig {
  model: string;
  sync_mode: string;
  temperature: number;
}

export type VideoStrategy = 'name_sync' | 'full_video';

export interface BaseModel {
  id: string;
  name: string;
  slug: string | null;
  display_name: string | null;
  video_storage_path: string | null;
  voice_model_id: string | null;
  prompt_template: string;
  lipsync_config: LipsyncConfig | null;
  whatsapp_message_template: string | null;
  thank_you_message: string | null;
  closing_video_path: string | null;
  proposta_pdf_path: string | null;
  proposta_message_template: string | null;
  is_active: boolean;
  video_strategy: VideoStrategy | null;
  theme_intro_seconds: number | null;
  created_at: string;
  updated_at?: string;
  voice_models: VoiceModel | null;
}

export const DEFAULT_LIPSYNC: LipsyncConfig = {
  model: 'lipsync-2-pro',
  sync_mode: 'loop',
  temperature: 0.3,
};

export const DEFAULT_PROMPT = `Você é um assistente responsável por escrever respostas em vídeo para um político responder eleitores que gravaram vídeos.

A resposta será lida pelo político em vídeo. O objetivo é fazer o eleitor sentir que foi ouvido, respeitado e que o político está próximo.

ESTRUTURA DA RESPOSTA:
1 — Início natural com o nome da pessoa. O nome NUNCA pode aparecer no início da frase. Sempre começar com uma pequena introdução e só depois mencionar o nome.
2 — Reconhecer o problema citado. Mostrar que o político entendeu a realidade local.
3 — Compromisso político realista. Lutar por melhorias, cobrar autoridades, defender a população.
4 — Fechamento obrigatório com saudação positiva.

REGRA PARA OFENSAS: Se houver provocações, responder de forma educada e neutra. Encerrar de forma positiva.

FORMATAÇÃO PARA TTS:
- Use quebra de linha para pausas médias.
- Use linha em branco para pausas longas.
- Use reticências (…) para pausas curtas.

TAMANHO: máximo 35 palavras.
TOM: humano, próximo, respeitoso, simples.
Sem emojis. Apenas gere o texto da resposta.`;

const DEFAULT_WHATSAPP_TEMPLATE = 'Olá, {name}! Obrigado pela sua mensagem!';
const DEFAULT_THANK_YOU = '{name}, vamos te enviar um vídeo no seu WhatsApp em até 10 minutos.';
const DEFAULT_PROPOSTA_MESSAGE = '{name}, segue minha proposta de governo completa para você conhecer melhor. Conto com seu apoio e compartilhamento!';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';

function getStoragePublicUrl(path: string | null) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/voice-models/${path}`;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await readJsonSafe<{ error?: string }>(res);
    if (data?.error?.trim()) return data.error;
    return fallback;
  }
  const text = (await res.text().catch(() => '')).trim();
  return text || fallback;
}

async function uploadToStorage(file: File, name: string, kind: 'base' | 'closing' | 'proposta'): Promise<string> {
  let ext: 'mp4' | 'webm' | 'pdf';
  let contentType: string;
  if (kind === 'proposta') {
    ext = 'pdf';
    contentType = 'application/pdf';
  } else {
    ext = file.type.includes('webm') || file.name.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
    contentType = ext === 'webm' ? 'video/webm' : 'video/mp4';
  }

  const initRes = await fetch('/api/admin/video-modelo/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ext, kind }),
  });
  if (!initRes.ok) {
    throw new Error(await readApiError(initRes, 'Falha ao iniciar upload'));
  }
  const initData = await readJsonSafe<{ uploadUrl: string; videoPath: string }>(initRes);
  if (!initData?.uploadUrl || !initData?.videoPath) {
    throw new Error('Resposta inválida ao iniciar upload');
  }

  const putRes = await fetch(initData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(await readApiError(putRes, 'Falha no upload do vídeo'));
  }

  return initData.videoPath;
}

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial: BaseModel | null;
  onClose: () => void;
  onSaved: (model: BaseModel) => void;
}

export default function VideoModeloModal({ open, mode, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
  const [lipsync, setLipsync] = useState<LipsyncConfig>({ ...DEFAULT_LIPSYNC });
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [thankYou, setThankYou] = useState(DEFAULT_THANK_YOU);
  const [isActive, setIsActive] = useState(true);
  const [videoStrategy, setVideoStrategy] = useState<VideoStrategy>('name_sync');
  const [themeIntroSeconds, setThemeIntroSeconds] = useState<number>(4);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [closingFile, setClosingFile] = useState<File | null>(null);
  const [closingPreviewUrl, setClosingPreviewUrl] = useState<string | null>(null);
  const [closingPath, setClosingPath] = useState<string | null>(null); // path já salvo

  const [propostaFile, setPropostaFile] = useState<File | null>(null);
  const [propostaPath, setPropostaPath] = useState<string | null>(null); // path já salvo
  const [propostaMessage, setPropostaMessage] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const closingInputRef = useRef<HTMLInputElement>(null);
  const propostaInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name || '');
      setSlug(initial.slug || '');
      setDisplayName(initial.display_name || '');
      setPromptTemplate(initial.prompt_template || DEFAULT_PROMPT);
      setLipsync({ ...DEFAULT_LIPSYNC, ...(initial.lipsync_config || {}) });
      setWhatsappTemplate(initial.whatsapp_message_template || DEFAULT_WHATSAPP_TEMPLATE);
      setThankYou(initial.thank_you_message || '');
      setIsActive(initial.is_active);
      setClosingPath(initial.closing_video_path || null);
      setPropostaPath(initial.proposta_pdf_path || null);
      setPropostaMessage(initial.proposta_message_template || '');
      setVideoStrategy(initial.video_strategy === 'full_video' ? 'full_video' : 'name_sync');
      setThemeIntroSeconds(
        typeof initial.theme_intro_seconds === 'number' && Number.isFinite(initial.theme_intro_seconds)
          ? initial.theme_intro_seconds
          : 4,
      );
    } else {
      setName('');
      setSlug('');
      setDisplayName('');
      setPromptTemplate(DEFAULT_PROMPT);
      setLipsync({ ...DEFAULT_LIPSYNC });
      setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE);
      setThankYou(DEFAULT_THANK_YOU);
      setIsActive(true);
      setClosingPath(null);
      setPropostaPath(null);
      setPropostaMessage('');
      setVideoStrategy('name_sync');
      setThemeIntroSeconds(4);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setClosingFile(null);
    setClosingPreviewUrl(null);
    setPropostaFile(null);
    setError(null);
    setSaving(false);
  }, [open, initial]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (closingPreviewUrl) URL.revokeObjectURL(closingPreviewUrl);
    };
  }, [videoPreviewUrl, closingPreviewUrl]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  }

  function handleClosingSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (closingPreviewUrl) URL.revokeObjectURL(closingPreviewUrl);
    setClosingFile(file);
    setClosingPreviewUrl(URL.createObjectURL(file));
  }

  function handlePropostaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('A proposta de governo deve ser um arquivo PDF.');
      return;
    }
    setError(null);
    setPropostaFile(file);
  }

  async function handleSubmit() {
    setError(null);

    if (!slug.trim()) {
      setError('Slug é obrigatório (ex: flavio).');
      return;
    }
    if (!promptTemplate.trim()) {
      setError('Prompt template é obrigatório.');
      return;
    }
    if (mode === 'create' && !videoFile) {
      setError('Faça upload do vídeo base para criar um novo modelo.');
      return;
    }

    try {
      setSaving(true);

      // 1. Upload do vídeo base (se houver novo)
      let videoPath: string | undefined;
      if (videoFile) {
        videoPath = await uploadToStorage(videoFile, displayName || name || slug, 'base');
      }

      // 2. Upload do closing (se houver novo)
      let nextClosingPath: string | null | undefined = undefined;
      if (closingFile) {
        nextClosingPath = await uploadToStorage(closingFile, `closing_${slug}`, 'closing');
      }

      // 3. Upload da proposta (se houver nova)
      let nextPropostaPath: string | null | undefined = undefined;
      if (propostaFile) {
        nextPropostaPath = await uploadToStorage(propostaFile, `proposta_${slug}`, 'proposta');
      } else if (propostaPath === null && initial?.proposta_pdf_path) {
        // usuário clicou em "remover" no modo edit
        nextPropostaPath = null;
      }

      // 4. POST ou PATCH
      const payload: Record<string, unknown> = {
        name: name || displayName || slug,
        slug,
        display_name: displayName || name || slug,
        prompt_template: promptTemplate,
        lipsync_config: lipsync,
        whatsapp_message_template: whatsappTemplate,
        thank_you_message: thankYou,
        proposta_message_template: propostaMessage || null,
        is_active: isActive,
        video_strategy: videoStrategy,
        theme_intro_seconds: themeIntroSeconds,
      };
      if (videoPath) payload.videoPath = videoPath;
      if (nextClosingPath !== undefined) payload.closing_video_path = nextClosingPath;
      if (nextPropostaPath !== undefined) payload.proposta_pdf_path = nextPropostaPath;

      let res: Response;
      if (mode === 'create') {
        res = await fetch('/api/admin/video-modelo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        if (!initial) throw new Error('Modelo inicial ausente');
        res = await fetch('/api/admin/video-modelo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: initial.id, ...payload }),
        });
      }

      if (!res.ok) throw new Error(await readApiError(res, 'Erro ao salvar modelo'));
      const data = await readJsonSafe<{ model?: BaseModel }>(res);
      if (!data?.model) throw new Error('Resposta inválida do servidor');

      onSaved(data.model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const existingVideoUrl = getStoragePublicUrl(initial?.video_storage_path || null);
  const existingClosingUrl = getStoragePublicUrl(closingPath);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch md:items-center md:justify-center overflow-y-auto"
      onClick={() => !saving && onClose()}
    >
      <div
        className="relative w-full md:w-[min(960px,95vw)] md:max-h-[92vh] bg-zinc-950 md:rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {mode === 'create' ? 'Novo modelo de vídeo' : `Editar — ${initial?.display_name || initial?.name || 'Modelo'}`}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {mode === 'create'
                ? 'Configure vídeo base, voz, prompt e mensagens para um novo político'
                : `Slug: ${initial?.slug || '—'} · Atualize qualquer campo`}
            </p>
          </div>
          <button
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors duration-200 disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* ── Identidade ── */}
          <Section icon={<IdCard size={20} className="text-emerald-400" />} iconBg="bg-emerald-500/10" title="Identidade" subtitle="Como o sistema identifica este político">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Slug (URL)" hint="Aparece em /selfie-video/{slug}. Letras minúsculas, sem espaço.">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="ex: flavio"
                  className={inputClass}
                />
              </Field>
              <Field label="Nome de exibição" hint="Aparece no admin e nos relatórios">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ex: Flávio Bolsonaro"
                  className={inputClass}
                />
              </Field>
              <Field label="Nome interno (label)" hint="Rótulo do modelo (versão)">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Flávio v2"
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    'w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-200',
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.06]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Power size={14} /> {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="text-xs text-zinc-500">Clique para alternar</span>
                </button>
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Estratégia de vídeo"
                hint="Como o vídeo final é montado quando o tema tem vídeo gravado pelo candidato."
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVideoStrategy('name_sync')}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      videoStrategy === 'name_sync'
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          videoStrategy === 'name_sync' ? 'bg-emerald-400' : 'bg-zinc-600',
                        )}
                      />
                      <span className="text-sm font-semibold text-white">Sync do nome (rápido)</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Gera só 3s falando o nome + concatena com o vídeo do tema. ~$0.10/vídeo. Pode ter um corte perceptível na transição.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoStrategy('full_video')}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      videoStrategy === 'full_video'
                        ? 'bg-violet-500/10 border-violet-500/40'
                        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          videoStrategy === 'full_video' ? 'bg-violet-400' : 'bg-zinc-600',
                        )}
                      />
                      <span className="text-sm font-semibold text-white">Vídeo completo (premium)</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      GPT gera resposta + TTS longo + lipsync sobre o vídeo do tema. ~$1-2/vídeo. Sem corte visual.
                    </p>
                  </button>
                </div>
              </Field>
            </div>

            {videoStrategy === 'name_sync' && (
              <div className="mt-4 max-w-xs">
                <Field
                  label="Intro neutra do tema (segundos)"
                  hint="Quantos segundos iniciais do vídeo do tema serão SUBSTITUÍDOS pelo sync do nome. A candidata grava esses primeiros segundos falando um placeholder, e a câmera muda de posição depois — o compose pula esses segundos pra não repetir visualmente."
                >
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={themeIntroSeconds}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setThemeIntroSeconds(Number.isFinite(v) ? Math.max(0, v) : 0);
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* ── Vídeo Base ── */}
          <Section icon={<Video size={20} className="text-violet-400" />} iconBg="bg-violet-500/10" title="Vídeo base" subtitle="Será usado para lip-sync. A voz é clonada automaticamente ao salvar.">
            {/* Existing video */}
            {!videoFile && existingVideoUrl && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
                <video src={existingVideoUrl} controls className="w-full h-full object-cover" />
              </div>
            )}
            {/* New file */}
            {videoPreviewUrl && videoFile && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
                <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium backdrop-blur-sm">
                  Novo arquivo (não salvo)
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className={ghostBtnClass}
              >
                <Upload size={16} />
                {existingVideoUrl ? 'Trocar vídeo base' : 'Upload do vídeo base'}
              </button>
              {existingVideoUrl && !videoFile && (
                <span className="text-xs text-zinc-500">Trocar re-clona a voz no ElevenLabs.</span>
              )}
            </div>

            {initial?.voice_models && (
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-4">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">Voz clonada: {initial.voice_models.name}</p>
                  <p className="text-xs text-zinc-500">
                    ID: {initial.voice_models.elevenlabs_voice_id?.slice(0, 12)}…
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* ── Prompt ── */}
          <Section icon={<FileText size={20} className="text-amber-400" />} iconBg="bg-amber-500/10" title="Prompt do GPT-4" subtitle="Use {nome} e {transcricao} como variáveis">
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={10}
              className={cn(inputClass, 'resize-y font-mono text-[13px] leading-relaxed')}
              placeholder="Prompt template..."
            />
          </Section>

          {/* ── Lip-Sync ── */}
          <Section icon={<Settings2 size={20} className="text-sky-400" />} iconBg="bg-sky-500/10" title="Lip-Sync" subtitle="Parâmetros do Sync Labs">
            <div className="space-y-4">
              <Field label="Modelo">
                <select
                  value={lipsync.model}
                  onChange={(e) => setLipsync((p) => ({ ...p, model: e.target.value }))}
                  className={selectClass}
                >
                  <option className={optionClass} value="lipsync-2-pro">lipsync-2-pro · melhor qualidade</option>
                  <option className={optionClass} value="lipsync-2">lipsync-2 · equilíbrio</option>
                  <option className={optionClass} value="lipsync-1.9.0-beta">lipsync-1.9.0-beta · legado</option>
                </select>
              </Field>
              <Field label="Modo de sincronização">
                <select
                  value={lipsync.sync_mode}
                  onChange={(e) => setLipsync((p) => ({ ...p, sync_mode: e.target.value }))}
                  className={selectClass}
                >
                  <option className={optionClass} value="cut_off">cut_off · corta o conteúdo mais longo</option>
                  <option className={optionClass} value="bounce">bounce · rebobina</option>
                  <option className={optionClass} value="loop">loop · reinicia o vídeo</option>
                  <option className={optionClass} value="silence">silence · congela no último frame</option>
                  <option className={optionClass} value="remap">remap · acelera/desacelera</option>
                </select>
              </Field>
              <Field label={`Expressividade (${lipsync.temperature.toFixed(1)})`} hint="0 = sutil, 1 = exagerado. Recomendado: 0.3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={lipsync.temperature}
                  onChange={(e) => setLipsync((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-sky-500"
                />
              </Field>
            </div>
          </Section>

          {/* ── WhatsApp ── */}
          <Section icon={<MessageCircle size={20} className="text-emerald-400" />} iconBg="bg-emerald-500/10" title="WhatsApp e mensagens" subtitle="Use {name} para inserir o nome do eleitor">
            <div className="space-y-4">
              <Field label="Texto enviado junto com o vídeo no WhatsApp">
                <textarea
                  value={whatsappTemplate}
                  onChange={(e) => setWhatsappTemplate(e.target.value)}
                  rows={2}
                  className={cn(inputClass, 'resize-y')}
                  placeholder="Olá, {name}! Obrigado pela sua mensagem!"
                />
              </Field>
              <Field label="Mensagem de agradecimento (após gravar a selfie)">
                <textarea
                  value={thankYou}
                  onChange={(e) => setThankYou(e.target.value)}
                  rows={2}
                  className={cn(inputClass, 'resize-y')}
                  placeholder="{name}, em até 10 minutos você recebe o vídeo no WhatsApp"
                />
              </Field>
            </div>
          </Section>

          {/* ── Closing video ── */}
          <Section icon={<Film size={20} className="text-rose-400" />} iconBg="bg-rose-500/10" title="Vídeo de encerramento (opcional)" subtitle="Concatenado ao final. Se vazio, usa o padrão do worker.">
            {/* Existing */}
            {!closingFile && existingClosingUrl && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
                <video src={existingClosingUrl} controls className="w-full h-full object-cover" />
              </div>
            )}
            {closingPreviewUrl && closingFile && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
                <video src={closingPreviewUrl} controls className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium backdrop-blur-sm">
                  Novo arquivo (não salvo)
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <input
                ref={closingInputRef}
                type="file"
                accept="video/mp4,video/*"
                onChange={handleClosingSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => closingInputRef.current?.click()}
                disabled={saving}
                className={ghostBtnClass}
              >
                <Upload size={16} />
                {existingClosingUrl ? 'Trocar encerramento' : 'Upload de encerramento'}
              </button>
              {closingPath && !closingFile && (
                <button
                  type="button"
                  onClick={() => {
                    setClosingPath(null);
                    setClosingFile(null);
                    if (closingPreviewUrl) URL.revokeObjectURL(closingPreviewUrl);
                    setClosingPreviewUrl(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                >
                  Remover (usar padrão do worker)
                </button>
              )}
            </div>
          </Section>

          {/* ── Proposta de governo (PDF) ── */}
          <Section
            icon={<FileType2 size={20} className="text-orange-400" />}
            iconBg="bg-orange-500/10"
            title="Proposta de governo (opcional)"
            subtitle="PDF enviado por WhatsApp logo após o vídeo. Use {name} no texto."
          >
            {/* Existing/new file indicator */}
            {(propostaFile || propostaPath) && (
              <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <FileType2 size={16} className="text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">
                    {propostaFile ? propostaFile.name : (propostaPath?.split('/').pop() || 'proposta.pdf')}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {propostaFile ? 'Novo arquivo · não salvo' : 'PDF atual no storage'}
                  </p>
                </div>
                {propostaFile && (
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-medium uppercase tracking-wider">
                    Novo
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <input
                ref={propostaInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePropostaSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => propostaInputRef.current?.click()}
                disabled={saving}
                className={ghostBtnClass}
              >
                <Upload size={16} />
                {propostaPath || propostaFile ? 'Trocar PDF' : 'Upload do PDF'}
              </button>
              {(propostaPath || propostaFile) && (
                <button
                  type="button"
                  onClick={() => {
                    setPropostaPath(null);
                    setPropostaFile(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="mt-4">
              <Field label="Texto que acompanha o PDF no WhatsApp" hint="Use {name} para inserir o nome do eleitor.">
                <textarea
                  value={propostaMessage}
                  onChange={(e) => setPropostaMessage(e.target.value)}
                  rows={3}
                  className={cn(inputClass, 'resize-y')}
                  placeholder={DEFAULT_PROPOSTA_MESSAGE}
                />
              </Field>
            </div>

            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              💡 Para o político <em>falar no vídeo</em> que está enviando a proposta, adicione uma instrução no
              campo &quot;Prompt do GPT-4&quot; acima — algo como &quot;Mencione que estamos enviando a proposta de governo
              em anexo&quot;.
            </p>
          </Section>

          <VideoThemesSection baseModelId={initial?.id || null} />
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className={cn(ghostBtnClass, 'disabled:opacity-40')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-2.5',
              'bg-emerald-500 hover:bg-emerald-400',
              'text-black font-semibold text-sm rounded-xl',
              'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
              'active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Salvando…' : mode === 'create' ? 'Criar modelo' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────

const inputClass = cn(
  'w-full px-4 py-3',
  'bg-white/[0.04] hover:bg-white/[0.06]',
  'border border-white/[0.08] focus:border-emerald-500/50',
  'rounded-xl text-sm text-white placeholder:text-zinc-600',
  'outline-none focus:ring-2 focus:ring-emerald-500/20',
  'transition-all duration-200',
);

// <select> não herda bg do <input> no popup do SO; força appearance + chevron.
const selectClass = cn(
  inputClass,
  'appearance-none pr-10 cursor-pointer',
  'bg-no-repeat bg-[length:18px_18px] bg-[position:right_12px_center]',
  // chevron SVG inline (zinc-400)
  "bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23a1a1aa%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpolyline%20points=%276%209%2012%2015%2018%209%27/%3E%3C/svg%3E')]",
);

// <option> usa cores do SO por padrão; força bg escuro para Chromium/Firefox.
const optionClass = 'bg-zinc-900 text-white';

const ghostBtnClass = cn(
  'inline-flex items-center gap-2 px-5 py-2.5',
  'bg-white/[0.05] hover:bg-white/[0.1]',
  'text-zinc-300 hover:text-white',
  'border border-white/[0.08] hover:border-white/[0.15]',
  'rounded-xl font-medium text-sm',
  'active:scale-[0.97] transition-all duration-200',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

function Section({
  icon,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl', iconBg)}>{icon}</div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">{label}</label>
      {hint && <p className="text-xs text-zinc-600 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}
