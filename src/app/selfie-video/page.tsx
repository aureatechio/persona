'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, ChevronRight, RotateCcw, Send, Check, Loader2, Phone, User, Video, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'dados' | 'gravacao' | 'preview' | 'enviando' | 'obrigado';

function formatPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  // Strip country code "55" if user typed it
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function SelfieVideoPage() {
  const [step, setStep] = useState<Step>('dados');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== CAMERA =====
  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador não suporta acesso à câmera. Use Chrome ou Safari.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao acessar câmera: ${msg}`);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // ===== RECORDING =====
  function startRecording() {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordingTime(0);

    let recorder: MediaRecorder;
    let mimeType: string;
    try {
      recorder = new MediaRecorder(streamRef.current);
      mimeType = recorder.mimeType || 'video/mp4';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao iniciar gravação: ${msg}`);
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStep('preview');
      stopCamera();
    };

    recorder.start(1000);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 19) {
          stopRecording();
          return 20;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  // ===== STEP NAVIGATION =====
  function handleContinueToDados() {
    if (!name.trim() || phone.replace(/\D/g, '').length !== 11) return;
    setStep('gravacao');
    setTimeout(() => startCamera(), 100);
  }

  function handleRegravar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRecordingTime(0);
    setStep('gravacao');
    setTimeout(() => startCamera(), 100);
  }

  // ===== UPLOAD =====
  const [sending, setSending] = useState(false);

  async function handleEnviar() {
    if (!recordedBlob || sending) return;
    setSending(true);

    setStep('enviando');
    setError(null);
    setUploadProgress(0);

    try {
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';

      // 1. Create DB record and get signed upload URL
      setUploadProgress(5);
      const res = await fetch('/api/selfie-video/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ''),
          ext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar registro');

      setUploadProgress(10);

      // 2. Upload video with progress tracking via XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', data.uploadUrl);
        xhr.setRequestHeader('Content-Type', ext === 'mp4' ? 'video/mp4' : 'video/webm');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // Map upload progress to 10-95% range
            const pct = Math.round(10 + (e.loaded / e.total) * 85);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error('Falha no upload do video'));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de conexao durante upload'));
        xhr.ontimeout = () => reject(new Error('Upload demorou demais'));
        xhr.timeout = 120000; // 2 min timeout

        xhr.send(recordedBlob);
      });

      // 3. Confirm upload → status "uploading" → "queued" (worker can now claim it)
      await fetch('/api/selfie-video/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id }),
      });

      // Upload confirmed — show thank you
      setStep('obrigado');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar';
      setError(msg);
      setStep('preview');
      setSending(false);
    }
  }

  // ===== RESET =====
  function handleReset() {
    setStep('dados');
    setName('');
    setPhone('');
    setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    setRecordingTime(0);
    setSending(false);
  }

  // ===== RENDER =====
  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <Video size={20} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Selfie Vídeo</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* ===== STEP: DADOS ===== */}
        {step === 'dados' && (
          <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full">
            {/* Decorative orbs */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
                <Camera size={28} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Grave seu depoimento
              </h1>
              <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
                Grave um vídeo curto e receba uma resposta personalizada no WhatsApp
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">
                  Como quer ser chamado?
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      'w-full pl-11 pr-4 py-3',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-base text-white placeholder:text-zinc-600',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                    placeholder="Seu nome"
                    autoComplete="given-name"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">
                  Seu telefone
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-zinc-500 text-sm pointer-events-none">
                    <span className="text-base leading-none">🇧🇷</span>
                    <span className="font-medium">+55</span>
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className={cn(
                      'w-full pl-[5.25rem] pr-4 py-3',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-base text-white placeholder:text-zinc-600',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                    placeholder="(XX) XXXXX-XXXX"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <button
                onClick={handleContinueToDados}
                disabled={!name.trim() || phone.replace(/\D/g, '').length !== 11}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 mt-4',
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
                Continuar
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: GRAVAÇÃO ===== */}
        {step === 'gravacao' && (
          <div className="flex-1 flex flex-col relative">
            {/* Camera preview */}
            <div className="flex-1 relative bg-zinc-950">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Top overlay */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
                <div className="text-center">
                  <p className="text-white text-sm font-medium">
                    {isRecording ? 'Gravando...' : 'Grave até 20s dizendo o que achou do evento'}
                  </p>
                </div>
              </div>

              {/* Timer */}
              {isRecording && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-full">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white text-sm font-mono font-bold">{recordingTime}s / 20s</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 w-48 h-1 bg-zinc-800/50 rounded-full overflow-hidden mx-auto">
                    <div
                      className="h-full bg-red-500 transition-all duration-1000 rounded-full"
                      style={{ width: `${(recordingTime / 20) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
                  <div className="text-center px-6">
                    <p className="text-red-400 text-sm mb-4">{error}</p>
                    <button
                      onClick={() => { setError(null); startCamera(); }}
                      className="px-4 py-2 bg-white/[0.1] rounded-xl text-white text-sm"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="shrink-0 bg-zinc-950 border-t border-white/[0.06] px-6 py-6">
              <div className="flex items-center justify-center">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className={cn(
                      'w-20 h-20 rounded-full',
                      'bg-red-500 hover:bg-red-400',
                      'shadow-lg shadow-red-500/30',
                      'flex items-center justify-center',
                      'active:scale-[0.95]',
                      'transition-all duration-200',
                      'ring-4 ring-white/20',
                    )}
                  >
                    <div className="w-7 h-7 bg-white rounded-full" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    disabled={recordingTime < 3}
                    className={cn(
                      'w-20 h-20 rounded-full',
                      'bg-red-500 hover:bg-red-400',
                      'shadow-lg shadow-red-500/30',
                      'flex items-center justify-center',
                      'active:scale-[0.95]',
                      'transition-all duration-200',
                      'ring-4 ring-white/20',
                      'disabled:opacity-50',
                    )}
                  >
                    <div className="w-7 h-7 bg-white rounded-md" />
                  </button>
                )}
              </div>
              {isRecording && recordingTime < 3 && (
                <p className="text-center text-zinc-500 text-xs mt-3">Mínimo 3 segundos</p>
              )}
            </div>
          </div>
        )}

        {/* ===== STEP: PREVIEW ===== */}
        {step === 'preview' && previewUrl && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative bg-zinc-950">
              <video
                ref={previewVideoRef}
                src={previewUrl}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>

            <div className="shrink-0 bg-zinc-950 border-t border-white/[0.06] px-6 py-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-center">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
              <div className="flex items-center gap-3 max-w-md mx-auto">
                <button
                  onClick={handleRegravar}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3',
                    'bg-white/[0.05] hover:bg-white/[0.1]',
                    'text-zinc-300 hover:text-white',
                    'border border-white/[0.08] hover:border-white/[0.15]',
                    'rounded-xl font-medium text-sm',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <RotateCcw size={16} />
                  Regravar
                </button>

                <button
                  onClick={handleEnviar}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3',
                    'bg-emerald-500 hover:bg-emerald-400',
                    'text-black font-semibold text-sm',
                    'rounded-xl',
                    'shadow-lg shadow-emerald-500/25',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <Send size={16} />
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: ENVIANDO (upload em andamento) ===== */}
        {step === 'enviando' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="relative w-20 h-20 mb-6">
              {/* Circular progress background */}
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="rgb(52, 211, 153)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - uploadProgress / 100)}`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-white">{uploadProgress}%</span>
              </div>
            </div>

            <p className="text-white font-medium">
              {uploadProgress < 10 ? 'Preparando...' : uploadProgress < 95 ? 'Enviando seu video...' : 'Finalizando...'}
            </p>
            <p className="text-zinc-500 text-sm mt-2">Nao feche esta tela</p>

            {/* Linear progress bar */}
            <div className="w-full max-w-xs mt-6">
              <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: OBRIGADO ===== */}
        {step === 'obrigado' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center max-w-sm space-y-6">
              {/* Success animation */}
              <div className="relative inline-flex">
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Heart size={32} className="text-emerald-400" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/10" style={{ animationDuration: '2s' }} />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  Obrigado pelo seu depoimento!
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  <span className="text-white font-medium">{name}</span>, nosso time vai assistir seu depoimento com muito carinho. E vamos te enviar um vídeo no seu WhatsApp em até 5 minutos.
                </p>
              </div>

              <button
                onClick={handleReset}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-6 py-3.5',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-emerald-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                )}
              >
                <Camera size={16} />
                Gravar outro
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
