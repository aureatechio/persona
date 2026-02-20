'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Image as ImageIcon,
  Play,
  Link as LinkIcon,
  X,
  Paperclip,
} from 'lucide-react';
import { ActionChips, type Mode } from './ActionChips';
import { cn } from '@/lib/utils';
import {
  type Attachment,
  isImageFile,
  isVideoFile,
  canAddAttachment,
  createImagePreview,
} from '@/lib/file-utils';

interface BottomInputProps {
  activeMode: Mode | null;
  onSelectMode: (mode: Mode) => void;
  onSubmit: (value: string) => void;
  isProcessing: boolean;
  placeholder?: string;
  customInput?: React.ReactNode;
  hasBlocks: boolean;
}

const PLACEHOLDERS: Record<string, string[]> = {
  default: [
    'Pergunte alguma coisa...',
    'O que 2.000 personas pensam sobre...',
    'Digite uma pergunta ou selecione uma acao',
  ],
  arena: [
    'O que 2.000 personas pensam sobre...',
    'A maconha deveria ser legalizada?',
    'O Brasil deveria investir mais em energia nuclear?',
    'Deveria existir pena de morte no Brasil?',
  ],
  chat: ['Envie uma mensagem...'],
  eleitoral: ['Selecione os candidatos abaixo...'],
};

export function BottomInput({
  activeMode,
  onSelectMode,
  onSubmit,
  isProcessing,
  placeholder: customPlaceholder,
  customInput,
  hasBlocks,
}: BottomInputProps) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isArena = activeMode === 'arena';
  const placeholderList = PLACEHOLDERS[activeMode || 'default'] || PLACEHOLDERS.default;

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(p => (p + 1) % placeholderList.length), 4000);
    return () => clearInterval(t);
  }, [placeholderList.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, [value]);

  // Clear attachments when leaving arena mode
  useEffect(() => {
    if (!isArena) {
      setAttachments([]);
      setShowUrlInput(false);
      setUrlValue('');
    }
  }, [isArena]);

  const addFilesAsAttachments = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!canAddAttachment(attachments)) break;

      let type: Attachment['type'] = 'image';
      let preview: string | undefined;

      if (isImageFile(file)) {
        type = 'image';
        try { preview = await createImagePreview(file); } catch { /* skip */ }
      } else if (isVideoFile(file)) {
        type = 'video';
      } else {
        continue;
      }

      setAttachments(prev => [
        ...prev,
        { id: crypto.randomUUID(), type, file, preview, name: file.name },
      ]);
    }
  }, [attachments]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const addUrl = useCallback(() => {
    const url = urlValue.trim();
    if (!url || !canAddAttachment(attachments)) return;
    setAttachments(prev => [
      ...prev,
      { id: crypto.randomUUID(), type: 'url', url, name: url.length > 35 ? url.slice(0, 35) + '...' : url },
    ]);
    setUrlValue('');
    setShowUrlInput(false);
  }, [urlValue, attachments]);

  // Drag and drop handlers (arena only)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isArena && e.dataTransfer.files.length > 0) {
      addFilesAsAttachments(e.dataTransfer.files);
    }
  }, [isArena, addFilesAsAttachments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isArena) setIsDragging(true);
  }, [isArena]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isProcessing) return;

    // Arena with attachments: can send even without text (AI will contextualize)
    if (isArena && attachments.length > 0) {
      window.dispatchEvent(new CustomEvent('arena-rich-submit', {
        detail: { question: value.trim(), contextText: '', attachments },
      }));
      setValue('');
      setAttachments([]);
      return;
    }

    // Regular submit requires text
    if (!value.trim() && !customInput) return;
    onSubmit(value.trim());
    setValue('');
  };

  // Can send: has text OR (arena mode with attachments)
  const canSend = !isProcessing && (!!value.trim() || !!customInput || (isArena && attachments.length > 0));

  return (
    <div className="sticky bottom-0 z-40 bg-gradient-to-t from-black via-black/95 to-transparent pt-6 pb-4 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="relative group">
          {/* Glow effect */}
          <div className={cn(
            'absolute -inset-1 rounded-[1.75rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500',
            isArena
              ? 'bg-gradient-to-r from-emerald-600/15 via-violet-600/15 to-emerald-600/15'
              : 'bg-gradient-to-r from-violet-600/15 via-fuchsia-600/15 to-violet-600/15',
          )} />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'relative bg-zinc-900/90 border rounded-[1.5rem] overflow-hidden transition-all duration-300 backdrop-blur-2xl',
              isDragging
                ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                : 'border-white/[0.08] group-focus-within:border-violet-500/30',
            )}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/[0.06] backdrop-blur-sm z-10 rounded-[1.5rem]">
                <p className="text-sm font-semibold text-emerald-400">Solte arquivos aqui</p>
              </div>
            )}

            {/* Attachment previews (arena only) */}
            {isArena && attachments.length > 0 && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-400"
                  >
                    {att.type === 'image' && att.preview ? (
                      <img src={att.preview} alt="" className="w-6 h-6 rounded-lg object-cover" />
                    ) : att.type === 'video' ? (
                      <Play size={12} className="text-violet-400" />
                    ) : (
                      <LinkIcon size={12} className="text-sky-400" />
                    )}
                    <span className="max-w-[80px] truncate">{att.name}</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-0.5 rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* URL input inline (arena only) */}
            {isArena && showUrlInput && (
              <div className="flex items-center gap-2 px-4 pt-2">
                <input
                  type="url"
                  value={urlValue}
                  onChange={e => setUrlValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/40 transition-all duration-200"
                  autoFocus
                />
                <button
                  onClick={addUrl}
                  disabled={!urlValue.trim()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
                  className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Textarea */}
            {customInput || (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={customPlaceholder || placeholderList[placeholderIdx]}
                rows={1}
                disabled={isProcessing}
                className="w-full bg-transparent px-5 pt-4 pb-2 text-white placeholder-zinc-600 focus:outline-none resize-none text-base"
              />
            )}

            {/* Bottom row: chips + upload buttons + send */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ActionChips activeMode={activeMode} onSelect={onSelectMode} compact />

                {/* Arena upload buttons - appear when arena is active */}
                {isArena && (
                  <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-white/[0.08]">
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={!canAddAttachment(attachments)}
                      title="Anexar imagem"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ImageIcon size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'video/*';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={!canAddAttachment(attachments)}
                      title="Anexar video"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Play size={15} />
                    </button>
                    <button
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      title="Adicionar link"
                      className={cn(
                        'p-1.5 rounded-lg transition-all duration-200',
                        showUrlInput
                          ? 'text-sky-400 bg-sky-500/10'
                          : 'text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10',
                      )}
                    >
                      <LinkIcon size={15} />
                    </button>
                    {attachments.length > 0 && (
                      <span className="text-[9px] text-zinc-600 font-bold tabular-nums ml-0.5">
                        {attachments.length}/5
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-[0.93] shrink-0',
                  canSend
                    ? isArena && attachments.length > 0
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/25'
                      : 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-white/[0.06] text-zinc-600 cursor-not-allowed',
                )}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        {isArena && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                addFilesAsAttachments(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
