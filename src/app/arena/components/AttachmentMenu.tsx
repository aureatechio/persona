// Arena PWA — AttachmentMenu (exact match of mobile AttachmentMenu.tsx)
// 4 options: Gravar vídeo, Carregar imagem, Carregar vídeo, Carregar áudio

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ImageIcon, Film, Music, X } from 'lucide-react';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onRecordVideo: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickAudio: () => void;
}

const OPTIONS = [
  { id: 'record-video', label: 'Gravar vídeo', icon: Camera, color: '#8b5cf6' },
  { id: 'pick-image', label: 'Carregar imagem', icon: ImageIcon, color: '#34d399' },
  { id: 'pick-video', label: 'Carregar vídeo', icon: Film, color: '#38bdf8' },
  { id: 'pick-audio', label: 'Carregar áudio', icon: Music, color: '#f59e0b' },
] as const;

export function AttachmentMenu({ visible, onClose, onRecordVideo, onPickImage, onPickVideo, onPickAudio }: AttachmentMenuProps) {
  const handlers: Record<string, () => void> = {
    'record-video': onRecordVideo,
    'pick-image': onPickImage,
    'pick-video': onPickVideo,
    'pick-audio': onPickAudio,
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[100px] left-4 right-4 z-50"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Options card */}
            <div className="rounded-[20px] overflow-hidden" style={{ backgroundColor: 'rgba(24,24,27,0.95)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              {OPTIONS.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <div key={opt.id}>
                    <button
                      onClick={() => {
                        onClose();
                        setTimeout(() => handlers[opt.id]?.(), 400);
                      }}
                      className="w-full flex items-center gap-3 px-4 h-[52px] hover:bg-white/[0.06] active:bg-white/[0.06] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${opt.color}15` }}>
                        <Icon size={20} style={{ color: opt.color }} />
                      </div>
                      <span className="text-sm font-semibold text-zinc-200">{opt.label}</span>
                    </button>
                    {i < OPTIONS.length - 1 && (
                      <div className="h-[0.5px] ml-16" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cancel */}
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 h-12 mt-2 rounded-2xl"
              style={{ backgroundColor: 'rgba(24,24,27,0.95)', border: '0.5px solid rgba(255,255,255,0.06)' }}
            >
              <X size={16} className="text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-400">Cancelar</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
