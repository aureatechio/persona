'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Save, Trash2, Check, AlertCircle, Video, Mic, FileText, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceModel {
  id: string;
  name: string;
  status: string;
  elevenlabs_voice_id: string | null;
}

interface LipsyncConfig {
  model: string;
  sync_mode: string;
  temperature: number;
}

const DEFAULT_LIPSYNC: LipsyncConfig = {
  model: 'lipsync-2-pro',
  sync_mode: 'cut_off',
  temperature: 0.3,
};

interface BaseModel {
  id: string;
  name: string;
  video_storage_path: string;
  voice_model_id: string;
  prompt_template: string;
  lipsync_config: LipsyncConfig | null;
  is_active: boolean;
  created_at: string;
  voice_models: VoiceModel | null;
}

const DEFAULT_PROMPT = `Você é um assistente que escreve respostas em vídeo para um candidato a deputado responder eleitores.

O eleitor gravou um vídeo dizendo por que vota nele e qual é o principal problema do bairro ou da cidade.

A resposta deve fazer o eleitor sentir que foi ouvido, respeitado e que teve sua dor reconhecida.

ESTRUTURA DA RESPOSTA:
1 — O nome NUNCA pode aparecer no início da frase. Sempre começar com uma pequena introdução antes do nome. Exemplos: "Meu querido {nome},", "Meu amigo {nome},", "Muito obrigado por participar, {nome},", "Que bom receber sua mensagem, {nome},".
2 — Reconhecer brevemente o problema citado. Mostrar que o candidato entendeu a situação.
3 — Compromisso político realista. Como deputado, ele pode: lutar por políticas públicas, cobrar autoridades, fiscalizar, propor leis, defender a população. NÃO pode prometer resolver diretamente problemas que dependem de prefeitura ou governo.
4 — Terminar com pedido de voto educado e sutil. Exemplos: "Conto com o seu voto.", "Seu voto pode me ajudar a lutar por você.", "Espero poder contar com seu apoio."

REGRA PARA PEGADINHAS OU OFENSAS:
Se o vídeo contiver piadas, provocações, ofensas ou pedidos absurdos: agradecer pela participação, valorizar o diálogo, manter postura respeitosa e finalizar com CTA de voto. Nunca reagir com agressividade ou ironia.

REGRA PARA NOMES DE CIDADES E BAIRROS:
Sempre escreva o nome completo da cidade ou bairro exatamente como se pronuncia em português brasileiro. NUNCA abrevie ou corte nomes. Se o eleitor mencionar uma cidade (ex: Cubatão, Itaquaquecetuba, Guarulhos, Carapicuíba), repita o nome completo na resposta. Para nomes difíceis, separe as sílabas com hífen na primeira menção para garantir pronúncia correta (ex: "Cu-ba-tão", "I-ta-qua-que-ce-tu-ba"). Nas menções seguintes pode usar o nome normal.

TAMANHO: máximo 50 palavras.
TOM: humano, próximo, respeitoso, simples, verdadeiro. Evitar discurso político longo, frases artificiais ou propaganda exagerada.
Sem emojis. Apenas gere o texto da resposta, sem explicações ou comentários.`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';

