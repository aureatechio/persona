// Arena PWA — AttachmentMenu
// Uses native <label> + <input type="file"> for maximum iOS compatibility
// (no input.click() — avoids iOS PWA gesture chain issues with iCloud photos)

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ImageIcon, Film, Music, X } from 'lucide-react';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onFileSelected: (file: File, type: 'image' | 'video') => void;
  onRecordVideo: () => void;
}

const FILE_OPTIONS = [
  { id: 'pick-image', label: 'Carregar imagem', icon: ImageIcon, color: '#34d399', accept: 'image/*', type: 'image' as const },
  { id: 'pick-video', label: 'Carregar vídeo', icon: Film, color: '#38bdf8', accept: 'video/*', type: 'video' as const },
  { id: 'pick-audio', label: 'Carregar áudio', icon: Music, color: '#f59e0b', accept: 'audio/*', type: 'video' as const },
] as const;

export function AttachmentMenu({ visible, onClose, onFileSelected, onRecordVideo }: AttachmentMenuProps) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Pass file to parent BEFORE any cleanup (iOS can invalidate File on input reset/unmount)
    onFileSelected(file, type);
    // Delay close so the DOM input stays alive while FileReader starts
    setTimeout(() => {
      e.target.value = '';
      onClose();
    }, 100);
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
              {/* Record video — uses camera capture, needs programmatic trigger */}
              <div>
                <button
                  onClick={() => { onRecordVideo(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 h-[52px] hover:bg-white/[0.06] active:bg-white/[0.06] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8b5cf615' }}>
                    <Camera size={20} style={{ color: '#8b5cf6' }} />
                  </div>
                  <span className="text-sm font-semibold text-zinc-200">Gravar vídeo</span>
                </button>
                <div className="h-[0.5px] ml-16" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
              </div>

              {/* File options — each is a native <label> wrapping an <input type="file"> */}
              {FILE_OPTIONS.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <div key={opt.id}>
                    <label className="w-full flex items-center gap-3 px-4 h-[52px] hover:bg-white/[0.06] active:bg-white/[0.06] transition-colors cursor-pointer">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${opt.color}15` }}>
                        <Icon size={20} style={{ color: opt.color }} />
                      </div>
                      <span className="text-sm font-semibold text-zinc-200">{opt.label}</span>
                      <input
                        type="file"
                        accept={opt.accept}
                        onChange={(e) => handleFile(e, opt.type)}
                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                      />
                    </label>
                    {i < FILE_OPTIONS.length - 1 && (
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
