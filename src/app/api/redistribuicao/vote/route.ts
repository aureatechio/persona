import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// ── Candidates for redistribution simulation ─────────────────────────────────

export interface RedistCandidate {
  id: string;
  name: string;
  party: string;
  position: string;
  leaning: string;
  photoUrl?: string;
}

const DEFAULT_CANDIDATES: RedistCandidate[] = [
  { id: 'lula', name: 'Lula', party: 'PT', position: 'Presidente', leaning: 'esquerda' },
  { id: 'flavio', name: 'Flávio Bolsonaro', party: 'PL', position: 'Senador', leaning: 'direita' },
  { id: 'ratinho', name: 'Ratinho Jr.', party: 'PSD', position: 'Governador PR', leaning: 'centro-direita', photoUrl: '/politicians/ratinho.jpg' },
  { id: 'caiado', name: 'Ronaldo Caiado', party: 'União Brasil', position: 'Governador GO', leaning: 'direita', photoUrl: '/politicians/caiado.jpg' },
];

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um MOTOR DE SIMULAÇÃO ELEITORAL para pesquisa social. Recebe perfis de eleitores brasileiros e simula como votariam numa eleição presidencial entre os candidatos apresentados.

REGRAS:
1. VOTO baseado no PERFIL COMPLETO da persona:
   - score_economico NEGATIVO = tende a ESQUERDA. POSITIVO = tende a DIREITA.
   - score_costumes influencia em temas morais/culturais.
   - Religião evangélica forte = tende conservador.
   - Classe alta + escolaridade alta = pode ser liberal econômico.
   - Região influencia (Sul/Sudeste mais direita, Nordeste mais esquerda).
   - voto_2022 e aprovacao_lula são indicadores FORTES.
   - archetype_primary e cluster_id indicam perfil comportamental.
   - Questionnaire responses (qAvaliacaoBolsonaro, qPoliticoFavorito, etc.) são DECISIVOS.

2. ABSTENÇÃO é válida quando:
   - Cluster T1 (Desengajado) — alta chance
   - Scores muito próximos de 0 em ambos eixos
   - Persona explicitamente anti-sistema

3. Considere que candidatos de DIREITA (Flávio Bolsonaro, Caiado) disputam o MESMO eleitorado conservador.
   Candidatos de CENTRO-DIREITA (Ratinho Jr.) captam moderados.
   Lula domina a esquerda mas perde conservadores.

FORMATO — RESPONDA APENAS COM JSON:
[{"id": "persona_id", "vote": "candidate_id", "confidence": 0.0-1.0}]

Onde candidate_id é um dos IDs fornecidos, ou "abstain" para abstenção.
NÃO inclua explicações, apenas o array JSON.`;

// ── Persona summary builder ──────────────────────────────────────────────────

function summarizePersona(p: any): string {
  const parts = [
    `[${p.id}]`,
    `${p.name} | ${p.gender || '?'}, ${p.age || '?'}a, ${p.raca_cor || '?'}`,
    `${p.city || '?'}/${p.state || '?'} (${p.region_br || '?'}, ${p.area_type || '?'})`,
    `${p.generation || '?'}`,
    `Esc: ${p.education_level || '?'}`,
    `Classe ${p.social_class || '?'}`,
  ];

  const career = p.career_json;
  if (career?.atuação_e_cargo?.cargo_atual) {
    parts.push(`Prof: ${career.atuação_e_cargo.cargo_atual}`);
  }

  parts.push(`${p.civil_status || '?'}`);
  parts.push(`Pol: ${p.political_leaning || '?'}`);
  parts.push(`Rel: ${p.macro_religion || '?'}`);
  parts.push(`Cluster: ${p.cluster_id || '?'}(${p.nome_grupo || '?'})`);
  parts.push(`ScoreEco: ${p.score_economico ?? '?'}`);
  parts.push(`ScoreCost: ${p.score_costumes ?? '?'}`);

  if (p.voto_2022) parts.push(`Voto2022: ${p.voto_2022}`);
  if (p.aprovacao_lula) parts.push(`AprovLula: ${p.aprovacao_lula}`);
  if (p.voto_2026) parts.push(`Voto2026: ${p.voto_2026}`);
  if (p.q_avaliacao_bolsonaro) parts.push(`AvalBolsonaro: ${p.q_avaliacao_bolsonaro}`);
  if (p.archetype_primary) parts.push(`Arq: ${p.archetype_primary}`);

  // Key questionnaire responses
  const beliefs = p.beliefs_json;
  if (beliefs) {
    const pos = beliefs.posicionamentos_politicos;
    if (pos) {
      const themes: string[] = [];
      if (pos.aborto) themes.push(`Aborto:${pos.aborto}`);
      if (pos.armas) themes.push(`Armas:${pos.armas}`);
      if (pos.privatizacoes) themes.push(`Priv:${pos.privatizacoes}`);
      if (themes.length > 0) parts.push(themes.join(' '));
    }
  }

  return parts.join(' | ');
}

// ── Build batch prompt ───────────────────────────────────────────────────────

function buildBatchPrompt(candidates: RedistCandidate[], personas: any[]): string {
  const candidateBlock = candidates
    .map((c) => `• ${c.id}: ${c.name} (${c.party}) — ${c.position} — ${c.leaning}`)
    .join('\n');

  const personaBlock = personas.map(summarizePersona).join('\n');

  return `CANDIDATOS:\n${candidateBlock}\n\nELEITORES (${personas.length} personas):\n${personaBlock}\n\nSimule o VOTO de cada eleitor. Responda APENAS com JSON array.`;
}

// ── API Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  let body: { personas: any[]; candidates?: RedistCandidate[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { personas, candidates = DEFAULT_CANDIDATES } = body;
  if (!personas || personas.length === 0) {
    return NextResponse.json({ error: 'Missing personas' }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  // Batch personas in groups of 50 for GPT-4o-mini
  const BATCH_SIZE = 50;
  const batches: any[][] = [];
  for (let i = 0; i < personas.length; i += BATCH_SIZE) {
    batches.push(personas.slice(i, i + BATCH_SIZE));
  }

  // Process all batches in parallel (max 30 concurrent)
  const MAX_CONCURRENT = 30;
  const results: { id: string; vote: string; confidence: number }[] = [];

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      chunk.map(async (batch) => {
        const prompt = buildBatchPrompt(candidates, batch);

        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 2048,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        });

        const text = response.choices[0]?.message?.content?.trim() || '[]';
        const cleanJson = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        try {
          const parsed = JSON.parse(cleanJson) as { id: string; vote: string; confidence: number }[];
          console.log(`[Vote API] Batch OK: ${parsed.length} votes. Sample:`, parsed.slice(0, 2));
          return parsed;
        } catch (e) {
          console.error('[Vote API] JSON parse error. Raw text:', text.slice(0, 200));
          return [];
        }
      }),
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        results.push(...r.value);
      } else if (r.status === 'rejected') {
        console.error('[Vote API] Batch failed:', r.reason?.message || r.reason);
      }
    }
  }

  return NextResponse.json({
    votes: results,
    totalProcessed: results.length,
    totalPersonas: personas.length,
    candidates,
  });
}