export default function VideoModeloPage() {
  const [model, setModel] = useState<BaseModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('Modelo Principal');
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
  const [lipsyncConfig, setLipsyncConfig] = useState<LipsyncConfig>({ ...DEFAULT_LIPSYNC });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  function updateLipsync<K extends keyof LipsyncConfig>(key: K, value: LipsyncConfig[K]) {
    setLipsyncConfig(prev => ({ ...prev, [key]: value }));
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadModel();
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  function getVideoPublicUrl(path: string) {
    return `${SUPABASE_URL}/storage/v1/object/public/voice-models/${path}`;
  }

  async function loadModel() {
    try {
      const res = await fetch('/api/admin/video-modelo');
      const data = await res.json();

      if (data.model) {
        setModel(data.model);
        setName(data.model.name);
        setPromptTemplate(data.model.prompt_template);
        setLipsyncConfig({ ...DEFAULT_LIPSYNC, ...(data.model.lipsync_config || {}) });
      }
    } catch (err) {
      console.error('Error loading model:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setMessage(null);
  }

  async function uploadVideoToStorage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    const res = await fetch('/api/admin/video-modelo/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha no upload');
    return data.videoPath;
  }

  async function handleCreate() {
    if (!videoFile) {
      setMessage({ type: 'error', text: 'Faça upload do vídeo base' });
      return;
    }
    if (!promptTemplate.trim()) {
      setMessage({ type: 'error', text: 'Configure o prompt template' });
      return;
    }

    try {
      setProcessing(true);
      setMessage(null);

      // Step 1: Upload vídeo ao Storage
      const videoPath = await uploadVideoToStorage(videoFile);

      // Step 2: Clonar voz + criar modelo base
      const res = await fetch('/api/admin/video-modelo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath, name, prompt_template: promptTemplate, lipsync_config: lipsyncConfig }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setModel(data.model);
      setVideoFile(null);
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
        setVideoPreviewUrl(null);
      }
      setMessage({ type: 'success', text: 'Modelo criado! Vídeo salvo e voz clonada com sucesso.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar modelo';
      setMessage({ type: 'error', text: msg });
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdate() {
    if (!model) return;

    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/admin/video-modelo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: model.id,
          name,
          prompt_template: promptTemplate,
          lipsync_config: lipsyncConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setModel(data.model);
      setMessage({ type: 'success', text: 'Modelo atualizado!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleReplace() {
    if (!videoFile || !model) return;

    try {
      setProcessing(true);
      setMessage(null);

      // Desativar modelo atual
      await fetch(`/api/admin/video-modelo?id=${model.id}`, { method: 'DELETE' });

      // Step 1: Upload novo vídeo ao Storage
      const videoPath = await uploadVideoToStorage(videoFile);

      // Step 2: Clonar voz + criar novo modelo
      const res = await fetch('/api/admin/video-modelo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath, name, prompt_template: promptTemplate, lipsync_config: lipsyncConfig }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setModel(data.model);
      setVideoFile(null);
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
        setVideoPreviewUrl(null);
      }
      setMessage({ type: 'success', text: 'Vídeo trocado e voz re-clonada com sucesso!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao trocar vídeo';
      setMessage({ type: 'error', text: msg });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!model) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/admin/video-modelo?id=${model.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao desativar');

      setModel(null);
      setName('Modelo Principal');
      setPromptTemplate(DEFAULT_PROMPT);
      setLipsyncConfig({ ...DEFAULT_LIPSYNC });
      setMessage({ type: 'success', text: 'Modelo desativado' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao desativar modelo' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 size={24} className="animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Modelo de Vídeo</h1>
            <p className="text-zinc-500 mt-1">Configure o vídeo base para o pipeline de selfie</p>
          </div>
          <div className="flex items-center gap-3">
            {model && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                <Check size={12} /> Ativo
              </span>
            )}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          )}>
            {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        {/* Video Base */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Video size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Vídeo Base</h2>
              <p className="text-xs text-zinc-500">O vídeo será usado para lip-sync e a voz será clonada automaticamente</p>
            </div>
          </div>

          {/* Saved video from DB */}
          {model?.video_storage_path && !videoFile && (
            <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
              <video
                src={getVideoPublicUrl(model.video_storage_path)}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* New file selected (not yet saved) */}
          {videoPreviewUrl && videoFile && (
            <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 aspect-video max-w-md">
              <video
                src={videoPreviewUrl}
                controls
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium backdrop-blur-sm">
                Novo arquivo (não salvo)
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5',
                'bg-white/[0.05] hover:bg-white/[0.1]',
                'text-zinc-300 hover:text-white',
                'border border-white/[0.08] hover:border-white/[0.15]',
                'rounded-xl font-medium text-sm',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Upload size={16} />
              {model?.video_storage_path ? 'Trocar vídeo base' : 'Upload do vídeo base'}
            </button>
          </div>

          {/* Voice clone info */}
          {model?.voice_models && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
              <Mic size={16} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium">Voz clonada: {model.voice_models.name}</p>
                <p className="text-xs text-zinc-500">ID: {model.voice_models.elevenlabs_voice_id?.slice(0, 12)}...</p>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Template */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <FileText size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Prompt Template</h2>
              <p className="text-xs text-zinc-500">Use {'{nome}'} e {'{transcricao}'} como variáveis</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Nome do modelo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                'w-full px-4 py-3',
                'bg-white/[0.04] hover:bg-white/[0.06]',
                'border border-white/[0.08] focus:border-emerald-500/50',
                'rounded-xl text-sm text-white placeholder:text-zinc-600',
                'outline-none focus:ring-2 focus:ring-emerald-500/20',
                'transition-all duration-200',
              )}
              placeholder="Ex: Modelo Principal"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Prompt do GPT-4</label>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={8}
              className={cn(
                'w-full px-4 py-3',
                'bg-white/[0.04] hover:bg-white/[0.06]',
                'border border-white/[0.08] focus:border-emerald-500/50',
                'rounded-xl text-sm text-white placeholder:text-zinc-600',
                'outline-none focus:ring-2 focus:ring-emerald-500/20',
                'transition-all duration-200 resize-y',
              )}
              placeholder="Prompt template..."
            />
          </div>

          {/* Preview parsed prompt */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Preview (exemplo)</p>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {promptTemplate
                .replace(/{nome}/g, 'João Carlos')
                .replace(/{transcricao}/g, 'Eu voto nele porque ele se preocupa com a gente. O maior problema aqui no bairro é o esgoto a céu aberto, ninguém resolve isso.')}
            </p>
          </div>
        </div>

        {/* Lip-sync Config (Sync Labs) */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-sky-500/10">
              <Settings2 size={20} className="text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Configurações do Lip-Sync</h2>
              <p className="text-xs text-zinc-500">Parâmetros do Sync Labs para controlar a sincronização labial</p>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">
              Modelo
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'lipsync-2-pro', label: 'Lipsync 2 Pro', desc: 'Melhor qualidade. Mais lento e mais caro, mas gera resultados mais realistas.' },
                { value: 'lipsync-2', label: 'Lipsync 2', desc: 'Boa qualidade com processamento mais rápido. Equilíbrio entre velocidade e resultado.' },
                { value: 'lipsync-1.9.0-beta', label: 'Lipsync 1.9 Beta', desc: 'Versão anterior. Pode funcionar melhor com certos tipos de vídeo.' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateLipsync('model', opt.value)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all duration-200',
                    lipsyncConfig.model === opt.value
                      ? 'bg-sky-500/10 border-sky-500/30 ring-1 ring-sky-500/20'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]',
                  )}
                >
                  <p className={cn(
                    'text-sm font-medium',
                    lipsyncConfig.model === opt.value ? 'text-sky-400' : 'text-zinc-300',
                  )}>{opt.label}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sync Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">
              Modo de sincronização
            </label>
            <p className="text-xs text-zinc-600 mb-3">
              Define o que acontece quando o áudio e o vídeo têm durações diferentes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { value: 'cut_off', label: 'Cortar', desc: 'Corta o conteúdo mais longo para igualar o mais curto. Ideal para a maioria dos casos.' },
                { value: 'bounce', label: 'Bounce', desc: 'O vídeo vai e volta (rebobina) para cobrir o áudio inteiro. Pode parecer artificial.' },
                { value: 'loop', label: 'Loop', desc: 'O vídeo reinicia do começo quando acaba. Bom se o vídeo base tem início/fim suave.' },
                { value: 'silence', label: 'Silêncio', desc: 'Preenche a diferença com silêncio. O vídeo congela no último frame.' },
                { value: 'remap', label: 'Remapear', desc: 'Acelera ou desacelera o vídeo para coincidir com a duração do áudio.' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateLipsync('sync_mode', opt.value)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all duration-200',
                    lipsyncConfig.sync_mode === opt.value
                      ? 'bg-sky-500/10 border-sky-500/30 ring-1 ring-sky-500/20'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]',
                  )}
                >
                  <p className={cn(
                    'text-sm font-medium',
                    lipsyncConfig.sync_mode === opt.value ? 'text-sky-400' : 'text-zinc-300',
                  )}>{opt.label}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">
              Expressividade (Temperature) — {lipsyncConfig.temperature.toFixed(1)}
            </label>
            <p className="text-xs text-zinc-600 mb-3">
              Controla o quanto a boca se movimenta. Valores baixos geram movimentos mais sutis e naturais. Valores altos geram movimentos mais amplos, podendo mostrar mais os dentes e parecer exagerado.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500 shrink-0 w-12 text-right">0.0</span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={lipsyncConfig.temperature}
                  onChange={(e) => updateLipsync('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-zinc-600">Sutil / Natural</span>
                  <span className="text-xs text-zinc-600">Expressivo / Exagerado</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500 shrink-0 w-12">1.0</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                type="button"
                onClick={() => updateLipsync('temperature', 0.1)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200',
                  lipsyncConfig.temperature === 0.1
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05]',
                )}
              >
                Muito sutil (0.1)
              </button>
              <button
                type="button"
                onClick={() => updateLipsync('temperature', 0.3)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200',
                  lipsyncConfig.temperature === 0.3
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05]',
                )}
              >
                Recomendado (0.3)
              </button>
              <button
                type="button"
                onClick={() => updateLipsync('temperature', 0.5)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200',
                  lipsyncConfig.temperature === 0.5
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05]',
                )}
              >
                Padrão Sync (0.5)
              </button>
            </div>
          </div>

          {/* Config Summary */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Configuração atual</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-medium">
                Modelo: {lipsyncConfig.model}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-medium">
                Sync: {lipsyncConfig.sync_mode}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-medium">
                Expressividade: {lipsyncConfig.temperature.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Processing indicator */}
        {processing && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <Loader2 size={24} className="text-violet-400 animate-spin shrink-0" />
              <div>
                <p className="text-white font-medium">Processando vídeo...</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Fazendo upload do vídeo e clonando a voz automaticamente via ElevenLabs. Isso pode levar alguns segundos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          {model && (
            <button
              onClick={handleDelete}
              disabled={saving || processing}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5',
                'bg-red-500/10 hover:bg-red-500/20',
                'text-red-400 hover:text-red-300',
                'border border-red-500/20 hover:border-red-500/30',
                'rounded-xl font-medium text-sm',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Trash2 size={16} />
              Desativar
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {/* Save prompt/name changes (no new video) */}
            {model && !videoFile && (
              <button
                onClick={handleUpdate}
                disabled={saving || processing || !promptTemplate.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-emerald-500/25',
                  'hover:shadow-emerald-400/30',
                  'active:scale-[0.97]',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            )}

            {/* Create new model (first time) */}
            {!model && videoFile && (
              <button
                onClick={handleCreate}
                disabled={processing || !promptTemplate.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-emerald-500/25',
                  'hover:shadow-emerald-400/30',
                  'active:scale-[0.97]',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                {processing ? 'Criando modelo + clonando voz...' : 'Criar modelo e clonar voz'}
              </button>
            )}

            {/* Replace video on existing model */}
            {model && videoFile && (
              <button
                onClick={handleReplace}
                disabled={processing || !promptTemplate.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3',
                  'bg-violet-500 hover:bg-violet-400',
                  'text-white font-semibold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-violet-500/25',
                  'hover:shadow-violet-400/30',
                  'active:scale-[0.97]',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {processing ? 'Trocando vídeo + re-clonando voz...' : 'Trocar vídeo e re-clonar voz'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
