'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Video, Square, X, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onRecorded: (file: File) => void;
  maxDurationSec?: number;
}

export function VideoRecorder({ isOpen, onClose, onRecorded, maxDurationSec = 120 }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start camera when opened
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus('idle');
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[VideoRecorder] Camera error:', err);
          setError(
            err?.name === 'NotAllowedError'
              ? 'Permissao de camera negada. Habilite nas configuracoes do navegador.'
              : 'Nao foi possivel acessar a camera.',
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isOpen]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    chunksRef.current = [];
    setElapsed(0);
    setStatus('idle');
    setPreviewUrl(null);
    setRecordedBlob(null);
    setError(null);
  }, [previewUrl]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setElapsed(0);

    // Don't specify mimeType on Safari/iOS — let browser choose
    const recorder = new MediaRecorder(streamRef.current);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStatus('preview');

      // Show preview in video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.play();
      }
    };

    recorder.start(1000); // collect data every second
    setStatus('recording');

    // Timer
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      setElapsed(sec);

      // Auto-stop at max duration
      if (sec >= maxDurationSec) {
        stopRecording();
      }
    }, 500);
  }, [maxDurationSec]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const retake = useCallback(async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setElapsed(0);
    chunksRef.current = [];

    // Restart camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus('idle');
    } catch {
      setError('Nao foi possivel reiniciar a camera.');
    }
  }, [previewUrl]);

  const confirm = useCallback(() => {
    if (!recordedBlob) return;

    const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([recordedBlob], `gravacao-${Date.now()}.${ext}`, { type: recordedBlob.type });
    onRecorded(file);
    cleanup();
    onClose();
  }, [recordedBlob, onRecorded, cleanup, onClose]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[520px] sm:max-h-[85vh] z-50 flex flex-col rounded-2xl bg-zinc-950 border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-violet-400" />
            <span className="text-sm font-semibold text-white">Gravar Video</span>
          </div>
          <div className="flex items-center gap-3">
            {status === 'recording' && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-400 tabular-nums">{formatTime(elapsed)}</span>
                <span className="text-[10px] text-zinc-600">/ {formatTime(maxDurationSec)}</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-all duration-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Video area */}
        <div className="relative flex-1 min-h-0 bg-black">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
              <Video size={32} className="text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400">{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className={cn(
                'w-full h-full object-cover',
                status !== 'preview' && 'scale-x-[-1]', // mirror during live preview
              )}
              muted={status !== 'preview'}
              playsInline
              loop={status === 'preview'}
            />
          )}

          {/* Recording indicator overlay */}
          {status === 'recording' && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 backdrop-blur-xl border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400">REC {formatTime(elapsed)}</span>
            </div>
          )}

          {/* Duration progress bar */}
          {status === 'recording' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900">
              <div
                className="h-full bg-red-500 transition-all duration-500 ease-linear"
                style={{ width: `${(elapsed / maxDurationSec) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-white/[0.06]">
          {status === 'idle' && !error && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm shadow-lg shadow-red-500/25 active:scale-[0.97] transition-all duration-200"
            >
              <div className="w-3 h-3 rounded-full bg-white" />
              Gravar
            </button>
          )}

          {status === 'recording' && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm border border-white/[0.1] active:scale-[0.97] transition-all duration-200"
            >
              <Square size={14} className="fill-current" />
              Parar
            </button>
          )}

          {status === 'preview' && (
            <>
              <button
                onClick={retake}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-medium text-sm border border-white/[0.08] active:scale-[0.97] transition-all duration-200"
              >
                <RotateCcw size={14} />
                Regravar
              </button>
              <button
                onClick={confirm}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm shadow-lg shadow-emerald-500/25 active:scale-[0.97] transition-all duration-200"
              >
                <Check size={14} />
                Usar video
              </button>
            </>
          )}
        </div>

        {/* Help text */}
        {status === 'idle' && !error && (
          <p className="text-center text-[10px] text-zinc-600 pb-3 -mt-1">
            Maximo {Math.floor(maxDurationSec / 60)} minutos. O audio sera transcrito automaticamente.
          </p>
        )}
      </div>
    </>
  );
}
