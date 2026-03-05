'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Loader2,
  Video,
  Camera,
  Square,
  Play,
  RotateCcw,
  Check,
  Trash2,
  AlertCircle,
  Mic,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';

export interface VoiceModelState {
  id: string;
  elevenlabs_voice_id: string | null;
  status: 'recording' | 'processing' | 'ready' | 'approved' | 'deleted';
  video_storage_path: string | null;
  name: string;
  duration_seconds: number | null;
}

interface VoiceModelModalProps {
  open: boolean;
  onClose: () => void;
  voiceModel: VoiceModelState | null;
  onModelChange: (model: VoiceModelState | null) => void;
}

type Step = 'initial' | 'recording' | 'preview' | 'processing' | 'ready' | 'approved';

export function VoiceModelModal({ open, onClose, voiceModel, onModelChange }: VoiceModelModalProps) {
  const [step, setStep] = useState<Step>('initial');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [processingStep, setProcessingStep] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ALL refs together
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);

  // ALL callbacks together
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ALL effects together
  useEffect(() => {
    if (!open) return;
    if (voiceModel) {
      if (voiceModel.status === 'approved') setStep('approved');
      else if (voiceModel.status === 'ready') setStep('ready');
      else if (voiceModel.status === 'processing') setStep('processing');
      else setStep('initial');
    } else {
      setStep('initial');
    }
  }, [open, voiceModel]);

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopStream]);

  // Quando step muda para 'recording', o <video> aparece no DOM
  // e conectamos o stream + iniciamos o MediaRecorder
  useEffect(() => {
    if (step === 'recording' && pendingStreamRef.current && videoPreviewRef.current) {
      const stream = pendingStreamRef.current;
      videoPreviewRef.current.srcObject = stream;
      videoPreviewRef.current.muted = true;
      videoPreviewRef.current.play().catch(() => {});
      pendingStreamRef.current = null;

      // Tenta MP4 primeiro (Safari, Chrome recente), fallback WebM
      const mimeType = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stopStream();
        setStep('preview');
      };

      recorder.start(1000);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    }
  }, [step, stopStream]);

  if (!open) return null;

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      pendingStreamRef.current = stream;

      // Muda o step para 'recording' — isso renderiza o <video> no DOM
      // O useEffect acima vai conectar o stream quando o elemento existir
      setRecordingTime(0);
      setStep('recording');
    } catch (err) {
      console.error('Camera error:', err);
      setError('Nao foi possivel acessar a camera. Verifique as permissoes do navegador.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const reRecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
    setStep('initial');
  };

  const uploadAndClone = async () => {
    if (!recordedBlob) return;
    setStep('processing');
    setProcessingStep(0);
    setError('');

    try {
      setProcessingStep(1); // Enviando video...
      const formData = new FormData();
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', recordedBlob, `recording.${ext}`);
      formData.append('name', 'Meu Modelo');

      setProcessingStep(2); // Clonando voz...

      const res = await fetch('/api/voice-model/clone', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao clonar voz');
        setStep('initial');
        return;
      }

      setProcessingStep(3); // Concluido!
      onModelChange(data.model);
      setStep('ready');
    } catch (err) {
      console.error('Upload error:', err);
      setError('Falha no upload. Tente novamente.');
      setStep('initial');
    }
  };

  const approveModel = async () => {
    if (!voiceModel) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/voice-model/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: voiceModel.id, status: 'approved' }),
      });
      const data = await res.json();
      if (res.ok) {
        onModelChange(data.model);
        setStep('approved');
      }
    } catch {
      setError('Erro ao aprovar modelo');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const unapproveModel = async () => {
    if (!voiceModel) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/voice-model/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: voiceModel.id, status: 'ready' }),
      });
      const data = await res.json();
      if (res.ok) {
        onModelChange(data.model);
        setStep('ready');
      }
    } catch {
      setError('Erro ao desaprovar modelo');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const deleteModel = async () => {
    if (!voiceModel) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/voice-model/status?id=${voiceModel.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onModelChange(null);
        setStep('initial');
        setRecordedBlob(null);
        setRecordedUrl(null);
      } else {
        setError('Falha ao excluir modelo');
      }
    } catch {
      setError('Erro ao excluir modelo');
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const processingSteps = [
    { label: 'Preparando...', icon: Loader2 },
    { label: 'Enviando video...', icon: Video },
    { label: 'Clonando voz...', icon: Mic },
    { label: 'Modelo criado!', icon: Check },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          'relative w-full max-w-lg',
          'bg-zinc-950/95 backdrop-blur-2xl',
          'border border-white/[0.08]',
          'rounded-2xl shadow-2xl shadow-black/60',
          'overflow-hidden',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Video size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Modelo de Voz</h2>
              <p className="text-xs text-zinc-500">Clone sua voz para videos personalizados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* STEP: Initial - No model, show record prompt */}
          {step === 'initial' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Camera size={36} className="text-violet-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white tracking-tight">Gravar Video</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                  Grave um video falando por pelo menos <span className="text-violet-300 font-medium">30 segundos</span> para
                  clonar sua voz com alta fidelidade.
                </p>
              </div>
              <button
                onClick={startRecording}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3',
                  'bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-violet-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                )}
              >
                <Camera size={16} />
                Iniciar Gravacao
              </button>
            </div>
          )}

          {/* STEP: Recording - Camera live preview */}
          {step === 'recording' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full aspect-[3/4] max-h-[380px] rounded-2xl overflow-hidden bg-black border border-white/[0.08]">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Recording indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 backdrop-blur-sm border border-red-500/30">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-red-300">REC</span>
                </div>
                {/* Timer */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/[0.1]">
                  <span className={cn(
                    'text-lg font-mono font-semibold',
                    recordingTime >= 30 ? 'text-emerald-400' : 'text-white',
                  )}>
                    {formatTime(recordingTime)}
                  </span>
                  {recordingTime < 30 && (
                    <span className="text-xs text-zinc-500 ml-2">ideal: 0:30+</span>
                  )}
                  {recordingTime >= 30 && (
                    <span className="text-xs text-emerald-400/60 ml-2">otimo!</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={reRecord}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5',
                    'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white',
                    'border border-white/[0.08] rounded-xl text-sm font-medium',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <X size={14} />
                  Cancelar
                </button>
                <button
                  onClick={stopRecording}
                  disabled={recordingTime < 3}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5',
                    'rounded-xl text-sm font-semibold',
                    'active:scale-[0.97] transition-all duration-200',
                    recordingTime >= 3
                      ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/25'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                  )}
                >
                  <Square size={14} />
                  Parar Gravacao
                </button>
              </div>
            </div>
          )}

          {/* STEP: Preview - Playback recorded video */}
          {step === 'preview' && recordedUrl && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full aspect-[9/16] max-h-[380px] rounded-2xl overflow-hidden bg-black border border-white/[0.08]">
                <video
                  ref={videoPlaybackRef}
                  src={recordedUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={reRecord}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5',
                    'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white',
                    'border border-white/[0.08] rounded-xl text-sm font-medium',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <RotateCcw size={14} />
                  Regravar
                </button>
                <button
                  onClick={uploadAndClone}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5',
                    'bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm',
                    'rounded-xl shadow-lg shadow-violet-500/25',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <Check size={14} />
                  Usar este video
                </button>
              </div>
            </div>
          )}

          {/* STEP: Processing - Upload + clone progress */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Loader2 size={32} className="text-violet-400 animate-spin" />
              </div>
              <div className="w-full max-w-xs space-y-3">
                {processingSteps.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = i === processingStep;
                  const isDone = i < processingStep;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300',
                        isDone && 'text-emerald-400',
                        isActive && 'text-violet-300 bg-violet-500/10 border border-violet-500/20',
                        !isDone && !isActive && 'text-zinc-600',
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : isActive ? (
                        <Icon size={16} className="animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-700" />
                      )}
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-600">Isso pode levar ate 30 segundos...</p>
            </div>
          )}

          {/* STEP: Ready - Model created, can approve or delete */}
          {step === 'ready' && voiceModel && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white tracking-tight">Modelo Pronto!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                  Sua voz foi clonada com sucesso. Aprove o modelo para substituir as imagens por videos personalizados.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xs">
                <button
                  onClick={deleteModel}
                  disabled={deleting}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-white/[0.05] hover:bg-red-500/10 text-zinc-400 hover:text-red-300',
                    'border border-white/[0.08] hover:border-red-500/20',
                    'rounded-xl text-sm font-medium',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50',
                  )}
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Excluir
                </button>
                <button
                  onClick={approveModel}
                  disabled={updatingStatus}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5',
                    'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm',
                    'rounded-xl shadow-lg shadow-emerald-500/25',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50',
                  )}
                >
                  {updatingStatus ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Aprovar Modelo
                </button>
              </div>
            </div>
          )}

          {/* STEP: Approved - Model is active */}
          {step === 'approved' && voiceModel && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="relative p-4 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20">
                <Video size={32} className="text-fuchsia-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-zinc-950 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-white tracking-tight">Modelo Ativo</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                  Os videos personalizados estao substituindo as imagens de campanha. Cada follower tera um video com sua voz clonada.
                </p>
              </div>

              {/* Status badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Voz clonada ativa</span>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xs">
                <button
                  onClick={deleteModel}
                  disabled={deleting}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-white/[0.05] hover:bg-red-500/10 text-zinc-400 hover:text-red-300',
                    'border border-white/[0.08] hover:border-red-500/20',
                    'rounded-xl text-sm font-medium',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50',
                  )}
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Excluir
                </button>
                <button
                  onClick={unapproveModel}
                  disabled={updatingStatus}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-white/[0.05] hover:bg-amber-500/10 text-zinc-400 hover:text-amber-300',
                    'border border-white/[0.08] hover:border-amber-500/20',
                    'rounded-xl text-sm font-medium',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50',
                  )}
                >
                  {updatingStatus ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                  Desaprovar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
