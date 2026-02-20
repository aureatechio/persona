'use client';

import { useState, useRef, useCallback } from 'react';
import {
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Play,
  Link as LinkIcon,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Attachment,
  isImageFile,
  isVideoFile,
  canAddAttachment,
  createImagePreview,
} from '@/lib/file-utils';

interface ArenaRichInputProps {
  onSubmit: (data: { question: string; contextText: string; attachments: Attachment[] }) => void;
  personaCount: number;
}

export function ArenaRichInput({ onSubmit, personaCount }: ArenaRichInputProps) {
  const [contextText, setContextText] = useState('');
  const [question, setQuestion] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addFilesAsAttachments = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!canAddAttachment(attachments)) break;

      let type: Attachment['type'] = 'image';
      let preview: string | undefined;

      if (isImageFile(file)) {
        type = 'image';
        try {
          preview = await createImagePreview(file);
        } catch { /* skip preview */ }
      } else if (isVideoFile(file)) {
        type = 'video';
      } else {
        continue; // skip unsupported files
      }

      const newAtt: Attachment = {
        id: crypto.randomUUID(),
        type,
        file,
        preview,
        name: file.name,
      };

      setAttachments(prev => [...prev, newAtt]);
    }
  }, [attachments]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesAsAttachments(e.target.files);
      e.target.value = '';
    }
  }, [addFilesAsAttachments]);

  const addUrl = useCallback(() => {
    const url = urlValue.trim();
    if (!url || !canAddAttachment(attachments)) return;

    setAttachments(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'url',
        url,
        name: url.length > 40 ? url.slice(0, 40) + '...' : url,
      },
    ]);
    setUrlValue('');
    setShowUrlInput(false);
  }, [urlValue, attachments]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSubmit = useCallback(() => {
    const q = question.trim();
    if (!q) return;
    onSubmit({ question: q, contextText: contextText.trim(), attachments });
  }, [question, contextText, attachments, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const hasContent = contextText.trim().length > 0 || attachments.length > 0;

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6 animate-fade-in-up">
        <Sparkles size={13} className="text-emerald-400" />
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
          Arena • Analise de Contexto
        </span>
      </div>

      {/* Title */}
      <h2
        className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-center animate-fade-in-up"
        style={{ animationDelay: '80ms' }}
      >
        <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Compartilhe o contexto
        </span>
      </h2>
      <p
        className="text-zinc-500 text-sm max-w-md mx-auto mb-6 text-center animate-fade-in-up leading-relaxed"
        style={{ animationDelay: '160ms' }}
      >
        Cole texto, arraste imagens ou adicione links.{' '}
        <span className="text-zinc-300 font-semibold">{personaCount.toLocaleString('pt-BR')}</span>{' '}
        personas vao analisar.
      </p>

      {/* Drop zone + context input */}
      <div
        className="w-full animate-fade-in-up"
        style={{ animationDelay: '240ms' }}
      >
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden',
            isDragging
              ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
              : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]',
          )}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/[0.06] backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-2">
                <CloudUpload size={32} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Solte aqui</p>
              </div>
            </div>
          )}

          {/* Upload hint (only when empty) */}
          {!hasContent && !isDragging && (
            <div className="flex flex-col items-center gap-2 pt-6 pb-2 pointer-events-none">
              <CloudUpload size={24} className="text-zinc-600" />
              <p className="text-xs text-zinc-600">Arraste arquivos ou cole texto abaixo</p>
            </div>
          )}

          {/* Textarea for context */}
          <textarea
            ref={textareaRef}
            value={contextText}
            onChange={e => setContextText(e.target.value)}
            placeholder="Cole aqui o texto, noticia, artigo, tweet ou qualquer contexto para a analise..."
            rows={hasContent ? 5 : 3}
            className="w-full bg-transparent px-5 py-4 text-sm text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Type buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => textareaRef.current?.focus()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all duration-200"
          >
            <FileText size={14} /> Texto
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all duration-200"
          >
            <ImageIcon size={14} /> Foto
          </button>
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*';
                fileInputRef.current.click();
                // Reset accept after click
                setTimeout(() => {
                  if (fileInputRef.current) fileInputRef.current.accept = 'image/*,video/*';
                }, 100);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all duration-200"
          >
            <Play size={14} /> Video
          </button>
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200',
              showUrlInput
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200',
            )}
          >
            <LinkIcon size={14} /> Link
          </button>

          {attachments.length > 0 && (
            <span className="text-[10px] text-zinc-600 ml-auto">
              {attachments.length}/5 anexos
            </span>
          )}
        </div>

        {/* URL input */}
        {showUrlInput && (
          <div className="flex items-center gap-2 mt-2 animate-fade-in-up">
            <input
              type="url"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()}
              placeholder="https://exemplo.com/artigo"
              className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200"
            />
            <button
              onClick={addUrl}
              disabled={!urlValue.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {attachments.map(att => (
              <div
                key={att.id}
                className="relative group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] transition-all duration-200"
              >
                {att.type === 'image' && att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : att.type === 'video' ? (
                  <Play size={14} className="text-violet-400" />
                ) : (
                  <LinkIcon size={14} className="text-sky-400" />
                )}
                <span className="text-xs text-zinc-400 max-w-[120px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 p-0.5 rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Question input */}
        <div className="relative mt-4 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600/15 via-violet-600/15 to-emerald-600/15 rounded-[1.25rem] blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center bg-zinc-900/90 border border-white/[0.08] rounded-2xl group-focus-within:border-emerald-500/30 transition-all duration-300 backdrop-blur-2xl overflow-hidden">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Qual a sua pergunta sobre este contexto?"
              className="flex-1 bg-transparent px-5 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!question.trim()}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-[0.93] mr-2 shrink-0',
                question.trim()
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/25'
                  : 'bg-white/[0.06] text-zinc-600 cursor-not-allowed',
              )}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
