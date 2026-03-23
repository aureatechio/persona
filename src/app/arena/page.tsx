// Arena PWA — Main Screen (Chat + Analysis)
// States: idle → hasAttachment → platformSelect → processing → complete → chatting

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Sparkles, Loader2 } from 'lucide-react';

import { useArenaStore, arenaSubmit, arenaCancel } from './store';
import { useAuthStore } from './authStore';
import type { Attachment, AnaliseData, ChatMessage } from './types';

import { ArenaNav } from './components/ArenaNav';
import { ChatInput } from './components/ChatInput';
import { AttachmentMenu } from './components/AttachmentMenu';
import { PlatformSelector } from './components/PlatformSelector';
import { ProcessingSteps } from './components/ProcessingSteps';
import { AnalysisSummary } from './components/AnalysisSummary';
import { AuthModal } from './components/AuthModal';

type ScreenState = 'idle' | 'hasAttachment' | 'platformSelect' | 'processing' | 'complete';

export default function ArenaPage() {
  // Store selectors
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

  // Local state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [analiseLoading, setAnaliseLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [userMediaContext, setUserMediaContext] = useState<{ text: string; attachments: Attachment[] } | null>(null);
  const hasCalledAnalise = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Init auth on mount
  useEffect(() => { initAuth(); }, [initAuth]);

  // Determine screen state
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

  // Auto-call /api/arena/analise when complete
  useEffect(() => {
    if (!isComplete || !simulation || hasCalledAnalise.current || analiseData) return;
    hasCalledAnalise.current = true;
    setAnaliseLoading(true);

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
        .then((json) => {
          if (json.error) throw new Error(json.error);
          setAnaliseData(json);
          setAnaliseLoading(false);
        })
        .catch((err) => {
          clearTimeout(timeout);
          if (attempt < 2) setTimeout(() => tryFetch(attempt + 1), 2000);
          else setAnaliseLoading(false);
        });
    };
    tryFetch(1);
  }, [isComplete, simulation]);

  // Handlers
  const handleAttachPress = () => setShowAttachMenu(true);

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setShowPlatformSelector(true);
  };

  const pickFile = (accept: string, type: 'image' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const att: Attachment = {
        id: Date.now().toString(),
        type,
        name: file.name,
        mimeType: file.type,
        file,
      };
      // For images, also create a preview URI
      if (type === 'image') att.uri = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, att]);
    };
    input.click();
  };

  const handleSendMessage = (text: string) => {
    if (!isAuthenticated) { setShowAuthModal(true); return; }
    if (screenState === 'hasAttachment') { setShowPlatformSelector(true); return; }
    if (screenState === 'complete' && analiseData) { handleChatQuestion(text); return; }
    if (screenState === 'idle' && text) {
      // No attachment — prompt
      alert('Para iniciar a análise, anexe uma imagem ou vídeo usando o botão de anexo.');
    }
  };

  const handlePlatformConfirm = (platforms: string[]) => {
    setShowPlatformSelector(false);
    if (!profile) return;
    setWasStopped(false);
    hasCalledAnalise.current = false;
    setAnaliseData(null);

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
    arenaCancel();
    reset();
    setWasStopped(false);
    setAttachments([]);
    hasCalledAnalise.current = false;
    setAnaliseData(null);
    setAnaliseLoading(false);
    setUserMediaContext(null);
  }, [reset, setAnaliseData]);

  // Chat
  const handleChatQuestion = async (text: string) => {
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
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: json.answer || json.error || 'Sem resposta',
        timestamp: Date.now(),
      });
    } catch {
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Erro ao processar sua pergunta. Tente novamente.',
        timestamp: Date.now(),
      });
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 200);
    }
  };

  const hasConversation = !!(userMediaContext || isStreaming || isComplete);

  // ── Audio recording via MediaRecorder ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleMicPress = async () => {
    if (isRecording) {
      // Stop
      setIsRecording(false);
      mediaRecorderRef.current?.stop();
      return;
    }

    // Start
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
          if (data.text) {
            // Send directly as chat message or handle
            handleSendMessage(data.text);
          }
        } catch { /* ignore */ }
        finally { setIsTranscribing(false); }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black">
      {/* ═══ IDLE — AnimatedLogo equivalent ═══ */}
      {!hasConversation && screenState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <motion.div
            className="relative w-32 h-32"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute inset-0 rounded-full border-[1.5px] border-emerald-400/20" />
            <div className="absolute inset-3 rounded-full border border-emerald-400/10 border-dashed" />
            <div className="absolute inset-6 rounded-full border-[0.5px] border-emerald-400/15" />
          </motion.div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Arena</h1>
          <p className="text-sm text-zinc-500">Análise eleitoral com IA</p>
        </div>
      )}

      {/* ═══ HAS ATTACHMENT — previews ═══ */}
      {!hasConversation && screenState === 'hasAttachment' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5">
          <h3 className="text-base font-bold text-white">Material selecionado</h3>
          <div className="flex gap-2.5 flex-wrap justify-center">
            {attachments.map((att) => (
              <div key={att.id} className="w-20 h-20 rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] relative">
                {att.uri && att.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.uri} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex-1 flex items-center justify-center h-full text-zinc-500 text-xs">
                    {att.type === 'video' ? '🎬' : '🖼'}
                  </div>
                )}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600">Toque enviar para selecionar plataformas</p>
        </div>
      )}

      {/* ═══ CHAT FLOW ═══ */}
      {hasConversation && (
        <>
          {/* Top bar */}
          <div className="flex justify-end px-4 py-2 border-b border-white/[0.04] shrink-0">
            <button
              onClick={handleNewAnalysis}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 active:scale-95 transition-all duration-200"
            >
              <RotateCcw size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Nova Análise</span>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
            {/* User media message */}
            {userMediaContext && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[88%] self-end ml-auto rounded-2xl rounded-br-sm p-3 bg-emerald-500/[0.08] border border-emerald-500/15"
              >
                {userMediaContext.attachments.length > 0 && (
                  <div className="flex gap-1.5 mb-2">
                    {userMediaContext.attachments.map((att) => (
                      <div key={att.id} className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center">
                        {att.uri && att.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={att.uri} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-zinc-500">🎬</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[13px] text-zinc-200">Analisar no {userMediaContext.text}</p>
              </motion.div>
            )}

            {/* Processing */}
            {screenState === 'processing' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-3 bg-white/[0.03] border border-white/[0.06]"
              >
                <ProcessingSteps
                  phase={phase}
                  processedCount={processedCount}
                  totalCount={totalCount}
                  collectingStatus={collectingStatus ?? undefined}
                  onCancel={handleStop}
                />
              </motion.div>
            )}

            {/* Analysis loading */}
            {isComplete && analiseLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-6 bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="text-emerald-400 animate-spin" />
                  <p className="text-xs text-zinc-500">Gerando análise detalhada...</p>
                </div>
              </motion.div>
            )}

            {/* Analysis summary */}
            {analiseData && <AnalysisSummary analiseData={analiseData} />}

            {/* Chat messages */}
            {chatMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[88%] rounded-2xl p-3 ${
                  msg.role === 'user'
                    ? 'self-end ml-auto bg-emerald-500/[0.08] border border-emerald-500/15 rounded-br-sm'
                    : 'self-start bg-white/[0.03] border border-white/[0.06] rounded-bl-sm'
                }`}
              >
                <p className="text-[13px] text-zinc-200 leading-relaxed">{msg.content}</p>
              </motion.div>
            ))}

            {chatLoading && (
              <div className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-3 bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[13px] text-zinc-600">Pensando...</p>
              </div>
            )}

            <div className="h-5" />
          </div>
        </>
      )}

      {/* ═══ CHAT INPUT ═══ */}
      <div className="shrink-0" style={{ paddingBottom: '56px' }}>
        <ChatInput
          onAttachPress={handleAttachPress}
          onSendMessage={handleSendMessage}
          onMicPress={handleMicPress}
          disabled={screenState === 'processing'}
          placeholder={
            isComplete ? 'Pergunte sobre a análise...' :
            screenState === 'hasAttachment' ? 'Contexto (opcional) — toque enviar' :
            'O que você quer analisar?'
          }
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
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      <AttachmentMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onPickImage={() => pickFile('image/*', 'image')}
        onPickVideo={() => pickFile('video/*', 'video')}
        onPickAudio={() => pickFile('audio/*', 'video')}
      />
      <PlatformSelector
        visible={showPlatformSelector}
        onClose={() => setShowPlatformSelector(false)}
        onConfirm={handlePlatformConfirm}
      />
    </div>
  );
}
