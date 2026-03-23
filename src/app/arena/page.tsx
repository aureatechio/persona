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
  const chatMessages = useArenaStore((s) => s.chatMessages);
  const addChatMessage = useArenaStore((s) => s.addChatMessage);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const initAuth = useAuthStore((s) => s.initialize);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [analiseLoading, setAnaliseLoading] = useState(false);
  const [analiseError, setAnaliseError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [userMediaContext, setUserMediaContext] = useState<{ text: string; attachments: Attachment[] } | null>(null);
  const hasCalledAnalise = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => { initAuth(); }, [initAuth]);

  const isStreaming = isSubmitting || (hasEverReceived && phase !== 'complete' && !wasStopped);
  const isComplete = hasEverReceived && (phase === 'complete' || wasStopped);

  let screenState: ScreenState = 'idle';
  if (isStreaming) screenState = 'processing';
  else if (isComplete) screenState = 'complete';
  else if (showPlatformSelector) screenState = 'platformSelect';
  else if (attachments.length > 0) screenState = 'hasAttachment';

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 300);
  }, [phase, analiseLoading, analiseData, chatMessages.length]);

  // Auto-call analise on complete
  useEffect(() => {
    if (!isComplete || !simulation || hasCalledAnalise.current || analiseData) return;
    hasCalledAnalise.current = true;
    setAnaliseLoading(true);
    setAnaliseError('');

    const payload = JSON.stringify({
      question: question || '',
      positive, negative, neutral,
      totalPersonas: totalPersonas || 0,
      segments: segments || {},
      phase: 'complete',
      contentMeta: contentMeta ? {
        ...contentMeta,
        mediaType: Array.isArray(contentMeta.mediaType) ? contentMeta.mediaType.join(', ') : contentMeta.mediaType,
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
        .then((json) => { if (json.error) throw new Error(json.error); setAnaliseData(json); setAnaliseLoading(false); })
        .catch((err) => {
          clearTimeout(timeout);
          if (attempt < 2) setTimeout(() => tryFetch(attempt + 1), 2000);
          else { setAnaliseError('Falha ao gerar análise. Toque para tentar novamente.'); setAnaliseLoading(false); }
        });
    };
    tryFetch(1);
  }, [isComplete, simulation]);

  // File picker
  const pickFile = (accept: string, type: 'image' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const att: Attachment = { id: Date.now().toString(), type, name: file.name, mimeType: file.type, file };
      if (type === 'image') att.uri = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, att]);
    };
    input.click();
  };

  const handleSendMessage = (text: string) => {
    if (!isAuthenticated) { setShowAuthModal(true); return; }
    if (screenState === 'hasAttachment') { setShowPlatformSelector(true); return; }
    if (screenState === 'complete' && analiseData) { handleChatQuestion(text); return; }
    if (screenState === 'idle' && text) alert('Para iniciar a análise, anexe uma imagem ou vídeo usando o botão de anexo.');
  };

  const handlePlatformConfirm = (platforms: string[]) => {
    setShowPlatformSelector(false);
    if (!profile) return;
    setWasStopped(false);
    hasCalledAnalise.current = false;
    setAnaliseData(null);
    setShowFullAnalysis(false);

    setUserMediaContext({ text: platforms.join(', '), attachments: [...attachments] });

    arenaSubmit({
      attachments,
      contentMeta: {
        mediaType: platforms,
        candidateIdeology: profile.ideology === 'esquerda' ? 'esquerda' : 'direita',
        region: profile.state || 'brasil',
        city: profile.city || undefined,
      },
    });
    setAttachments([]);
  };

  const handleStop = useCallback(() => { arenaCancel(); setWasStopped(true); }, []);

  const handleNewAnalysis = useCallback(() => {
    arenaCancel(); reset(); setWasStopped(false); setAttachments([]);
    hasCalledAnalise.current = false; setAnaliseData(null);
    setAnaliseLoading(false); setAnaliseError(''); setShowFullAnalysis(false);
    setUserMediaContext(null);
  }, [reset, setAnaliseData]);

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
    <div className="flex flex-col h-[100dvh] bg-black">

      {/* ═══ HEADER BAR (exact match of mobile — title + avatar) ═══ */}
      <div className="flex items-center px-4 h-11 shrink-0" style={{ backgroundColor: '#000', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
        <span className="text-base font-extrabold text-white tracking-tight flex-1">VOTIA</span>
        <HeaderAvatar />
      </div>

      {/* ═══ IDLE — AnimatedLogo (exact match of mobile AnimatedLogo.tsx) ═══ */}
      {!hasConversation && screenState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
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

      {/* ═══ HAS ATTACHMENT — previews (match mobile) ═══ */}
      {!hasConversation && screenState === 'hasAttachment' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5">
          <h3 className="text-base font-bold text-white">Material selecionado</h3>
          <div className="flex gap-2.5 flex-wrap justify-center">
            {attachments.map((att) => (
              <div key={att.id} className="w-20 h-20 rounded-[14px] overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                {att.uri && att.type === 'image' ? (
                  <img src={att.uri} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-[11px]">{att.type === 'video' ? '🎬' : '🖼'}</div>
                )}
                <button onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 text-center">Digite sua pergunta e envie para selecionar plataformas</p>
        </div>
      )}

      {/* ═══ CHAT FLOW (match mobile exactly) ═══ */}
      {hasConversation && (
        <>
          {/* Fixed top bar */}
          <div className="flex justify-end px-4 py-2 shrink-0" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
            <button onClick={handleNewAnalysis} className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-all duration-200" style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.2)' }}>
              <RotateCcw size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Nova Análise</span>
            </button>
          </div>

          {/* Messages scroll */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ padding: 16, paddingBottom: 20 }}>
            <div className="space-y-3">

              {/* User media message */}
              {userMediaContext && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] ml-auto rounded-2xl rounded-br-sm p-3" style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.15)' }}>
                  {userMediaContext.attachments.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {userMediaContext.attachments.map((att) => (
                        <div key={att.id} className="w-12 h-12 rounded-[10px] overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          {att.uri && att.type === 'image' ? <img src={att.uri} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-zinc-500">🎬</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[13px] text-zinc-200">Analisar no {userMediaContext.text}</p>
                </motion.div>
              )}

              {/* Processing (collecting or streaming) */}
              {screenState === 'processing' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <ProcessingSteps phase={phase} processedCount={processedCount} totalCount={totalCount} collectingStatus={collectingStatus ?? undefined} onCancel={handleStop} />
                </motion.div>
              )}

              {/* Analysis loading (AnalysisProgressLoader — exact match of mobile) */}
              {isComplete && analiseLoading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] rounded-2xl rounded-bl-sm h-[250px]" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <AnalysisProgressLoader />
                </motion.div>
              )}

              {/* Analysis error */}
              {isComplete && analiseError && !analiseLoading && (
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[13px] text-rose-400">{analiseError}</p>
                  <button onClick={() => { hasCalledAnalise.current = false; setAnaliseError(''); }} className="mt-2 px-4 py-2.5 rounded-xl text-[13px] text-zinc-300" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
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

      {/* ═══ CHAT INPUT (always visible, above tab bar) ═══ */}
      <div className="shrink-0" style={{ marginBottom: 85 }}>
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

      {/* ═══ MODALS ═══ */}
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); setShowPlatformSelector(true); }} />
      <AttachmentMenu visible={showAttachMenu} onClose={() => setShowAttachMenu(false)} onRecordVideo={() => pickFile('video/*', 'video')} onPickImage={() => pickFile('image/*', 'image')} onPickVideo={() => pickFile('video/*', 'video')} onPickAudio={() => pickFile('audio/*', 'video')} />
      <PlatformSelector visible={showPlatformSelector} onClose={() => setShowPlatformSelector(false)} onConfirm={handlePlatformConfirm} />
    </div>
  );
}
