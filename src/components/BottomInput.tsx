'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Image as ImageIcon,
  Video,
  X,
  Paperclip,
  Camera,
  Globe,
} from 'lucide-react';
import { VideoRecorder } from './VideoRecorder';
import { cn } from '@/lib/utils';
import {
  type Attachment,
  isImageFile,
  isVideoFile,
  canAddAttachment,
  createImagePreview,
  createVideoThumbnail,
} from '@/lib/file-utils';

/** Detect if a string is (or contains) a URL */
const URL_REGEX = /https?:\/\/[^\s]+/gi;

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

interface BottomInputProps {
  onSubmit: (value: string) => void;
  isProcessing: boolean;
  placeholder?: string;
  customInput?: React.ReactNode;
  hasBlocks: boolean;
  personaCount?: number;
}

function buildPlaceholders(count: number): string[] {
  const formatted = count > 0 ? count.toLocaleString('pt-BR') : '20.000';
  return [
    `O que ${formatted} personas pensam sobre...`,
    'A maconha deveria ser legalizada?',
    'Cole um link do YouTube para analisar...',
    'O Brasil deveria investir mais em energia nuclear?',
    'Deveria existir pena de morte no Brasil?',
  ];
}

export function BottomInput({
  onSubmit,
  isProcessing,
  placeholder: customPlaceholder,
  customInput,
  hasBlocks,
  personaCount = 0,
}: BottomInputProps) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const PLACEHOLDERS = useMemo(() => buildPlaceholders(personaCount), [personaCount]);
  const [showRecorder, setShowRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(p => (p + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, [PLACEHOLDERS.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, [value]);

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
        try { preview = await createVideoThumbnail(file); } catch { /* skip */ }
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

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFilesAsAttachments(e.dataTransfer.files);
    }
  }, [addFilesAsAttachments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Auto-detect URLs typed/pasted into the textarea
  const handleTextChange = useCallback((newValue: string) => {
    const urls = extractUrls(newValue);
    if (urls.length > 0) {
      let remaining = newValue;
      for (const url of urls) {
        if (canAddAttachment(attachments)) {
          // Check duplicate
          if (!attachments.some(a => a.type === 'url' && a.url === url)) {
            let displayName = url;
            try {
              const parsed = new URL(url);
              displayName = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
              if (displayName.length > 40) displayName = displayName.slice(0, 40) + '...';
            } catch { /* keep raw */ }

            setAttachments(prev => [
              ...prev,
              { id: crypto.randomUUID(), type: 'url', url, name: displayName },
            ]);
          }
          // Remove URL from text
          remaining = remaining.replace(url, '');
        }
      }
      // Clean up leftover whitespace
      setValue(remaining.replace(/\s{2,}/g, ' ').trim());
    } else {
      setValue(newValue);
    }
  }, [attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isProcessing) return;

    // With attachments: can send even without text (AI will contextualize)
    if (attachments.length > 0) {
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

  // Can send: has text OR has attachments
  const canSend = !isProcessing && (!!value.trim() || !!customInput || attachments.length > 0);

  return (
    <div className="sticky bottom-0 z-40 bg-gradient-to-t from-black via-black/95 to-transparent pt-6 pb-4 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="relative group">
          {/* Glow effect */}
          <div className={cn(
            'absolute -inset-1 rounded-[1.75rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500',
            'bg-gradient-to-r from-emerald-600/15 via-violet-600/15 to-emerald-600/15',
          )} />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'relative bg-zinc-900/90 border rounded-[1.5rem] transition-all duration-300 backdrop-blur-2xl',
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

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-400"
                  >
                    {att.type === 'image' && att.preview ? (
                      <img src={att.preview} alt="" className="w-6 h-6 rounded-lg object-cover" />
                    ) : att.type === 'video' ? (
                      <Video size={12} className="text-violet-400" />
                    ) : (
                      <Globe size={12} className="text-sky-400" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="max-w-[100px] truncate leading-tight">{att.name}</span>
                      {att.type === 'video' && (
                        <span className="text-[9px] text-violet-400/70 leading-tight">Audio sera transcrito</span>
                      )}
                      {att.type === 'image' && (
                        <span className="text-[9px] text-emerald-400/70 leading-tight">Contexto sera extraido</span>
                      )}
                      {att.type === 'url' && (
                        <span className="text-[9px] text-sky-400/70 leading-tight">Conteudo sera analisado</span>
                      )}
                    </div>
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

            {/* Textarea */}
            {customInput || (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={e => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={customPlaceholder || PLACEHOLDERS[placeholderIdx]}
                rows={1}
                disabled={isProcessing}
                className="w-full bg-transparent px-5 pt-4 pb-2 text-white placeholder-zinc-600 focus:outline-none resize-none text-base"
              />
            )}

            {/* Bottom row: attach buttons + send */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
              <div className="flex items-center gap-1.5">
                {/* Attachment button + dropdown menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    disabled={!canAddAttachment(attachments)}
                    title="Anexar midia"
                    className={cn(
                      'p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed',
                      showAttachMenu
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10',
                    )}
                  >
                    <Paperclip size={15} />
                  </button>

                  {attachments.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-black">
                      {attachments.length}
                    </span>
                  )}

                  {/* Attachment dropdown menu */}
                  {showAttachMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                      <div className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-2xl bg-zinc-900/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/50 overflow-hidden animate-fade-in-up">
                        <div className="p-1.5">
                          <button
                            onClick={() => {
                              setShowAttachMenu(false);
                              if (fileInputRef.current) {
                                fileInputRef.current.accept = 'image/*';
                                fileInputRef.current.click();
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors duration-200"
                          >
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                              <ImageIcon size={14} className="text-emerald-400" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-semibold text-zinc-200">Imagem</p>
                              <p className="text-[10px] text-zinc-500">Foto, print ou screenshot</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowAttachMenu(false);
                              if (fileInputRef.current) {
                                fileInputRef.current.accept = 'video/*';
                                fileInputRef.current.click();
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors duration-200"
                          >
                            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                              <Video size={14} className="text-violet-400" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-semibold text-zinc-200">Video</p>
                              <p className="text-[10px] text-zinc-500">Audio sera transcrito automaticamente</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowAttachMenu(false);
                              setShowRecorder(true);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors duration-200"
                          >
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                              <Camera size={14} className="text-cyan-400" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-semibold text-zinc-200">Gravar Video</p>
                              <p className="text-[10px] text-zinc-500">Ate 2 minutos, com transcricao</p>
                            </div>
                          </button>

                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-[0.93] shrink-0',
                  canSend
                    ? attachments.length > 0
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

        {/* Video recorder modal */}
        <VideoRecorder
          isOpen={showRecorder}
          onClose={() => setShowRecorder(false)}
          onRecorded={(file) => {
            addFilesAsAttachments([file]);
          }}
          maxDurationSec={120}
        />
      </div>
    </div>
  );
}
