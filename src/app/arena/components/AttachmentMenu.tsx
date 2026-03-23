// Arena PWA — Attachment menu (slide-up modal)

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, Film, Music, X } from 'lucide-react';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickAudio: () => void;
}

const OPTIONS = [
  { key: 'image', icon: Image, label: 'Escolher imagem', color: '#8b5cf6' },
  { key: 'video', icon: Film, label: 'Escolher vídeo', color: '#38bdf8' },
  { key: 'audio', icon: Music, label: 'Escolher áudio', color: '#fbbf24' },
] as const;

export function AttachmentMenu({ visible, onClose, onPickImage, onPickVideo, onPickAudio }: AttachmentMenuProps) {
  const handlers: Record<string, () => void> = {
    image: onPickImage,
    video: onPickVideo,
    audio: onPickAudio,
  };

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
            </div>

            <div className="px-5 pb-4 space-y-2">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      handlers[opt.key]();
                      onClose();
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${opt.color}15` }}
                    >
                      <Icon size={20} style={{ color: opt.color }} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-300">{opt.label}</span>
                  </button>
                );
              })}

              {/* Cancel */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 mt-2"
              >
                <X size={16} className="text-zinc-500" />
                <span className="text-sm font-medium text-zinc-500">Cancelar</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
