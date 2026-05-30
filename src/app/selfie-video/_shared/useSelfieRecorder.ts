'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shared recorder/upload hook usado pelo [slug]/SelfieCapture.tsx.
 *
 * Encapsula a mecânica chata: permissões de câmera, MediaRecorder edge
 * cases (iOS Safari odeia mimeTypes explícitos), timer de 20s, XHR upload
 * com progresso e cleanup.
 *
 * O único input por político é `slug` — vai pro /api/selfie-video/process
 * que resolve o base_model_id e carimba na row de video_selfies.
 */

export type SelfieStep = 'dados' | 'gravacao' | 'preview' | 'enviando' | 'whatsapp' | 'obrigado';

export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export interface UseSelfieRecorderOptions {
  /** Politician slug — must match a row in video_base_models with is_active=true. */
  slug: string;
  /** Max recording length in seconds (default 20). */
  maxSeconds?: number;
  /** Min recording length before `stopRecording` becomes enabled (default 3). */
  minSeconds?: number;
}

export function useSelfieRecorder({
  slug,
  maxSeconds = 20,
  minSeconds = 3,
}: UseSelfieRecorderOptions) {
  const [step, setStep] = useState<SelfieStep>('dados');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [selfieId, setSelfieId] = useState<string | null>(null);
  const [uploadAttempt, setUploadAttempt] = useState(0);
  const [maxUploadAttempts] = useState(3);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera ────────────────────────────────────────────────
  // Resolução modesta (480x854) + framerate de 24fps pra reduzir o tamanho
  // do arquivo final. Em rede móvel ruim (zona AM) um vídeo de 20s a 720p
  // dava 20-25MB e travava o upload constantemente; com 480p+24fps cai pra
  // ~3-5MB e o upload completa em segundos. O compose normaliza pra
  // 720x1280 no final, então a perda visual é mínima.
  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador não suporta acesso à câmera. Use Chrome ou Safari.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 854 },
          frameRate: { ideal: 24, max: 30 },
        },
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
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // ── Recording ─────────────────────────────────────────────
  function startRecording() {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordingTime(0);

    let recorder: MediaRecorder;
    let mimeType: string;
    try {
      // Intentionally no mimeType — Safari/iOS throws on explicit types.
      // videoBitsPerSecond=800k garante ~2MB pra 20s mesmo se o navegador
      // ignorar as constraints de resolução do getUserMedia.
      recorder = new MediaRecorder(streamRef.current, {
        videoBitsPerSecond: 800_000,
        audioBitsPerSecond: 64_000,
      });
      mimeType = recorder.mimeType || 'video/mp4';
    } catch (err) {
      // Fallback: alguns navegadores rejeitam as opções; tenta sem.
      try {
        recorder = new MediaRecorder(streamRef.current);
        mimeType = recorder.mimeType || 'video/mp4';
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : String(err2);
        setError(`Erro ao iniciar gravação: ${msg}`);
        return;
      }
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
        if (prev >= maxSeconds - 1) {
          stopRecording();
          return maxSeconds;
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

  // ── Step navigation ───────────────────────────────────────
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

  // ── Upload ────────────────────────────────────────────────
  // Tenta o PUT no Storage até 3 vezes com backoff (2s → 4s → 8s). A
  // signed URL do Supabase tem 1h de validade, então a mesma URL é reusada
  // entre tentativas. Em rede móvel ruim isso recupera ~90% dos uploads
  // que antes ficavam zumbi no banco.
  async function uploadWithRetry(
    uploadUrl: string,
    blob: Blob,
    contentType: string,
  ): Promise<void> {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= maxUploadAttempts; attempt++) {
      setUploadAttempt(attempt);
      if (attempt > 1) {
        // Backoff exponencial: 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 2000));
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', contentType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round(10 + (e.loaded / e.total) * 85);
              setUploadProgress(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`HTTP ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('conexão caiu'));
          xhr.ontimeout = () => reject(new Error('timeout'));
          xhr.timeout = 180_000; // 3min — rede móvel lenta da AM precisa

          xhr.send(blob);
        });
        return; // sucesso
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.warn(`[selfie] upload tentativa ${attempt} falhou: ${lastErr.message}`);
        // Reset do progresso pra próxima tentativa
        if (attempt < maxUploadAttempts) setUploadProgress(10);
      }
    }
    throw lastErr || new Error('upload falhou após múltiplas tentativas');
  }

  async function handleEnviar() {
    if (!recordedBlob || sending) return;
    setSending(true);
    setStep('enviando');
    setError(null);
    setUploadProgress(0);
    setUploadAttempt(0);

    try {
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';

      setUploadProgress(5);
      const res = await fetch('/api/selfie-video/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ''),
          ext,
          slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar o envio');

      setSelfieId(data.id);
      setUploadProgress(10);

      await uploadWithRetry(
        data.uploadUrl,
        recordedBlob,
        ext === 'mp4' ? 'video/mp4' : 'video/webm',
      );
      setUploadProgress(100);

      // Confirm-upload nunca deveria falhar (já temos arquivo no Storage),
      // mas se falhar o watchdog auto_confirm_uploads pega depois.
      try {
        await fetch('/api/selfie-video/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.id }),
        });
      } catch (confirmErr) {
        console.warn('[selfie] confirm-upload falhou, o watchdog vai recuperar:', confirmErr);
      }

      setStep('whatsapp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar';
      // Mensagem amigável pro eleitor — esconde detalhes técnicos.
      setError(
        `Não conseguimos enviar seu vídeo (${msg}). Verifique sua internet e tente novamente.`
      );
      setStep('preview');
      setSending(false);
      setUploadAttempt(0);
    }
  }

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
    setSelfieId(null);
    setUploadAttempt(0);
  }

  function handleWhatsAppClick() {
    if (selfieId) {
      // Fire-and-forget: não bloquear o redirect pro WhatsApp esperando o
      // banco. Se cair, perdemos só a métrica desse click — não o vídeo.
      fetch('/api/selfie-video/whatsapp-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selfieId }),
        keepalive: true,
      }).catch(() => {});
    }
    setStep('obrigado');
  }

  function handleWhatsAppSkip() {
    setStep('obrigado');
  }

  const canContinueDados = name.trim().length > 0 && phone.replace(/\D/g, '').length === 11;
  const canStopRecording = recordingTime >= minSeconds;

  return {
    // state
    step,
    name,
    phone,
    isRecording,
    recordingTime,
    previewUrl,
    uploadProgress,
    uploadAttempt,
    maxUploadAttempts,
    error,
    sending,
    canContinueDados,
    canStopRecording,
    maxSeconds,
    minSeconds,

    // refs
    videoRef,
    previewVideoRef,

    // setters
    setName,
    setPhone: (v: string) => setPhone(formatPhone(v)),
    setError,

    // actions
    startCamera,
    stopCamera,
    startRecording,
    stopRecording,
    handleContinueToDados,
    handleRegravar,
    handleEnviar,
    handleReset,
    handleWhatsAppClick,
    handleWhatsAppSkip,
  };
}
