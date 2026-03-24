// Arena PWA — Toast notification (above input, auto-dismiss + close)

'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  variant?: 'info' | 'success';
  duration?: number;
}

export function Toast({ message, visible, onClose, variant = 'info', duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, onClose, duration]);

  const isSuccess = variant === 'success';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="fixed left-4 right-4 z-[55]"
          style={{ bottom: 170 }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl"
            style={{
              backgroundColor: 'rgba(24,24,27,0.95)',
              border: `0.5px solid ${isSuccess ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: isSuccess ? 'rgba(52,211,153,0.15)' : 'rgba(56,189,248,0.15)' }}
            >
              {isSuccess ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Info size={14} className="text-sky-400" />
              )}
            </div>
            <p className="flex-1 text-[13px] font-medium text-zinc-200 leading-tight">{message}</p>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <X size={12} className="text-zinc-500" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
