// Arena PWA — Intent Confirmation Sheet
// Appears after platform selection, before analysis begins
// Asks the user what they want to extract from the media

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, MessageCircle, TrendingUp, Users, ArrowRight,
  Instagram, Youtube, Tv, Radio, Megaphone, Newspaper, Twitter,
  Image, Video, Mic, FileText,
} from 'lucide-react';
import { PLATFORMS } from '../constants';

// Platform icon mapping (reuse from PlatformSelector)
const PLATFORM_ICONS: Record<string, React.ComponentType<any>> = {
  instagram: Instagram,
  youtube: Youtube,
  x: Twitter,
  tv: Tv,
  radio: Radio,
  outdoor: Megaphone,
  impresso: Newspaper,
};

const MEDIA_ICONS: Record<string, React.ComponentType<any>> = {
  image: Image,
  video: Video,
  audio: Mic,
  text: FileText,
};

// Quick suggestion chips
const SUGGESTIONS = [
  { text: 'As pessoas vão concordar com isso?', icon: Users },
  { text: 'Esse material vai engajar?', icon: TrendingUp },
  { text: 'Qual público vai rejeitar?', icon: Search },
  { text: 'Como melhorar esse conteúdo?', icon: Sparkles },
];

interface IntentConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (intentText: string) => void;
  initialText?: string;
  attachmentType?: 'image' | 'video' | 'audio' | 'text';
  platforms?: string[];
}

export function IntentConfirmSheet({
  visible,
  onClose,
  onConfirm,
  initialText = '',
  attachmentType = 'text',
  platforms = [],
}: IntentConfirmSheetProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialText = initialText.trim().length > 0;

  // Sync with initialText when sheet opens
  useEffect(() => {
    if (visible) {
      setText(initialText);
      // Auto-focus textarea after animation
      setTimeout(() => textareaRef.current?.focus(), 400);
    }
  }, [visible, initialText]);

  const handleConfirm = () => {
    if (text.trim().length === 0) return;
    onConfirm(text.trim());
  };

  const handleSuggestion = (suggestion: string) => {
    setText(suggestion);
    textareaRef.current?.focus();
  };

  const MediaIcon = MEDIA_ICONS[attachmentType] || FileText;
  const canSubmit = text.trim().length > 0;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Glass background */}
            <div className="bg-zinc-950/95 backdrop-blur-2xl border-t border-white/[0.08]">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
              </div>

              <div className="px-5 pb-5">
                {/* Step indicator */}
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-2 mb-4"
                >
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-1 rounded-full bg-emerald-500" />
                    <div className="w-6 h-1 rounded-full bg-emerald-500" />
                    <div className="w-6 h-1 rounded-full bg-emerald-500/30" />
                  </div>
                  <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">Etapa 3 de 3</span>
                </motion.div>

                {/* Platform badges */}
                {platforms.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="flex items-center gap-1.5 mb-4"
                  >
                    <MediaIcon size={13} className="text-zinc-500" />
                    <div className="flex gap-1.5">
                      {platforms.map((pid) => {
                        const platform = PLATFORMS.find((p) => p.id === pid);
                        if (!platform) return null;
                        const Icon = PLATFORM_ICONS[pid];
                        return (
                          <div
                            key={pid}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg"
                            style={{
                              backgroundColor: `${platform.color}10`,
                              border: `0.5px solid ${platform.color}25`,
                            }}
                          >
                            {Icon && <Icon size={11} style={{ color: platform.color }} />}
                            <span className="text-[10px] font-semibold" style={{ color: platform.color }}>
                              {platform.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Question */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <h3 className="text-[17px] font-bold text-white tracking-tight leading-snug">
                    {hasInitialText
                      ? 'É isso que você quer analisar?'
                      : 'O que você quer saber sobre essa mídia?'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 mb-4">
                    {hasInitialText
                      ? 'Confira ou edite antes de iniciar'
                      : 'Escreva sua pergunta para uma análise mais precisa'}
                  </p>
                </motion.div>

                {/* Textarea */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="relative mb-4"
                >
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ex: As pessoas vão concordar com essa mensagem?"
                    rows={3}
                    className="w-full px-4 py-3.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/40 rounded-2xl text-[14px] text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all duration-200 resize-none leading-relaxed"
                    style={{ fontSize: '16px' }} // Prevent iOS auto-zoom
                  />
                  {/* Character hint */}
                  <div className="absolute bottom-2.5 right-3">
                    <span className={`text-[9px] font-medium transition-colors ${text.length > 0 ? 'text-zinc-500' : 'text-zinc-700'}`}>
                      {text.length > 0 ? `${text.length} chars` : 'obrigatório'}
                    </span>
                  </div>
                </motion.div>

                {/* Quick suggestions (only when no text) */}
                {!hasInitialText && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: text.length > 0 ? 0.4 : 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="mb-5"
                  >
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[2px] mb-2.5">Sugestões rápidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SUGGESTIONS.map((s, i) => {
                        const SIcon = s.icon;
                        const isActive = text === s.text;
                        return (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 + i * 0.06 }}
                            onClick={() => handleSuggestion(s.text)}
                            className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all duration-200 active:scale-[0.97] ${
                              isActive
                                ? 'bg-emerald-500/[0.08] border-emerald-500/25'
                                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{
                                backgroundColor: isActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                              }}
                            >
                              <SIcon size={12} className={isActive ? 'text-emerald-400' : 'text-zinc-600'} />
                            </div>
                            <span className={`text-[11px] leading-snug font-medium ${isActive ? 'text-emerald-300' : 'text-zinc-400'}`}>
                              {s.text}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Confirm button */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={handleConfirm}
                  disabled={!canSubmit}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition-all duration-200 ${
                    canSubmit
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                      : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {canSubmit ? (
                    <>
                      <MessageCircle size={15} />
                      <span>{hasInitialText ? 'Confirmar e analisar' : 'Analisar'}</span>
                      <ArrowRight size={14} />
                    </>
                  ) : (
                    'Escreva sua pergunta para continuar'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
