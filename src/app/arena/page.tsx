// Arena PWA — Main Screen (exact match of mobile index.tsx)
// States: idle → hasAttachment → platformSelect → processing → complete → chatting

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Sparkles, ChevronDown, ChevronUp, Vote, User } from 'lucide-react';

import { useArenaStore, arenaSubmit, arenaCancel } from './store';
import { useAuthStore } from './authStore';
import type { Attachment, ChatMessage } from './types';

import { ArenaNav } from './components/ArenaNav';
import { ChatInput } from './components/ChatInput';
import { Toast } from './components/Toast';
import { AttachmentMenu } from './components/AttachmentMenu';
import { PlatformSelector } from './components/PlatformSelector';
import { ProcessingSteps } from './components/ProcessingSteps';
import { AnalysisSummary } from './components/AnalysisSummary';
import { AnalysisProgressLoader } from './components/AnalysisProgressLoader';
import { AuthModal } from './components/AuthModal';
import { ProfileSheet } from './components/ProfileSheet';

// ── Header Avatar (exact match of mobile HeaderAvatar) ──
function HeaderAvatar() {
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const handlePress = () => {
    if (isAuthenticated) setShowProfile(true);
    else setShowAuth(true);
  };

  const getInitials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <>
      <button onClick={handlePress} className="relative">
        {isAuthenticated && profile ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xs font-extrabold text-zinc-400">{getInitials(profile.name)}</span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <User size={14} className="text-zinc-500" />
          </div>
        )}
        {isAuthenticated && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" style={{ border: '1.5px solid #000' }} />
        )}
      </button>
      <ProfileSheet visible={showProfile} onClose={() => setShowProfile(false)} />
      <AuthModal visible={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
    </>
  );
}

type ScreenState = 'idle' | 'hasAttachment' | 'platformSelect' | 'processing' | 'complete';

