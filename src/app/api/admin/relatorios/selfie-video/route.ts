import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL = new Set(['completed', 'failed']);
const MAX_ROWS = 5000;

interface BaseModelOption {
  id: string;
  slug: string | null;
  display_name: string | null;
  name: string;
  is_active: boolean;
  video_strategy: string | null;
}

interface V2SelfieRow {
  id: string;
  name: string;
  phone: string;
  first_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  transcription: string | null;
  theme_slug: string | null;
  generated_text: string | null;
  video_strategy: string | null;
  category: string | null;
  selfie_video_path: string | null;
  tts_audio_path: string | null;
  lipsync_video_url: string | null;
  final_video_path: string | null;
  name_sync_cached_path: string | null;
  lipsync_cached_path: string | null;
  cached_from: string | null;
  whatsapp_sent: boolean | null;
  whatsapp_sent_at: string | null;
  whatsapp_provider: string | null;
  whatsapp_button_clicked_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  retry_count: number | null;
  base_model_id: string | null;
  v2_base_models: { id: string; slug: string | null; display_name: string | null; name: string } | null;
}

interface ReportItem {
  id: string;
  name: string;
  phone: string;
  firstName: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  transcription: string | null;
  themeSlug: string | null;
  generatedText: string | null;
  videoStrategy: string | null;
  category: string | null;
  hasSelfie: boolean;
  hasTts: boolean;
  hasLipsync: boolean;
  hasFinalVideo: boolean;
  finalVideoPath: string | null;
  cachedFrom: string | null;
  isCached: boolean;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  whatsappProvider: string | null;
  whatsappButtonClickedAt: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  retryCount: number;
  baseModelId: string | null;
  baseModelSlug: string | null;
  baseModelName: string | null;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function progressLabel(status: string, hasFinalVideo: boolean, whatsappSent: boolean): string {
  if (status === 'completed' && whatsappSent) return 'completo_enviado';
  if (status === 'completed') return 'completo_nao_enviado';
  if (status === 'failed') return 'falhou';
  if (hasFinalVideo) return 'video_pronto_pendente';
  if (status === 'recording') return 'so_inicio_gravando';
  return 'em_processo';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pipeline = searchParams.get('pipeline') || 'v2';
    const baseModelId = searchParams.get('baseModelId') || null;
    const slug = searchParams.get('slug') || null;
    const status = searchParams.get('status') || null;
    const strategy = searchParams.get('strategy') || null;
    const themeSlug = searchParams.get('theme') || null;
    const whatsappFilter = searchParams.get('whatsapp') || null;
    const from = parseDate(searchParams.get('from'));
    const to = parseDate(searchParams.get('to'));
    const search = searchParams.get('q')?.trim() || null;
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10) || 500, MAX_ROWS);

    // V2 base models for filter dropdown
    const { data: modelsData } = await supabaseAdmin
      .from('v2_base_models')
      .select('id, slug, display_name, name, is_active, video_strategy')
      .order('is_active', { ascending: false })
      .order('display_name', { ascending: true, nullsFirst: false });

    const baseModels: BaseModelOption[] = (modelsData ?? []) as BaseModelOption[];

    // Resolve slug -> id
    let effectiveBaseModelId = baseModelId;
    if (!effectiveBaseModelId && slug) {
      const match = baseModels.find((m) => m.slug === slug);
      effectiveBaseModelId = match?.id ?? null;
    }

    // V2 themes for filter dropdown
    const { data: themesData } = await supabaseAdmin
      .from('v2_themes_template')
      .select('slug, label')
      .order('display_order', { ascending: true });

    const themes = (themesData ?? []) as { slug: string; label: string }[];

    // Main query - V2 pipeline
    let query = supabaseAdmin
      .from('v2_video_selfies')
      .select(
        `id, name, phone, first_name, status, error_message, created_at, updated_at,
         transcription, theme_slug, generated_text, video_strategy, category,
         selfie_video_path, tts_audio_path, lipsync_video_url, final_video_path,
         name_sync_cached_path, lipsync_cached_path, cached_from,
         whatsapp_sent, whatsapp_sent_at, whatsapp_provider, whatsapp_button_clicked_at,
         locked_by, locked_at, retry_count, base_model_id,
         v2_base_models:base_model_id (id, slug, display_name, name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (effectiveBaseModelId) query = query.eq('base_model_id', effectiveBaseModelId);
    if (status) query = query.eq('status', status);
    if (strategy) query = query.eq('video_strategy', strategy);
    if (themeSlug) query = query.eq('theme_slug', themeSlug);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    // WhatsApp delivery filter
    if (whatsappFilter === 'sent') query = query.eq('whatsapp_sent', true);
    else if (whatsappFilter === 'not_sent') query = query.or('whatsapp_sent.is.null,whatsapp_sent.eq.false');
    else if (whatsappFilter === 'clicked') query = query.not('whatsapp_button_clicked_at', 'is', null);

    const { data, count, error } = await query;
    if (error) {
      console.error('relatorios/selfie-video v2 query error:', error);
      return NextResponse.json({ error: 'Falha ao consultar dados' }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as V2SelfieRow[];

    const items: ReportItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      firstName: r.first_name,
      status: r.status,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      transcription: r.transcription,
      themeSlug: r.theme_slug,
      generatedText: r.generated_text,
      videoStrategy: r.video_strategy,
      category: r.category,
      hasSelfie: !!r.selfie_video_path,
      hasTts: !!r.tts_audio_path,
      hasLipsync: !!r.lipsync_video_url,
      hasFinalVideo: !!r.final_video_path,
      finalVideoPath: r.final_video_path,
      cachedFrom: r.cached_from,
      isCached: !!r.cached_from || !!r.name_sync_cached_path || !!r.lipsync_cached_path,
      whatsappSent: !!r.whatsapp_sent,
      whatsappSentAt: r.whatsapp_sent_at,
      whatsappProvider: r.whatsapp_provider,
      whatsappButtonClickedAt: r.whatsapp_button_clicked_at,
      isLocked: !!r.locked_by && !!r.locked_at,
      lockedAt: r.locked_at,
      retryCount: r.retry_count ?? 0,
      baseModelId: r.base_model_id,
      baseModelSlug: r.v2_base_models?.slug ?? null,
      baseModelName: r.v2_base_models?.display_name ?? r.v2_base_models?.name ?? null,
    }));

    // Aggregations
    const summary = {
      total: items.length,
      totalInDb: count ?? items.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      whatsappSent: 0,
      whatsappClicked: 0,
      whatsappOfficial: 0,
      whatsappUazapi: 0,
      cached: 0,
      hasFinalVideo: 0,
      hasLipsync: 0,
      recordingOnly: 0,
      locked: 0,
    };

    const statusMap = new Map<string, number>();
    const strategyMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const themeMap = new Map<string, number>();
    const progressMap = new Map<string, number>();
    const providerMap = new Map<string, number>();

    for (const it of items) {
      if (it.status === 'completed') summary.completed += 1;
      else if (it.status === 'failed') summary.failed += 1;
      else if (!TERMINAL.has(it.status)) summary.inProgress += 1;

      if (it.whatsappSent) {
        summary.whatsappSent += 1;
        if (it.whatsappProvider === 'official') summary.whatsappOfficial += 1;
        else if (it.whatsappProvider === 'uazapi') summary.whatsappUazapi += 1;
      }
      if (it.whatsappButtonClickedAt) summary.whatsappClicked += 1;
      if (it.isCached) summary.cached += 1;
      if (it.hasFinalVideo) summary.hasFinalVideo += 1;
      if (it.hasLipsync && !it.hasFinalVideo) summary.hasLipsync += 1;
      if (it.status === 'recording') summary.recordingOnly += 1;
      if (it.isLocked) summary.locked += 1;

      statusMap.set(it.status, (statusMap.get(it.status) ?? 0) + 1);

      const strat = it.videoStrategy ?? 'unknown';
      strategyMap.set(strat, (strategyMap.get(strat) ?? 0) + 1);

      const day = new Date(it.createdAt).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

      if (it.category) categoryMap.set(it.category, (categoryMap.get(it.category) ?? 0) + 1);
      if (it.themeSlug) themeMap.set(it.themeSlug, (themeMap.get(it.themeSlug) ?? 0) + 1);

      const prog = progressLabel(it.status, it.hasFinalVideo, it.whatsappSent);
      progressMap.set(prog, (progressMap.get(prog) ?? 0) + 1);

      if (it.whatsappProvider) {
        providerMap.set(it.whatsappProvider, (providerMap.get(it.whatsappProvider) ?? 0) + 1);
      }
    }

    const byStatus = Array.from(statusMap.entries())
      .map(([k, v]) => ({ status: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const byStrategy = Array.from(strategyMap.entries())
      .map(([k, v]) => ({ strategy: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const byCategory = Array.from(categoryMap.entries())
      .map(([k, v]) => ({ category: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const byTheme = Array.from(themeMap.entries())
      .map(([k, v]) => ({ theme: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const byProgress = Array.from(progressMap.entries())
      .map(([k, v]) => ({ progress: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const byProvider = Array.from(providerMap.entries())
      .map(([k, v]) => ({ provider: k, count: v }))
      .sort((a, b) => b.count - a.count);

    // Time series - 30 days
    const endDate = to ? new Date(to) : new Date();
    const byDay: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(endDate.getTime() - i * ONE_DAY_MS).toISOString().slice(0, 10);
      byDay.push({ date: day, count: dayMap.get(day) ?? 0 });
    }

    // CSV export
    if (format === 'csv') {
      const header = [
        'id', 'criado_em', 'atualizado_em', 'candidato', 'candidato_slug',
        'nome_completo', 'primeiro_nome', 'telefone', 'status', 'progresso',
        'estrategia', 'tema', 'categoria', 'transcricao',
        'tem_selfie', 'tem_tts', 'tem_lipsync', 'tem_video_final',
        'cacheado', 'cacheado_de',
        'whatsapp_enviado', 'whatsapp_enviado_em', 'whatsapp_provedor',
        'whatsapp_botao_clicado_em', 'tentativas', 'travado', 'erro',
      ];
      const lines: string[] = [header.join(',')];
      for (const it of items) {
        lines.push(
          [
            it.id, it.createdAt, it.updatedAt,
            it.baseModelName ?? '', it.baseModelSlug ?? '',
            it.name, it.firstName ?? '', it.phone,
            it.status,
            progressLabel(it.status, it.hasFinalVideo, it.whatsappSent),
            it.videoStrategy ?? '', it.themeSlug ?? '', it.category ?? '',
            it.transcription ?? '',
            it.hasSelfie ? 'sim' : 'nao',
            it.hasTts ? 'sim' : 'nao',
            it.hasLipsync ? 'sim' : 'nao',
            it.hasFinalVideo ? 'sim' : 'nao',
            it.isCached ? 'sim' : 'nao',
            it.cachedFrom ?? '',
            it.whatsappSent ? 'sim' : 'nao',
            it.whatsappSentAt ?? '',
            it.whatsappProvider ?? '',
            it.whatsappButtonClickedAt ?? '',
            it.retryCount,
            it.isLocked ? 'sim' : 'nao',
            it.errorMessage ?? '',
          ]
            .map(csvEscape)
            .join(','),
        );
      }
      const csv = '\uFEFF' + lines.join('\n');
      const slugPart = baseModels.find((m) => m.id === effectiveBaseModelId)?.slug || 'todos';
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `relatorio-v2-${slugPart}-${stamp}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      pipeline,
      filters: {
        baseModelId: effectiveBaseModelId,
        status,
        strategy,
        theme: themeSlug,
        whatsapp: whatsappFilter,
        from,
        to,
        search,
        limit,
      },
      baseModels,
      themes,
      summary,
      byStatus,
      byStrategy,
      byCategory,
      byTheme,
      byProgress,
      byProvider,
      byDay,
      items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('relatorios/selfie-video error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
