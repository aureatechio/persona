// Arena PWA — Platform selector with media-aware filtering
// Platforms incompatible with the uploaded media type are visually separated

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, Youtube, Tv, Radio, Megaphone, Newspaper, Twitter, Image, Video, Mic, FileText, Lock, Check } from 'lucide-react';
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
  image: ['instagram', 'x', 'outdoor', 'impresso'],
  video: ['instagram', 'youtube', 'tiktok', 'x', 'tv'],
  audio: ['radio'],
  text: ['x', 'impresso'],
};

const MEDIA_LABELS: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  image: { label: 'Imagem', icon: Image, color: '#e879f9' },
  video: { label: 'Vídeo', icon: Video, color: '#f87171' },
  audio: { label: 'Áudio', icon: Mic, color: '#fbbf24' },
  text: { label: 'Texto', icon: FileText, color: '#a3a3a3' },
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
  const media = MEDIA_LABELS[attachmentType] || MEDIA_LABELS.text;
  const MediaIcon = media.icon;

  // Split platforms into available and unavailable
  const availablePlatforms = PLATFORMS.filter((p) => allowedIds.includes(p.id));
  const unavailablePlatforms = PLATFORMS.filter((p) => !allowedIds.includes(p.id));

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-3xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
            </div>

            <div className="px-5 pb-4">
              {/* Header with media type badge */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Onde será publicado?</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Canais compatíveis com seu conteúdo</p>
                </div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 500 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: `${media.color}10`,
                    borderColor: `${media.color}30`,
                  }}
                >
                  <MediaIcon size={13} style={{ color: media.color }} />
                  <span className="text-[11px] font-bold" style={{ color: media.color }}>
                    {media.label}
                  </span>
                </motion.div>
              </div>

              {/* Available platforms */}
              <div className={`grid gap-2.5 mb-3 ${availablePlatforms.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {availablePlatforms.map((p, i) => {
                  const isSelected = selected.includes(p.id);
                  const Icon = PLATFORM_ICONS[p.id];

                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      onClick={() => toggle(p.id)}
                      className={`relative flex flex-col items-center gap-2 py-3.5 rounded-2xl border transition-all duration-200 active:scale-[0.96] ${
                        isSelected
                          ? 'border-white/[0.2] bg-white/[0.07]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                      style={isSelected ? {
                        boxShadow: `0 0 24px -6px ${p.color}35, inset 0 1px 0 ${p.color}15`,
                        borderColor: `${p.color}40`,
                      } : undefined}
                    >
                      {/* Selected checkmark */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: p.color }}
                        >
                          <Check size={11} className="text-black" strokeWidth={3} />
                        </motion.div>
                      )}

                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                          border: isSelected ? `1px solid ${p.color}30` : '1px solid rgba(255,255,255,0.04)',
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
                      <span className={`text-[11px] font-semibold transition-colors duration-200 ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                        {p.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Unavailable platforms */}
              {unavailablePlatforms.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Divider */}
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
                    <div className="flex items-center gap-1.5">
                      <Lock size={10} className="text-zinc-600" />
                      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                        Não compatível com {media.label.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {unavailablePlatforms.map((p) => {
                      const Icon = PLATFORM_ICONS[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div className="w-5 h-5 rounded flex items-center justify-center opacity-30">
                            {p.id === 'tiktok' ? (
                              <TikTokIcon size={13} color="#52525b" />
                            ) : Icon ? (
                              <Icon size={13} className="text-zinc-700" />
                            ) : null}
                          </div>
                          <span className="text-[10px] font-medium text-zinc-700 line-through decoration-zinc-700/50">
                            {p.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Confirm */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                onClick={handleConfirm}
                disabled={selected.length === 0}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm mt-5 active:scale-[0.98] transition-all duration-200 ${
                  selected.length > 0
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                    : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                }`}
              >
                {selected.length > 0
                  ? `Analisar em ${selected.length} ${selected.length === 1 ? 'canal' : 'canais'} →`
                  : 'Selecione ao menos um canal'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