export default function ArenaPage() {
  // Store selectors (granular, same as mobile)
  const phase = useArenaStore((s) => s.data.phase);
  const processedCount = useArenaStore((s) => s.data.processedCount);
  const totalCount = useArenaStore((s) => s.data.totalCount);
  const collectingStatus = useArenaStore((s) => s.collectingStatus);
  const isSubmitting = useArenaStore((s) => s.isSubmitting);
  const hasEverReceived = useArenaStore((s) => s.hasEverReceived);
  const simulation = useArenaStore((s) => s.data.simulation);
  const positive = useArenaStore((s) => s.data.positive);
  const negative = useArenaStore((s) => s.data.negative);
  const neutral = useArenaStore((s) => s.data.neutral);
  const segments = useArenaStore((s) => s.data.segments);
  const question = useArenaStore((s) => s.data.question);
  const totalPersonas = useArenaStore((s) => s.data.totalPersonas);
  const contentMeta = useArenaStore((s) => s.data.contentMeta);
  const avgScore = useArenaStore((s) => s.data.avgScore);
  const stateBreakdown = useArenaStore((s) => s.data.stateBreakdown);
  const reset = useArenaStore((s) => s.reset);
  const analiseData = useArenaStore((s) => s.analiseData);
  const setAnaliseData = useArenaStore((s) => s.setAnaliseData);
  const analiseLoading = useArenaStore((s) => s.analiseLoading);
  const setAnaliseLoading = useArenaStore((s) => s.setAnaliseLoading);
  const analiseError = useArenaStore((s) => s.analiseError);
  const setAnaliseError = useArenaStore((s) => s.setAnaliseError);
  const chatMessages = useArenaStore((s) => s.chatMessages);
  const addChatMessage = useArenaStore((s) => s.addChatMessage);
  const userMediaContext = useArenaStore((s) => s.userMediaContext);
  const setUserMediaContext = useArenaStore((s) => s.setUserMediaContext);
  const currentHistoryId = useArenaStore((s) => s.currentHistoryId);
  const setCurrentHistoryId = useArenaStore((s) => s.setCurrentHistoryId);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const initAuth = useAuthStore((s) => s.initialize);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [pendingTextQuestion, setPendingTextQuestion] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastVariant, setToastVariant] = useState<'info' | 'success'>('info');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevProcessedCount = useRef(processedCount);
  const prevPhase = useRef(phase);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => { initAuth(); }, [initAuth]);

  const isStopped = useArenaStore((s) => s.isStopped);
  const isStreaming = isSubmitting || (hasEverReceived && phase !== 'complete' && !isStopped);
  const isComplete = hasEverReceived && (phase === 'complete' || isStopped);

  // Toast: show when personas start being processed (progress > 0)
  useEffect(() => {
    if (processedCount > 0 && prevProcessedCount.current === 0) {
      setToastMsg('Pode sair do app que te avisaremos quando ficar pronto');
      setToastVariant('info');
      setToastVisible(true);
    }
    prevProcessedCount.current = processedCount;
  }, [processedCount]);

  // Toast: show when analysis completes
  useEffect(() => {
    if (phase === 'complete' && prevPhase.current !== 'complete' && hasEverReceived) {
      setToastMsg('Análise finalizada!');
      setToastVariant('success');
      setToastVisible(true);
    }
    prevPhase.current = phase;
  }, [phase, hasEverReceived]);

  // Live session tracking for monitor dashboard
  const liveSessionId = useRef<string | null>(null);

  // Create session when analysis starts
  useEffect(() => {
    if (isSubmitting && !liveSessionId.current && profile) {
      fetch('/api/arena/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id || 'anon',
          user_name: profile.name || '',
          user_email: profile.email || '',
          platform: Array.isArray(contentMeta?.mediaType) ? contentMeta.mediaType.join(', ') : contentMeta?.mediaType || '',
          region: profile.state || 'brasil',
        }),
      })
        .then(r => r.json())
        .then(res => { if (res.id) liveSessionId.current = res.id; })
        .catch(() => {});
    }
  }, [isSubmitting, profile]);

  // Update session progress
  useEffect(() => {
    if (!liveSessionId.current || processedCount === 0) return;
    fetch('/api/arena/live-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: liveSessionId.current,
        phase,
        processed_count: processedCount,
        total_count: totalCount,
      }),
    }).catch(() => {});
  }, [processedCount, phase]);

  // Mark session complete or error
  useEffect(() => {
    if (!liveSessionId.current) return;
    if (analiseData) {
      fetch('/api/arena/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: liveSessionId.current,
          status: 'complete',
          score: analiseData.score,
        }),
      }).catch(() => {});
      liveSessionId.current = null;
    }
    if (analiseError) {
      fetch('/api/arena/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: liveSessionId.current,
          status: 'error',
          error: analiseError,
        }),
      }).catch(() => {});
      liveSessionId.current = null;
    }
  }, [analiseData, analiseError]);

  let screenState: ScreenState = 'idle';
  if (isStreaming) screenState = 'processing';
  else if (isComplete) screenState = 'complete';
  else if (showPlatformSelector) screenState = 'platformSelect';
  else if (attachments.length > 0) screenState = 'hasAttachment';

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 300);
  }, [phase, analiseLoading, analiseData, chatMessages.length]);

  // Auto-call analise on complete (uses store state — persists across navigation)
  useEffect(() => {
    if (!isComplete || !simulation || analiseLoading || analiseData) return;
    setAnaliseLoading(true);

    const payload = JSON.stringify({
      question: question || '',
      positive, negative, neutral,
      totalPersonas: totalPersonas || 0,
      segments: segments || {},
      phase: 'complete',
      contentMeta: contentMeta ? {
        ...contentMeta,
        mediaType: contentMeta.mediaType,
      } : {},
      avgScore: avgScore || 0,
      stateBreakdown: stateBreakdown || {},
    });

    const tryFetch = (attempt: number) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      fetch('/api/arena/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      })
        .then((r) => { clearTimeout(timeout); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((json) => { if (json.error) throw new Error(json.error); setAnaliseData(json); })
        .catch((err) => {
          clearTimeout(timeout);
          if (attempt < 2) setTimeout(() => tryFetch(attempt + 1), 2000);
          else setAnaliseError('Falha ao gerar análise. Toque para tentar novamente.');
        });
    };
    tryFetch(1);
  }, [isComplete, simulation, analiseData, analiseLoading]);

  // Auto-save analysis to history when analiseData is set
  useEffect(() => {
    if (!analiseData || !isAuthenticated || !profile) return;
    const hId = useArenaStore.getState().currentHistoryId;
    fetch('/api/arena/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: hId || undefined,
        question: question || '',
        content_meta: contentMeta || {},
        analise_data: analiseData,
        arena_data: { positive, negative, neutral, avgScore, totalPersonas, segments, question, contentMeta, stateBreakdown },
        chat_messages: chatMessages,
      }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.id && !hId) setCurrentHistoryId(res.id); })
      .catch(() => {});
  }, [analiseData, isAuthenticated]);

  // Auto-save chat messages (debounced) when they change
  useEffect(() => {
    if (!currentHistoryId || chatMessages.length === 0) return;
    const timer = setTimeout(() => {
      fetch('/api/arena/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentHistoryId, chat_messages: chatMessages }),
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [chatMessages, currentHistoryId]);

  // File picker — record video still needs a programmatic ref (camera capture)
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Called by AttachmentMenu's native <label> file inputs (no input.click() needed)
  const handleFileFromMenu = useCallback((file: File, type: 'image' | 'video') => {
    console.log(`[File] Selected: ${file.name}, type: ${file.type}, size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);

    const id = Date.now().toString();

    // Add attachment with loading state immediately
    setAttachments((prev) => [...prev, {
      id, type, name: file.name,
      mimeType: type === 'image' ? 'image/jpeg' : (file.type || 'video/mp4'),
      file, uri: undefined,
    }]);

    if (type === 'image') {
      // Convert ANY image format (HEIC, BMP, TIFF, etc.) to JPEG via canvas
      // This is critical for iOS which uses HEIC — Claude only supports jpeg/png/gif/webp
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);

        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64 = jpegDataUrl.split(',')[1];
        setAttachments((prev) => prev.map((a) => a.id === id
          ? { ...a, uri: jpegDataUrl, base64, mimeType: 'image/jpeg' }
          : a
        ));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback: try FileReader directly (might work for JPEG/PNG)
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string | undefined;
          const base64 = dataUrl?.split(',')[1];
          setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, uri: dataUrl, base64 } : a));
        };
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    } else {
      // Video/audio: blob URL for preview
      let uri: string | undefined;
      try { uri = URL.createObjectURL(file); } catch {}
      setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, uri } : a));
    }
  }, []);

  const handleRecordVideo = useCallback(() => {
    const input = videoInputRef.current;
    if (!input) return;
    input.accept = 'video/*';
    input.setAttribute('capture', 'environment');
    input.click();
  }, []);

  const handleRecordedVideo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    handleFileFromMenu(file, 'video');
  }, [handleFileFromMenu]);

  const handleSendMessage = (text: string) => {
    if (!isAuthenticated) { setShowAuthModal(true); return; }
    if (screenState === 'hasAttachment') { setShowPlatformSelector(true); return; }
    if (screenState === 'complete' && analiseData) { handleChatQuestion(text); return; }
    if (screenState === 'idle' && text) {
      setPendingTextQuestion(text);
      setShowPlatformSelector(true);
    }
  };

  const handlePlatformConfirm = (platforms: string[]) => {
    setShowPlatformSelector(false);
    if (!profile) return;
    setAnaliseData(null);
    setShowFullAnalysis(false);

    const isTextOnly = attachments.length === 0 && pendingTextQuestion;

    // Detect attachment type (image / video / audio / text)
    let attachmentType: 'image' | 'video' | 'audio' | 'text' = 'text';
    if (!isTextOnly && attachments.length > 0) {
      const att = attachments[0];
      if (att.type === 'image') {
        attachmentType = 'image';
      } else if (att.mimeType?.startsWith('audio/')) {
        attachmentType = 'audio';
      } else {
        attachmentType = 'video';
      }
    }

    // Save to store (persists across tab navigation)
    setUserMediaContext({
      text: platforms.join(', '),
      attachmentPreviews: isTextOnly ? [] : attachments.map(a => ({ id: a.id, type: a.type, uri: a.uri })),
    });

    arenaSubmit({
      question: isTextOnly ? pendingTextQuestion : undefined,
      attachments: isTextOnly ? [] : attachments,
      contentMeta: {
        mediaType: platforms,
        candidateIdeology: profile.ideology === 'esquerda' ? 'esquerda' : 'direita',
        region: profile.state || 'brasil',
        city: profile.city || undefined,
        attachmentType,
      },
    });
    setAttachments([]);
    setPendingTextQuestion('');
  };

  const handleStop = useCallback(() => { arenaCancel(); }, []);

  const handleNewAnalysis = useCallback(() => {
    arenaCancel(); reset(); setAttachments([]);
    setShowFullAnalysis(false);
  }, [reset]);

  const handleChatQuestion = async (text: string) => {
    setShowFullAnalysis(false);
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    addChatMessage(userMsg);
    setChatLoading(true);
    try {
      const res = await fetch('/api/arena/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analiseData,
          arenaData: { question, positive, negative, neutral, segments, totalPersonas },
          messages: [...chatMessages, userMsg],
          question: text,
        }),
      });
      const json = await res.json();
      addChatMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: json.answer || json.error || 'Sem resposta', timestamp: Date.now() });
    } catch {
      addChatMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: 'Erro ao processar sua pergunta. Tente novamente.', timestamp: Date.now() });
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 200);
    }
  };

  const handleMicPress = async () => {
    if (isRecording) {
      setIsRecording(false);
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append('file', blob, 'recording.webm');
          const res = await fetch('/api/arena/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          if (data.text) handleSendMessage(data.text);
        } catch {} finally { setIsTranscribing(false); }
      };
      recorder.start();
      setIsRecording(true);
    } catch { alert('Não foi possível acessar o microfone.'); }
  };

  const hasConversation = !!(userMediaContext || isStreaming || isComplete);

  return (
    <div className="flex flex-col bg-black" style={{ height: '100vh', paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* ═══ HEADER BAR (exact match of mobile — title + avatar) ═══ */}
      <div className="flex items-center px-4 h-11 shrink-0" style={{ backgroundColor: '#000', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
        <span className="text-base font-extrabold text-white tracking-tight flex-1">VOTIA</span>
        <HeaderAvatar />
      </div>

      {/* ═══ IDLE — AnimatedLogo (exact match of mobile AnimatedLogo.tsx) ═══ */}
      {!hasConversation && screenState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden" style={{ paddingBottom: 160 }}>
          {/* Floating orbs */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 160, height: 160, backgroundColor: 'rgba(52,211,153,0.05)', top: '25%', left: '10%' }}
            animate={{ x: [0, 40, 0, -40, 0], y: [0, 15, 0, -15, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ width: 140, height: 140, backgroundColor: 'rgba(139,92,246,0.04)', bottom: '25%', right: '10%' }}
            animate={{ x: [0, -25, 0, 25, 0], y: [0, -20, 0, 20, 0] }}
            transition={{ duration: 10.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Rings */}
          <div className="relative w-[200px] h-[200px] flex items-center justify-center">
            <motion.div
              className="absolute w-[200px] h-[200px] rounded-full"
              style={{ border: '1px solid rgba(52,211,153,0.15)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute w-[140px] h-[140px] rounded-full"
              style={{ border: '1px dashed rgba(251,113,133,0.10)' }}
              animate={{ rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute w-[90px] h-[90px] rounded-full"
              style={{ border: '0.5px solid rgba(251,191,36,0.08)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Vote size={48} className="text-emerald-400/60" />
            </motion.div>
          </div>

          {/* VOTIA.BR branding */}
          <div className="flex items-baseline mt-8">
            <span className="text-[30px] font-light text-white tracking-[8px]">VOTIA</span>
            <span className="text-lg font-light text-white/35 tracking-wider">.BR</span>
          </div>
        </div>
      )}

      {/* Video capture input — only used for "Gravar vídeo" (camera) */}
      <input
        ref={videoInputRef}
        type="file"
        onChange={handleRecordedVideo}
        style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }}
      />

      {/* ═══ HAS ATTACHMENT — previews ═══ */}
      {!hasConversation && screenState === 'hasAttachment' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5" style={{ paddingBottom: 160 }}>
          <h3 className="text-base font-bold text-white">Material selecionado</h3>
          <div className="flex gap-2.5 flex-wrap justify-center">
            {attachments.map((att) => (
              <div key={att.id} className="w-24 h-24 rounded-[14px] overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                {att.uri && att.type === 'image' ? (
                  <img src={att.uri} alt="" className="w-full h-full object-cover" />
                ) : att.uri && att.type === 'video' ? (
                  <video src={att.uri} className="w-full h-full object-cover" muted playsInline />
                ) : !att.uri ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <span className="text-2xl">{att.type === 'video' ? '🎬' : '🖼'}</span>
                    <span className="text-[9px] text-zinc-500 truncate max-w-[80px]">{att.name}</span>
                  </div>
                )}
                <button onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                  <X size={12} className="text-white" />
                </button>
                {/* Type badge */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase" style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: att.type === 'video' ? '#38bdf8' : '#34d399' }}>
                  {att.type === 'video' ? 'Vídeo' : 'Imagem'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 text-center">Toque enviar para selecionar plataformas</p>
        </div>
      )}

      {/* ═══ CHAT FLOW (match mobile exactly) ═══ */}
      {hasConversation && (
        <>
          {/* Fixed top bar (sticky, never scrolls) */}
          <div className="flex justify-end px-4 py-2 shrink-0 sticky top-0 z-10 bg-black" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
            <button onClick={handleNewAnalysis} className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-all duration-200" style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.2)' }}>
              <RotateCcw size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Nova Análise</span>
            </button>
          </div>

          {/* Messages scroll (extra bottom padding for fixed input + nav) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ padding: 16, paddingBottom: 160 }}>
            <div className="space-y-3">

              {/* User media message */}
              {userMediaContext && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] ml-auto rounded-2xl rounded-br-sm p-3" style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.15)' }}>
                  {userMediaContext.attachmentPreviews.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {userMediaContext.attachmentPreviews.map((att) => (
                        <div key={att.id} className="w-12 h-12 rounded-[10px] overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          {att.type === 'image' && att.uri ? (
                            <img src={att.uri} alt="" className="w-full h-full object-cover" />
                          ) : att.type === 'video' && att.uri ? (
                            <video src={att.uri} className="w-full h-full object-cover" muted />
                          ) : (
                            <span className="text-lg">{att.type === 'video' ? '🎬' : '🖼'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[13px] text-zinc-200">Analisar no {userMediaContext.text}</p>
                </motion.div>
              )}

              {/* Unified processing: stays mounted until analiseData arrives */}
              {(isStreaming || isComplete) && !analiseData && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <ProcessingSteps phase={phase} processedCount={processedCount} totalCount={totalCount} collectingStatus={collectingStatus ?? undefined} onCancel={handleStop} region={profile?.state} analiseLoading={analiseLoading} />
                </motion.div>
              )}

              {/* Analysis error */}
              {isComplete && analiseError && !analiseLoading && (
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[13px] text-rose-400">{analiseError}</p>
                  <button onClick={() => { setAnaliseError(''); }} className="mt-2 px-4 py-2.5 rounded-xl text-[13px] text-zinc-300" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Analysis summary */}
              {analiseData && <AnalysisSummary analiseData={analiseData} />}

              {/* Chat messages */}
              {chatMessages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[88%] rounded-2xl p-3 ${msg.role === 'user' ? 'ml-auto rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={msg.role === 'user'
                    ? { backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.15)' }
                    : { backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }
                  }
                >
                  <p className="text-[13px] text-zinc-200 leading-5">{msg.content}</p>
                </motion.div>
              ))}

              {chatLoading && (
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[13px] text-zinc-600">Pensando...</p>
                </div>
              )}

              <div className="h-5" />
            </div>
          </div>
        </>
      )}

      {/* ═══ CHAT INPUT (fixed above tab bar — doesn't move with keyboard) ═══ */}
      <div className="fixed left-0 right-0 z-40" style={{ bottom: 100 }}>
        <ChatInput
          onAttachPress={() => setShowAttachMenu(true)}
          onSendMessage={handleSendMessage}
          onMicPress={handleMicPress}
          disabled={screenState === 'processing'}
          placeholder={isComplete ? 'Pergunte sobre a análise...' : screenState === 'hasAttachment' ? 'Contexto (opcional) — toque enviar' : 'O que você quer analisar?'}
          showAttach={screenState === 'idle' || screenState === 'hasAttachment'}
          showMic={!isComplete}
          forceSendVisible={screenState === 'hasAttachment'}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
        />
      </div>

      {/* ═══ NAV ═══ */}
      <ArenaNav />

      {/* ═══ TOAST ═══ */}
      <Toast message={toastMsg} visible={toastVisible} onClose={() => setToastVisible(false)} variant={toastVariant} />

      {/* ═══ MODALS ═══ */}
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); setShowPlatformSelector(true); }} />
      <AttachmentMenu visible={showAttachMenu} onClose={() => setShowAttachMenu(false)} onFileSelected={handleFileFromMenu} onRecordVideo={handleRecordVideo} />
      <PlatformSelector visible={showPlatformSelector} onClose={() => setShowPlatformSelector(false)} onConfirm={handlePlatformConfirm} />
    </div>
  );
}
