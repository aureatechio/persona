'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Loader2, Image, Video, X, FileText } from 'lucide-react';
import { useCalibrationStore, calibrationSubmit, type StepState } from '@/app/calibracao/store';
import { processAttachmentsForUpload, type Attachment, type ProcessedAttachment } from '@/lib/file-utils';

interface CityOption {
  city: string;
  count: number;
}

const STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export default function CalibrationInput() {
  const { isProcessing } = useCalibrationStore();
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Mode — always individual (1 persona per call)
  const mode = 'individual' as const;

  // Media state
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mediaProcessing, setMediaProcessing] = useState(false);
  const [mediaStatus, setMediaStatus] = useState('');
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) { setCities([]); setCity(''); return; }
    setLoadingCities(true);
    setCity('');
    fetch(`/api/arena/cities?state=${state}`)
      .then((r) => r.json())
      .then((data) => setCities(data || []))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [state]);

  function handleFileSelect(file: File, type: 'image' | 'video') {
    const att: Attachment = {
      id: crypto.randomUUID(),
      type,
      file,
      name: file.name,
    };
    setAttachment(att);
  }

  function removeAttachment() {
    setAttachment(null);
    setMediaStatus('');
  }

  async function handleSubmit() {
    if (isProcessing || mediaProcessing) return;
    if (!query.trim() && !attachment) return;

    const geoFilter = state ? { state, city: city || undefined } : undefined;
    let contextText = '';
    let finalQuestion = query.trim();

    // Process media if attached
    if (attachment) {
      setMediaProcessing(true);
      const { updateStep } = useCalibrationStore.getState();

      try {
        // Step 1: Process attachment (compress image / transcribe video)
        setMediaStatus('Processando midia...');
        updateStep('media_analysis', {
          status: 'running',
          label: 'Analise de Midia',
          description: attachment.type === 'image' ? 'Comprimindo imagem...' : 'Transcrevendo video com Whisper...',
        });

        const processed = await processAttachmentsForUpload([attachment]);
        const media = processed[0];

        if (!media) {
          setMediaProcessing(false);
          setMediaStatus('Erro ao processar midia');
          return;
        }

        // Step 2: Analyze with Claude
        setMediaStatus('Analisando com Claude...');
        updateStep('media_analysis', {
          description: 'Claude analisando conteudo da midia...',
          input: {
            tipo: media.type,
            nome: media.name,
            tamanho: `${media.data.length.toLocaleString()} chars`,
          },
        });
        const analyzeRes = await fetch('/api/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachments: [{ type: media.type, data: media.data, name: media.name }],
            question: finalQuestion,
            generate_question: !finalQuestion,
          }),
        });

        if (analyzeRes.ok) {
          const result = await analyzeRes.json();
          const context = result.context || '';
          const corePoint = result.core_point || '';
          const generatedQuestion = result.generated_question || '';
          const politicalFigures = result.political_figures || [];

          // Use generated question if user didn't provide one
          if (!finalQuestion && generatedQuestion) {
            finalQuestion = generatedQuestion;
          }
          if (!finalQuestion && corePoint) {
            finalQuestion = corePoint;
          }

          // Build enriched context (same as ArenaMode)
          if (media.type === 'video' && media.data && media.data !== '__TRANSCRIPTION_FAILED__') {
            contextText = `--- Transcricao completa da midia ---\n${media.data}`;
          } else {
            contextText = `--- Contexto extraido da midia ---\n${context}`;
          }

          if (politicalFigures.length > 0) {
            contextText += '\n\n--- Figuras politicas mencionadas ---\n';
            contextText += politicalFigures
              .map((f: any) => `${f.nome} (alinhamento: ${f.alinhamento}) — autor ${f.posicao_autor || 'neutro'} a essa figura`)
              .join('\n');
          }

          // Update store with media analysis results
          updateStep('media_analysis', {
            status: 'complete',
            description: 'Analise de midia concluida',
            output: {
              // Raw transcription (video) or Claude analysis (image)
              transcricao_bruta: media.type === 'video' && media.data && media.data !== '__TRANSCRIPTION_FAILED__'
                ? media.data : undefined,
              contexto_extraido: context,
              core_point: corePoint,
              pergunta_gerada: generatedQuestion || '(nenhuma)',
              figuras_politicas: politicalFigures,
              contexto_enriquecido: contextText,
              // Full Claude response for inspection
              resposta_completa_claude: result,
            },
          });
        }
      } catch (err: any) {
        console.warn('[Calibracao] Media error:', err.message);
        setMediaStatus('Erro na analise de midia');
      }

      setMediaProcessing(false);
      setMediaStatus('');
    }

    if (!finalQuestion) return;

    calibrationSubmit(finalQuestion, geoFilter, contextText || undefined, mode);
  }

  const busy = isProcessing || mediaProcessing;

  return (
    <div className="p-5 border-b border-white/[0.06]">
      {/* Row 1: Geo filter */}
      <div className="flex items-center gap-3 mb-3">
        <MapPin size={14} className="text-zinc-500 shrink-0" />
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          disabled={busy}
          className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="">Todo o Brasil</option>
          {STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {state && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={busy || loadingCities}
            className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>{c.city} ({c.count})</option>
            ))}
          </select>
        )}

        {loadingCities && <Loader2 size={14} className="text-zinc-500 animate-spin" />}
      </div>

      {/* Row 2: Query + media buttons */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={attachment ? 'Pergunta opcional (Claude gera se vazio)' : 'Ex: Qual a opiniao do pessoal sobre o Flamengo?'}
          disabled={busy}
          className="flex-1 px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
        />

        {/* Image upload */}
        <button
          onClick={() => imageRef.current?.click()}
          disabled={busy}
          className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 active:scale-[0.95]"
          title="Anexar imagem"
        >
          <Image size={16} />
        </button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f, 'image');
            e.target.value = '';
          }}
        />

        {/* Video upload */}
        <button
          onClick={() => videoRef.current?.click()}
          disabled={busy}
          className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 active:scale-[0.95]"
          title="Anexar video"
        >
          <Video size={16} />
        </button>
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f, 'video');
            e.target.value = '';
          }}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={busy || (!query.trim() && !attachment)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Analisar
        </button>
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            {attachment.type === 'image' ? <Image size={14} className="text-emerald-400" /> : <Video size={14} className="text-emerald-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-300 truncate">{attachment.name}</p>
            {mediaStatus && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                <Loader2 size={10} className="animate-spin" />
                {mediaStatus}
              </p>
            )}
          </div>
          <button
            onClick={removeAttachment}
            disabled={busy}
            className="p-1 rounded-lg hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300 transition-all duration-200"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
