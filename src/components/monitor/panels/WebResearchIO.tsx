'use client';

import { Search, ExternalLink, FileText } from 'lucide-react';
import { InputSection, OutputSection } from './IOWrapper';

interface WebResearchData {
  queries: string[];
  snippets: string[];
  sources: string[];
}

export function WebResearchIO({ data }: { data: WebResearchData }) {
  return (
    <div className="space-y-4">
      {/* ── INPUT — search queries ── */}
      <InputSection>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Queries pesquisadas
        </span>
        <div className="space-y-1.5">
          {data.queries?.map((q, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <Search size={12} className="text-sky-400 shrink-0 mt-0.5" />
              <span className="text-sm text-zinc-300">{q}</span>
            </div>
          ))}
        </div>
      </InputSection>

      {/* ── OUTPUT — sources + snippets ── */}
      <OutputSection>
        {/* Sources */}
        {data.sources?.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Fontes encontradas
            </span>
            <div className="space-y-1.5">
              {data.sources.map((src, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <ExternalLink
                    size={12}
                    className="text-violet-400 shrink-0"
                  />
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 truncate hover:text-sky-300 transition-colors duration-200"
                  >
                    {src}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Snippets */}
        {data.snippets?.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Trechos coletados
            </span>
            <div className="space-y-2">
              {data.snippets.map((snip, i) => (
                <div
                  key={i}
                  className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText size={12} className="text-zinc-600" />
                    <span className="text-xs text-zinc-600 font-bold">
                      Trecho #{i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {snip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </OutputSection>
    </div>
  );
}
