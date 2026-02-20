'use server';

import { createClient } from '@supabase/supabase-js';
import {
  derivePoliticalLeaning,
  clampScore,
} from '@/lib/potenciometro/derivation';

// ── Supabase Admin Client ───────────────────────────────────────────────────

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Types ───────────────────────────────────────────────────────────────────

export interface DistributionResult {
  byLeaning: Record<string, number>;
  byMacro: Record<string, number>;
  byCluster: Record<string, number>;
  total: number;
}

export interface RebalanceParams {
  globalDeltaEco: number;
  globalDeltaCost: number;
  macroOverrides?: Record<string, { deltaEco: number; deltaCost: number }>;
}

export interface PreviewResult {
  current: DistributionResult;
  preview: DistributionResult;
  changes: Record<string, { from: number; to: number; delta: number }>;
}

export interface SnapshotInfo {
  id: string;
  label: string;
  created_at: string;
}

// ── Fetch Current Distribution ──────────────────────────────────────────────

export async function fetchDistribution(): Promise<DistributionResult> {
  const { data, error } = await supabaseAdmin
    .from('personas')
    .select('political_leaning, cluster_id');

  if (error) throw new Error(error.message);

  const byLeaning: Record<string, number> = {};
  const byMacro: Record<string, number> = {};
  const byCluster: Record<string, number> = {};

  for (const row of data || []) {
    const leaning = row.political_leaning || 'Desconhecido';
    const cluster = row.cluster_id || '??';
    const macro = cluster.charAt(0);

    byLeaning[leaning] = (byLeaning[leaning] || 0) + 1;
    byMacro[macro] = (byMacro[macro] || 0) + 1;
    byCluster[cluster] = (byCluster[cluster] || 0) + 1;
  }

  return { byLeaning, byMacro, byCluster, total: (data || []).length };
}

// ── Preview Rebalance (read-only simulation) ────────────────────────────────

export async function previewRebalance(
  params: RebalanceParams,
): Promise<PreviewResult> {
  const { data, error } = await supabaseAdmin
    .from('personas')
    .select('cluster_id, score_economico, score_costumes, political_leaning');

  if (error) throw new Error(error.message);

  const currentByLeaning: Record<string, number> = {};
  const previewByLeaning: Record<string, number> = {};
  const previewByMacro: Record<string, number> = {};
  const previewByCluster: Record<string, number> = {};
  const currentByMacro: Record<string, number> = {};
  const currentByCluster: Record<string, number> = {};

  for (const row of data || []) {
    const cluster = row.cluster_id || '??';
    const macro = cluster.charAt(0);
    const oldLeaning = row.political_leaning || 'Desconhecido';

    // Current counts
    currentByLeaning[oldLeaning] = (currentByLeaning[oldLeaning] || 0) + 1;
    currentByMacro[macro] = (currentByMacro[macro] || 0) + 1;
    currentByCluster[cluster] = (currentByCluster[cluster] || 0) + 1;

    // Apply delta
    const override = params.macroOverrides?.[macro];
    const deltaEco = override ? override.deltaEco : params.globalDeltaEco;
    const deltaCost = override ? override.deltaCost : params.globalDeltaCost;

    const newEco = clampScore((row.score_economico || 0) + deltaEco);
    const newCost = clampScore((row.score_costumes || 0) + deltaCost);
    const newLeaning =
      cluster !== '??' ? derivePoliticalLeaning(cluster, newEco, newCost) : oldLeaning;

    // Preview counts
    previewByLeaning[newLeaning] = (previewByLeaning[newLeaning] || 0) + 1;
    previewByMacro[macro] = (previewByMacro[macro] || 0) + 1;
    previewByCluster[cluster] = (previewByCluster[cluster] || 0) + 1;
  }

  // Compute changes per leaning
  const allLeanings = new Set([
    ...Object.keys(currentByLeaning),
    ...Object.keys(previewByLeaning),
  ]);
  const changes: Record<string, { from: number; to: number; delta: number }> = {};
  for (const leaning of allLeanings) {
    const from = currentByLeaning[leaning] || 0;
    const to = previewByLeaning[leaning] || 0;
    changes[leaning] = { from, to, delta: to - from };
  }

  return {
    current: {
      byLeaning: currentByLeaning,
      byMacro: currentByMacro,
      byCluster: currentByCluster,
      total: (data || []).length,
    },
    preview: {
      byLeaning: previewByLeaning,
      byMacro: previewByMacro,
      byCluster: previewByCluster,
      total: (data || []).length,
    },
    changes,
  };
}

// ── Apply Rebalance (writes to DB) ─────────────────────────────────────────

export async function applyRebalance(
  params: RebalanceParams,
): Promise<{ success: boolean; error?: string; snapshotId?: string }> {
  try {
    // 1. Auto-save snapshot
    const snap = await saveSnapshot(
      `Pre-rebalance ${new Date().toISOString().slice(0, 19)}`,
    );
    if (snap.error) return { success: false, error: snap.error };

    // 2. Apply deltas per macro group via RPC
    const macros = ['P', 'M', 'C', 'T'];
    for (const macro of macros) {
      const override = params.macroOverrides?.[macro];
      const deltaEco = override ? override.deltaEco : params.globalDeltaEco;
      const deltaCost = override ? override.deltaCost : params.globalDeltaCost;

      if (deltaEco === 0 && deltaCost === 0) continue;

      const { error } = await supabaseAdmin.rpc('apply_score_delta', {
        p_macro_prefix: macro,
        p_delta_eco: deltaEco,
        p_delta_cost: deltaCost,
      });
      if (error) return { success: false, error: `Delta ${macro}: ${error.message}` };
    }

    // 3. Re-derive political_leaning
    const { error: rederiveErr } = await supabaseAdmin.rpc(
      'rederive_political_leaning',
    );
    if (rederiveErr)
      return { success: false, error: `Re-derive: ${rederiveErr.message}` };

    return { success: true, snapshotId: snap.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Snapshot Management ────────────────────────────────────────────────────

export async function saveSnapshot(
  label: string,
): Promise<{ id?: string; error?: string }> {
  // Fetch all scores
  const { data, error } = await supabaseAdmin
    .from('personas')
    .select('id, score_economico, score_costumes, political_leaning');

  if (error) return { error: error.message };

  const snapshotData = (data || []).map((r) => ({
    id: r.id,
    score_economico: r.score_economico,
    score_costumes: r.score_costumes,
    political_leaning: r.political_leaning,
  }));

  const { data: snap, error: insertErr } = await supabaseAdmin
    .from('persona_snapshots')
    .insert({ label, data: snapshotData })
    .select('id')
    .single();

  if (insertErr) return { error: insertErr.message };
  return { id: snap.id };
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const { data, error } = await supabaseAdmin
    .from('persona_snapshots')
    .select('id, label, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []) as SnapshotInfo[];
}

export async function restoreSnapshot(
  snapshotId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Auto-save current state before restoring
    await saveSnapshot(
      `Pre-restore ${new Date().toISOString().slice(0, 19)}`,
    );

    const { error } = await supabaseAdmin.rpc('restore_persona_snapshot', {
      p_snapshot_id: snapshotId,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
