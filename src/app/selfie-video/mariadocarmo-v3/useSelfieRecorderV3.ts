'use client';

import { useEffect, useRef, useState } from 'react';

export type SelfieStep = 'dados' | 'gravacao' | 'preview' | 'enviando' | 'whatsapp' | 'obrigado';

export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export interface UseSelfieRecorderV3Options {
  slug: string;
  maxSeconds?: number;
  minSeconds?: number;
}

export function useSelfieRecorderV3({ slug, maxSeconds = 20, minSeconds = 3 }: UseSelfieRecorderV3Options) {
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { stopCamera(); if (previewUrl) URL.revokeObjectURL(previewUrl); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setError('Seu navegador não suporta acesso à câmera.'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    } catch (err) { setError(`Erro ao acessar câmera: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordingTime(0);
    let recorder: MediaRecorder;
    let mimeType: string;
    try { recorder = new MediaRecorder(streamRef.current); mimeType = recorder.mimeType || 'video/mp4'; }
    catch (err) { setError(`Erro ao iniciar gravação: ${err instanceof Error ? err.message : String(err)}`); return; }
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setStep('preview');
      stopCamera();
    };
    recorder.start(1000);
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => { if (prev >= maxSeconds - 1) { stopRecording(); return maxSeconds; } return prev + 1; });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    setIsRecording(false);
  }

  function handleContinueToDados() {
    if (!name.trim() || phone.replace(/\D/g, '').length !== 11) return;
    setStep('gravacao');
    setTimeout(() => startCamera(), 100);
  }

  function handleRegravar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setRecordedBlob(null); setRecordingTime(0);
    setStep('gravacao');
    setTimeout(() => startCamera(), 100);
  }

  async function handleEnviar() {
    if (!recordedBlob || sending) return;
    setSending(true); setStep('enviando'); setError(null); setUploadProgress(0);
    try {
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      setUploadProgress(5);
      const res = await fetch('/api/v3/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.replace(/\D/g, ''), ext, slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar registro');
      setSelfieId(data.id);
      setUploadProgress(10);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', data.uploadUrl);
        xhr.setRequestHeader('Content-Type', ext === 'mp4' ? 'video/mp4' : 'video/webm');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(10 + (e.loaded / e.total) * 85)); };
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); } else reject(new Error('Falha no upload')); };
        xhr.onerror = () => reject(new Error('Erro de conexão'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
        xhr.timeout = 120000;
        xhr.send(recordedBlob);
      });
      await fetch('/api/v3/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id }),
      });
      setStep('whatsapp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
      setStep('preview'); setSending(false);
    }
  }

  function handleReset() {
    setStep('dados'); setName(''); setPhone(''); setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setError(null); setRecordingTime(0); setSending(false); setSelfieId(null);
  }

  function handleWhatsAppClick() {
    if (selfieId) {
      fetch('/api/v3/whatsapp-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selfieId }), keepalive: true }).catch(() => {});
    }
    setStep('obrigado');
  }

  function handleWhatsAppSkip() { setStep('obrigado'); }

  return {
    step, name, phone, isRecording, recordingTime, previewUrl, uploadProgress, error, sending,
    canContinueDados: name.trim().length > 0 && phone.replace(/\D/g, '').length === 11,
    canStopRecording: recordingTime >= minSeconds,
    maxSeconds, minSeconds, videoRef, previewVideoRef,
    setName, setPhone: (v: string) => setPhone(formatPhone(v)), setError,
    startCamera, stopCamera, startRecording, stopRecording,
    handleContinueToDados, handleRegravar, handleEnviar, handleReset, handleWhatsAppClick, handleWhatsAppSkip,
  };
}
