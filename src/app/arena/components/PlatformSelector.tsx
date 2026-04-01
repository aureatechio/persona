// Arena PWA — Platform selector with platform icons

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, Youtube, Tv, Radio, Megaphone, Newspaper, Twitter } from 'lucide-react';
import { PLATFORMS } from '../constants';

// Platform icons mapping
const PLATFORM_ICONS: Record<string, React.ComponentType<any>> = {
  instagram: Instagram,
  youtube: Youtube,
  x: Twitter,
  tv: Tv,
  radio: Radio,
  outdoor: Megaphone,
  impresso: Newspaper,
};

// TikTok custom SVG icon (not in lucide)
function TikTokIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.49a8.21 8.21 0 0 0 4.76 1.5V6.56a4.83 4.83 0 0 1-1-.13v.26z" fill={color}/>
    </svg>
  );
}

// Plataformas compativeis por tipo de arquivo
const PLATFORM_COMPATIBILITY: Record<string, string[]> = {
  image: ['instagram', 'outdoor', 'impresso'],
  video: ['instagram', 'youtube', 'tiktok', 'tv'],
  audio: ['radio'],
  text: ['x', 'impresso'],
};

interface PlatformSelectorProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (platforms: string[]) => void;
  attachmentType?: 'image' | 'video' | 'audio' | 'text';
}

export function PlatformSelector({ visible, onClose, onConfirm, attachmentType = 'text' }: PlatformSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const allowedIds = PLATFORM_COMPATIBILITY[attachmentType] || PLATFORM_COMPATIBILITY.text;

  // Reset selection when attachment type changes
  useEffect(() => {
    setSelected([]);
  }, [attachmentType]);

  const toggle = (id: string) => {
    if (!allowedIds.includes(id)) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirm(selected);
    setSelected([]);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

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

            <div className="px-5 pb-4">
              <h3 className="text-lg font-bold text-white tracking-tight mb-1">Onde será publicado?</h3>
              <p className="text-xs text-zinc-500 mb-5">
                {attachmentType === 'text'
                  ? 'Selecione as plataformas para análise específica'
                  : `Plataformas compatíveis com ${attachmentType === 'image' ? 'imagem' : attachmentType === 'video' ? 'vídeo' : 'áudio'}`}
              </p>

              {/* Platform grid with icons */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {PLATFORMS.map((p) => {
                  const isSelected = selected.includes(p.id);
                  const isDisabled = !allowedIds.includes(p.id);
                  const Icon = PLATFORM_ICONS[p.id];

                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      disabled={isDisabled}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200 ${
                        isDisabled
                          ? 'opacity-20 cursor-not-allowed border-white/[0.03] bg-white/[0.01]'
                          : isSelected
                            ? 'bg-white/[0.06] border-white/[0.15] active:scale-95'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] active:scale-95'
                      }`}
                      style={isSelected && !isDisabled ? { boxShadow: `0 0 20px -5px ${p.color}40` } : undefined}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: isSelected ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        {p.id === 'tiktok' ? (
                          <TikTokIcon size={22} color={isSelected ? p.color : '#71717a'} />
                        ) : Icon ? (
                          <Icon size={22} style={{ color: isSelected ? p.color : '#71717a' }} />
                        ) : (
                          <span className="text-sm font-bold" style={{ color: isSelected ? p.color : '#71717a' }}>{p.label[0]}</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={selected.length === 0}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition-all duration-200 ${
                  selected.length > 0
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                    : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                }`}
              >
                {selected.length > 0 ? `Continuar (${selected.length}) →` : 'Selecione ao menos uma'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
