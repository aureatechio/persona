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

interface SelfieRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  whatsapp_sent: boolean | null;
  whatsapp_sent_at: string | null;
  whatsapp_button_clicked_at: string | null;
  video_strategy: string | null;
  category: string | null;
  first_name: string | null;
  cached_from: string | null;
  final_video_path: string | null;
  lipsync_video_url: string | null;
  selfie_video_path: string | null;
  transcription: string | null;
  retry_count: number | null;
  base_model_id: string | null;
  video_base_models: { id: string; slug: string | null; display_name: string | null; name: string } | null;
}

interface ReportItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  whatsappButtonClickedAt: string | null;
  videoStrategy: string | null;
  category: string | null;
  firstName: string | null;
  cachedFrom: string | null;
  hasFinalVideo: boolean;
  hasLipsyncOnly: boolean;
  hasSelfie: boolean;
  hasTranscription: boolean;
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
    const baseModelId = searchParams.get('baseModelId') || null;
    const slug = searchParams.get('slug') || null;
    const status = searchParams.get('status') || null;
    const strategy = searchParams.get('strategy') || null;
    const from = parseDate(searchParams.get('from'));
    const to = parseDate(searchParams.get('to'));
    const search = searchParams.get('q')?.trim() || null;
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10) || 500, MAX_ROWS);

    // Lista de candidatos disponíveis (para popular o filtro no front)
    const { data: modelsData } = await supabaseAdmin
      .from('video_base_models')
      .select('id, slug, display_name, name, is_active, video_strategy')
      .order('is_active', { ascending: false })
      .order('display_name', { ascending: true, nullsFirst: false });

    const baseModels: BaseModelOption[] = (modelsData ?? []) as BaseModelOption[];

    // Resolve slug -> id se necessário
    let effectiveBaseModelId = baseModelId;
    if (!effectiveBaseModelId && slug) {
      const match = baseModels.find((m) => m.slug === slug);
      effectiveBaseModelId = match?.id ?? null;
    }

    let query = supabaseAdmin
      .from('video_selfies')
      .select(
        `id, name, phone, status, error_message, created_at, updated_at,
         whatsapp_sent, whatsapp_sent_at, whatsapp_button_clicked_at,
         video_strategy, category, first_name, cached_from,
         final_video_path, lipsync_video_url, selfie_video_path,
         transcription, retry_count, base_model_id,
         video_base_models:base_model_id (id, slug, display_name, name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (effectiveBaseModelId) query = query.eq('base_model_id', effectiveBaseModelId);
    if (status) query = query.eq('status', status);
    if (strategy) query = query.eq('video_strategy', strategy);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) {
      console.error('relatorios/selfie-video query error:', error);
      return NextResponse.json({ error: 'Falha ao consultar dados' }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as SelfieRow[];

    const items: ReportItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      status: r.status,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      whatsappSent: !!r.whatsapp_sent,
      whatsappSentAt: r.whatsapp_sent_at,
      whatsappButtonClickedAt: r.whatsapp_button_clicked_at,
      videoStrategy: r.video_strategy,
      category: r.category,
      firstName: r.first_name,
      cachedFrom: r.cached_from,
      hasFinalVideo: !!r.final_video_path,
      hasLipsyncOnly: !r.final_video_path && !!r.lipsync_video_url,
      hasSelfie: !!r.selfie_video_path,
      hasTranscription: !!r.transcription,
      retryCount: r.retry_count ?? 0,
      baseModelId: r.base_model_id,
      baseModelSlug: r.video_base_models?.slug ?? null,
      baseModelName: r.video_base_models?.display_name ?? r.video_base_models?.name ?? null,
    }));

    // Agregações
    const summary = {
      total: items.length,
      totalInDb: count ?? items.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      whatsappSent: 0,
      whatsappClicked: 0,
      cached: 0,
      hasFinalVideo: 0,
      hasLipsyncOnly: 0,
      recordingOnly: 0,
    };

    const statusMap = new Map<string, number>();
    const strategyMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const progressMap = new Map<string, number>();

    for (const it of items) {
      if (it.status === 'completed') summary.completed += 1;
      else if (it.status === 'failed') summary.failed += 1;
      else if (!TERMINAL.has(it.status)) summary.inProgress += 1;

      if (it.whatsappSent) summary.whatsappSent += 1;
      if (it.whatsappButtonClickedAt) summary.whatsappClicked += 1;
      if (it.cachedFrom) summary.cached += 1;
      if (it.hasFinalVideo) summary.hasFinalVideo += 1;
      if (it.hasLipsyncOnly) summary.hasLipsyncOnly += 1;
      if (it.status === 'recording') summary.recordingOnly += 1;

      statusMap.set(it.status, (statusMap.get(it.status) ?? 0) + 1);
      const strat = it.videoStrategy ?? 'unknown';
      strategyMap.set(strat, (strategyMap.get(strat) ?? 0) + 1);
      const day = new Date(it.createdAt).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      if (it.category) categoryMap.set(it.category, (categoryMap.get(it.category) ?? 0) + 1);

      const prog = progressLabel(it.status, it.hasFinalVideo, it.whatsappSent);
      progressMap.set(prog, (progressMap.get(prog) ?? 0) + 1);
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
    const byProgress = Array.from(progressMap.entries())
      .map(([k, v]) => ({ progress: k, count: v }))
      .sort((a, b) => b.count - a.count);

    // Série temporal — 30 dias terminando hoje (ou no `to` se enviado)
    const endDate = to ? new Date(to) : new Date();
    const byDay: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(endDate.getTime() - i * ONE_DAY_MS).toISOString().slice(0, 10);
      byDay.push({ date: day, count: dayMap.get(day) ?? 0 });
    }

    // CSV export
    if (format === 'csv') {
      const header = [
        'id',
        'criado_em',
        'atualizado_em',
        'candidato',
        'candidato_slug',
        'nome',
        'telefone',
        'status',
        'progresso',
        'estrategia',
        'categoria',
        'tem_video_final',
        'so_lipsync',
        'tem_selfie',
        'tem_transcricao',
        'whatsapp_enviado',
        'whatsapp_enviado_em',
        'whatsapp_botao_clicado_em',
        'tentativas',
        'cacheado_de',
        'erro',
      ];
      const lines: string[] = [header.join(',')];
      for (const it of items) {
        lines.push(
          [
            it.id,
            it.createdAt,
            it.updatedAt,
            it.baseModelName ?? '',
            it.baseModelSlug ?? '',
            it.name,
            it.phone,
            it.status,
            progressLabel(it.status, it.hasFinalVideo, it.whatsappSent),
            it.videoStrategy ?? '',
            it.category ?? '',
            it.hasFinalVideo ? 'sim' : 'nao',
            it.hasLipsyncOnly ? 'sim' : 'nao',
            it.hasSelfie ? 'sim' : 'nao',
            it.hasTranscription ? 'sim' : 'nao',
            it.whatsappSent ? 'sim' : 'nao',
            it.whatsappSentAt ?? '',
            it.whatsappButtonClickedAt ?? '',
            it.retryCount,
            it.cachedFrom ?? '',
            it.errorMessage ?? '',
          ]
            .map(csvEscape)
            .join(','),
        );
      }
      const csv = '﻿' + lines.join('\n');
      const slugPart = baseModels.find((m) => m.id === effectiveBaseModelId)?.slug || 'todos';
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `relatorio-selfie-video-${slugPart}-${stamp}.csv`;
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
      filters: {
        baseModelId: effectiveBaseModelId,
        status,
        strategy,
        from,
        to,
        search,
        limit,
      },
      baseModels,
      summary,
      byStatus,
      byStrategy,
      byCategory,
      byProgress,
      byDay,
      items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('relatorios/selfie-video error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
