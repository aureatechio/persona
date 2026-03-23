// Arena PWA — ChatInput (fixed bottom input bar)
// Uses visualViewport API for proper iOS keyboard handling

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, Mic, Square, Send } from 'lucide-react';

interface ChatInputProps {
  onAttachPress?: () => void;
  onSendMessage?: (text: string) => void;
  onMicPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  showAttach?: boolean;
  showMic?: boolean;
  forceSendVisible?: boolean;
  isRecording?: boolean;
  isTranscribing?: boolean;
}

export function ChatInput({
  onAttachPress,
  onSendMessage,
  onMicPress,
  placeholder = 'O que você quer analisar?',
  disabled = false,
  showAttach = true,
  showMic = true,
  forceSendVisible = false,
  isRecording = false,
  isTranscribing = false,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(() => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed && !forceSendVisible) return;
    onSendMessage?.(trimmed);
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [disabled, text, forceSendVisible, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
    }
  }, [text]);

  // iOS keyboard: adjust position using visualViewport
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !window.visualViewport) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const onResize = () => {
      const vv = window.visualViewport!;
      // When keyboard is open, visualViewport.height < window.innerHeight
      const keyboardHeight = window.innerHeight - vv.height;
      if (keyboardHeight > 100) {
        // Keyboard is open — move the fixed container up
        parent.style.bottom = `${keyboardHeight}px`;
      } else {
        // Keyboard closed — reset to above nav bar
        parent.style.bottom = '100px';
      }
    };

    window.visualViewport.addEventListener('resize', onResize);
    window.visualViewport.addEventListener('scroll', onResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, []);

  const hasText = text.trim().length > 0 || forceSendVisible;

  return (
    <div ref={wrapperRef} className="px-3 pt-2 pb-2 bg-black border-t border-white/[0.04]">
      <div className={`flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-[20px] px-1.5 py-1.5 min-h-[52px] max-h-[140px] ${
        disabled ? 'opacity-50' : ''
      }`}>
        {/* Attach button */}
        {showAttach && (
          <button
            onClick={onAttachPress}
            disabled={disabled}
            className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 hover:bg-emerald-500/15"
          >
            <Paperclip size={18} className="text-emerald-400" />
          </button>
        )}

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isTranscribing ? 'Transcrevendo áudio...' :
            isRecording ? 'Gravando...' :
            placeholder
          }
          disabled={disabled || isTranscribing}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          className={`flex-1 bg-transparent text-white placeholder:text-zinc-600 outline-none resize-none py-2 px-1 leading-5 min-h-[36px] ${
            isRecording ? 'placeholder:text-rose-400' : ''
          }`}
          style={{ fontSize: '16px' }}
        />

        {/* Right button: Send or Mic */}
        {hasText && !isRecording ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="w-9 h-9 rounded-full bg-emerald-400 flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20"
          >
            <Send size={18} className="text-black" />
          </button>
        ) : showMic ? (
          <button
            onClick={onMicPress}
            disabled={disabled}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 ${
              isRecording
                ? 'bg-rose-500/15 border border-rose-500/30'
                : 'bg-white/[0.06] hover:bg-white/[0.1]'
            }`}
          >
            {isRecording ? (
              <Square size={14} className="text-rose-400" fill="currentColor" />
            ) : (
              <Mic size={20} className="text-zinc-400" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
