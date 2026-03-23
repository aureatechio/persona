// Arena PWA — Platform selector (bottom sheet)

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PLATFORMS } from '../constants';

interface PlatformSelectorProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (platforms: string[]) => void;
}

export function PlatformSelector({ visible, onClose, onConfirm }: PlatformSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
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
              <p className="text-xs text-zinc-500 mb-5">Selecione as plataformas para análise específica</p>

              {/* Platform grid */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {PLATFORMS.map((p) => {
                  const isSelected = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200 active:scale-95 ${
                        isSelected
                          ? 'bg-white/[0.06] border-white/[0.15]'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                      style={isSelected ? { boxShadow: `0 0 20px -5px ${p.color}40` } : undefined}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: isSelected ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                          color: isSelected ? p.color : '#71717a',
                        }}
                      >
                        {p.label[0]}
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
