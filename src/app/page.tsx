'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import {
  Menu,
  Send,
  Brain,
  Shield,
  Heart,
  Scale,
  Rocket,
  Users,
  RotateCcw,
  Sparkles,
  Activity,
  Zap,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { generateComment } from '@/lib/comment-generator';
import type { PersonaContext } from '@/lib/persona-writing-style';
import type { PersonaForAI } from '@/lib/simulation-prompt';

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'processing' | 'results';
type Sentiment = 'positive' | 'negative' | 'neutral';

interface ArchetypeResult {
  id: string;
  name: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface CommentResult {
  archetype: string;
  sentiment: Sentiment;
  comment: string;
  personaName: string;
  age: number;
  location: string;
  state: string;
  region: string;
  generation: string;
}

interface SimulationResult {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  archetypes: ArchetypeResult[];
  comments: CommentResult[];
  processingTime: number;
}

// ── Archetype Definitions (5 Personas) ───────────────────────────────────────
const ARCHETYPES = [
  {
    id: 'traditionalist',
    name: 'Tradicionalista',
    subtitle: 'Conservador & Religioso',
    icon: Shield,
    gradient: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    bg: 'bg-blue-500',
    dot: 'bg-blue-400',
    political: ['Direita', 'Centro-Direita', 'Extrema Direita'],
    sentimentBias: { crime: 0.85, social: 0.2, economy: 0.7, politics: 0.6, environment: 0.25, general: 0.5 },
  },
  {
    id: 'activist',
    name: 'Engajado Social',
    subtitle: 'Justiça & Direitos Humanos',
    icon: Heart,
    gradient: 'from-rose-500/20 to-rose-600/5',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    bg: 'bg-rose-500',
    dot: 'bg-rose-400',
    political: ['Esquerda', 'Centro-Esquerda', 'Extrema Esquerda'],
    sentimentBias: { crime: 0.2, social: 0.9, economy: 0.35, politics: 0.7, environment: 0.85, general: 0.5 },
  },
  {
    id: 'analyst',
    name: 'Analítico Racional',
    subtitle: 'Dados & Evidências',
    icon: Brain,
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500',
    dot: 'bg-cyan-400',
    political: ['Centro', 'Centro-Liberal'],
    sentimentBias: { crime: 0.5, social: 0.55, economy: 0.6, politics: 0.45, environment: 0.6, general: 0.5 },
  },
  {
    id: 'moderate',
    name: 'Moderado',
    subtitle: 'Equilíbrio & Consenso',
    icon: Scale,
    gradient: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    dot: 'bg-amber-400',
    political: ['Centro', 'Centro-Esquerda', 'Centro-Direita'],
    sentimentBias: { crime: 0.5, social: 0.5, economy: 0.5, politics: 0.5, environment: 0.5, general: 0.5 },
  },
  {
    id: 'entrepreneur',
    name: 'Empreendedor',
    subtitle: 'Resultados & Inovação',
    icon: Rocket,
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    dot: 'bg-emerald-400',
    political: ['Centro-Liberal', 'Centro-Direita', 'Direita'],
    sentimentBias: { crime: 0.65, social: 0.3, economy: 0.85, politics: 0.55, environment: 0.35, general: 0.5 },
  },
];

const BASE_DISTRIBUTION = [0.22, 0.20, 0.18, 0.22, 0.18];

// ── Topic Detection Keywords ─────────────────────────────────────────────────
const TOPICS: Record<string, string[]> = {
  crime: ['pris', 'crime', 'conden', 'puni', 'cadeia', 'assassin', 'roubo', 'assalto', 'ladr', 'band', 'trafic', 'matar', 'morte', 'violenc', 'estupro', 'perpetu', 'pena', 'matar', 'homicid', 'latrocin', 'menor', 'menino', 'condenar', 'julgam', 'impunid', 'arma', 'porte', 'milici', 'segur', 'polici', 'delegac'],
  social: ['direito', 'igualdade', 'inclus', 'diversid', 'lgbt', 'feminism', 'racismo', 'preconceito', 'educac', 'saude', 'sus', 'cotas', 'social', 'pobreza', 'fome', 'moradia', 'escola', 'aborto', 'droga', 'maconha', 'legaliz', 'genero', 'trans', 'casamento', 'adoc'],
  economy: ['econom', 'mercado', 'invest', 'emprego', 'salario', 'imposto', 'inflac', 'pib', 'dolar', 'bolsa', 'empresa', 'negocio', 'cresciment', 'reform', 'fiscal', 'privat', 'estatal', 'petrob', 'petrobras', 'privatiz', 'banco', 'juros', 'selic', 'divida', 'orcament', 'tributar', 'empreend', 'startup', 'comerci', 'industri'],
  politics: ['govern', 'president', 'congresso', 'politic', 'eleic', 'votac', 'partido', 'democrac', 'corrupc', 'reforma', 'senado', 'camara', 'stf', 'ministro', 'lula', 'bolsonar', 'impeach', 'cpi', 'deputad', 'vereador', 'prefeit', 'governad'],
  environment: ['ambient', 'clima', 'sustentab', 'desmata', 'poluic', 'ecolog', 'verde', 'amazon', 'naturez', 'carbono', 'energia', 'renovavel', 'queimad', 'floresta', 'bioma', 'pantanal', 'agrotox'],
};

// ── Dynamic Archetype Distribution by Topic ─────────────────────────────────
// Order: [traditionalist, activist, analyst, moderate, entrepreneur]
const TOPIC_DISTRIBUTIONS: Record<string, number[]> = {
  crime:       [0.30, 0.15, 0.15, 0.22, 0.18], // traditionalist leads
  social:      [0.20, 0.30, 0.12, 0.22, 0.16], // activist leads
  economy:     [0.18, 0.14, 0.18, 0.18, 0.32], // entrepreneur leads
  politics:    [0.24, 0.22, 0.16, 0.20, 0.18], // balanced, slight traditional/activist
  environment: [0.15, 0.30, 0.18, 0.22, 0.15], // activist leads
  general:     [0.22, 0.20, 0.18, 0.22, 0.18], // base distribution
};

function getTopicDistribution(topicScores: Record<string, number>): number[] {
  const result = [0, 0, 0, 0, 0];
  let totalWeight = 0;

  for (const [topic, score] of Object.entries(topicScores)) {
    if (score <= 0) continue;
    const dist = TOPIC_DISTRIBUTIONS[topic] || TOPIC_DISTRIBUTIONS['general'];
    for (let i = 0; i < 5; i++) {
      result[i] += dist[i] * score;
    }
    totalWeight += score;
  }

  if (totalWeight === 0) return BASE_DISTRIBUTION;

  // Normalize to sum to 1
  const sum = result.reduce((a, b) => a + b, 0);
  return result.map(v => v / sum);
}

// ── Archetype → Persona mapping helper ──────────────────────────────────────
const ARCHETYPE_TO_POLITICAL: Record<string, string[]> = {
  traditionalist: ['Direita', 'Centro-Direita', 'Extrema Direita'],
  activist: ['Esquerda', 'Centro-Esquerda', 'Extrema Esquerda'],
  analyst: ['Centro', 'Centro-Liberal'],
  moderate: ['Centro', 'Centro-Esquerda', 'Centro-Direita'],
  entrepreneur: ['Centro-Liberal', 'Centro-Direita', 'Direita', 'Libertário'],
};

/** Map a DB persona row to PersonaContext for the comment generator */
function toPersonaContext(persona: Record<string, any>, archetypeId: string): PersonaContext {
  return {
    region: persona.region_br || 'Sudeste',
    state: persona.state || 'SP',
    generation: persona.generation || 'Millennial',
    educationLevel: persona.education_level || 'Médio',
    socialClass: persona.social_class || 'C1',
    politicalLeaning: persona.political_leaning || 'Centro',
    religion: persona.macro_religion || 'Católico',
    age: persona.age || 30,
    gender: persona.gender_identity || 'Masculino',
    areaType: persona.area_type || 'Urbana/Interior',
    archetypeId,
    name: persona.name || 'Persona',
  };
}

// ── Simulation Engine ────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectTopics(question: string): Record<string, number> {
  const norm = normalize(question);
  const scores: Record<string, number> = {};

  for (const [topic, keywords] of Object.entries(TOPICS)) {
    let score = 0;
    for (const kw of keywords) {
      if (norm.includes(normalize(kw))) score++;
    }
    scores[topic] = Math.min(score / 3, 1);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) {
    for (const topic of Object.keys(scores)) {
      scores[topic] = 0.3;
    }
    scores['general'] = 1;
  }

  return scores;
}

function simulatePersonaSentiment(
  topicScores: Record<string, number>,
  archetype: typeof ARCHETYPES[0]
): Sentiment {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [topic, score] of Object.entries(topicScores)) {
    if (score > 0) {
      const bias = archetype.sentimentBias[topic as keyof typeof archetype.sentimentBias] ?? 0.5;
      weightedScore += bias * score;
      totalWeight += score;
    }
  }

  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  const noise = (Math.random() - 0.5) * 0.4;
  const finalScore = Math.max(0, Math.min(1, baseScore + noise));

  if (finalScore > 0.6) return 'positive';
  if (finalScore < 0.4) return 'negative';
  return 'neutral';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function runSimulation(question: string, personaCount: number): Omit<SimulationResult, 'comments'> {
  const startTime = performance.now();
  const topicScores = detectTopics(question);
  const distribution = getTopicDistribution(topicScores);

  const archetypeResults: ArchetypeResult[] = [];
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  ARCHETYPES.forEach((archetype, idx) => {
    const count = Math.round(personaCount * distribution[idx]);
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (let i = 0; i < count; i++) {
      const sentiment = simulatePersonaSentiment(topicScores, archetype);
      if (sentiment === 'positive') positive++;
      else if (sentiment === 'negative') negative++;
      else neutral++;
    }

    totalPositive += positive;
    totalNegative += negative;
    totalNeutral += neutral;

    archetypeResults.push({
      id: archetype.id,
      name: archetype.name,
      count,
      positive,
      negative,
      neutral,
    });
  });

  return {
    total: personaCount,
    positive: totalPositive,
    negative: totalNegative,
    neutral: totalNeutral,
    archetypes: archetypeResults,
    processingTime: performance.now() - startTime,
  };
}

/** Shuffle array in-place (Fisher-Yates) and return it */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Map a DB persona row to PersonaForAI */
function mapPersona(persona: Record<string, any>, archetypeId: string, sentiment: Sentiment): PersonaForAI {
  return {
    name: persona.name || 'Anônimo',
    age: persona.age || 30,
    state: persona.state || 'SP',
    region: persona.region_br || 'Sudeste',
    generation: persona.generation || 'Millennial',
    educationLevel: persona.education_level || 'Médio',
    socialClass: persona.social_class || 'C1',
    politicalLeaning: persona.political_leaning || 'Centro',
    religion: persona.macro_religion || 'Católico',
    areaType: persona.area_type || 'Urbana/Interior',
    archetypeId,
    sentiment,
    gender: persona.gender_identity || 'Masculino',
    ethnicity: persona.demographic_json?.identidade_basica?.etnia || 'Não informado',
    civilStatus: persona.civil_status || persona.demographic_json?.familia_e_estado_civil?.estado_civil || 'Solteiro',
    occupation: persona.career_json?.atuação_e_cargo?.cargo_atual || persona.career_json?.atuacao_e_cargo?.cargo_atual || 'Trabalhador',
  };
}

/** Build list of personas to send to AI for comment generation.
 *  Guarantees ALL 35 personas are UNIQUE — never repeats. */
function buildPersonasForAI(
  _question: string,
  personas: Record<string, any>[],
  _topicScores: Record<string, number>,
): PersonaForAI[] {
  const result: PersonaForAI[] = [];
  const usedIds = new Set<string>();
  const sentimentTypes: Sentiment[] = ['positive', 'negative', 'neutral'];

  for (const archetype of ARCHETYPES) {
    const matchingPolitical = ARCHETYPE_TO_POLITICAL[archetype.id] || [];

    // Get matching personas for this archetype, shuffled for variety
    const matchingPersonas = shuffle(
      personas.filter(p => matchingPolitical.includes(p.political_leaning))
    );

    // Fallback pool: all personas shuffled (for when matching runs out)
    const fallbackPool = shuffle([...personas]);

    for (const sentiment of sentimentTypes) {
      const numComments = sentiment === 'neutral' ? 1 : 3;

      for (let i = 0; i < numComments; i++) {
        let persona: Record<string, any> | null = null;

        // Try matching personas first (never reuse)
        for (const p of matchingPersonas) {
          const pid = p.id || p.name;
          if (!usedIds.has(pid)) {
            persona = p;
            usedIds.add(pid);
            break;
          }
        }

        // If no matching left, use fallback pool (never reuse)
        if (!persona) {
          for (const p of fallbackPool) {
            const pid = p.id || p.name;
            if (!usedIds.has(pid)) {
              persona = p;
              usedIds.add(pid);
              break;
            }
          }
        }

        // If still nothing (shouldn't happen with 2000+ personas), create synthetic
        if (!persona) {
          persona = {
            name: `Persona_${usedIds.size + 1}`,
            age: Math.floor(Math.random() * 50) + 18,
            state: pickRandom(['SP', 'RJ', 'MG', 'BA', 'RS', 'CE', 'PE', 'PA', 'GO', 'PR']),
            region_br: pickRandom(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']),
            generation: pickRandom(['Gen Z', 'Millennial', 'Gen X', 'Boomer']),
            education_level: pickRandom(['Fundamental', 'Médio', 'Superior Incompleto', 'Superior Completo']),
            social_class: pickRandom(['A', 'B1', 'B2', 'C1', 'C2', 'D', 'E']),
            political_leaning: pickRandom(matchingPolitical.length > 0 ? matchingPolitical : ['Centro']),
            macro_religion: pickRandom(['Católico', 'Evangélico', 'Espírita', 'Ateu']),
            gender_identity: pickRandom(['Masculino', 'Feminino']),
            area_type: pickRandom(['Capital/Metrópole', 'Urbana/Interior', 'Rural']),
            civil_status: pickRandom(['Solteiro', 'Casado', 'Divorciado']),
            demographic_json: { identidade_basica: { etnia: pickRandom(['Branco', 'Pardo', 'Negro', 'Amarelo']) } },
            career_json: { atuação_e_cargo: { cargo_atual: pickRandom(['Autônomo', 'Vendedor', 'Motorista', 'Doméstica', 'Empresário', 'Professor']) } },
          };
        }

        result.push(mapPersona(persona, archetype.id, sentiment));
      }
    }
  }

  // Final shuffle so comments don't come in archetype order
  return shuffle(result);
}

/** Generate AI-powered comments via API route, with template fallback */
async function generateAIComments(
  question: string,
  personasForAI: PersonaForAI[],
): Promise<CommentResult[]> {
  console.log(`[AI] Enviando ${personasForAI.length} personas para /api/generate-comments...`);
  try {
    const resp = await fetch('/api/generate-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, personas: personasForAI }),
    });

    console.log(`[AI] Response status: ${resp.status}`);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.fallback) {
        console.warn('[AI] ❌ API indisponível, usando FALLBACK de templates. Motivo:', data.error);
        return generateFallbackComments(personasForAI, question);
      }
      throw new Error(data.error || 'API error');
    }

    const data = await resp.json();
    console.log(`[AI] ✅ ${data.comments?.length || 0} comentários gerados por IA Claude`);
    return data.comments || [];
  } catch (err) {
    console.error('[AI] ❌ Falha total, usando FALLBACK de templates:', err);
    return generateFallbackComments(personasForAI, question);
  }
}

/** Generate OpenAI-powered comments via API route, with template fallback */
async function generateOpenAIComments(
  question: string,
  personasForAI: PersonaForAI[],
): Promise<CommentResult[]> {
  console.log(`[OpenAI] Enviando ${personasForAI.length} personas para /api/generate-comments-openai...`);
  try {
    const resp = await fetch('/api/generate-comments-openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, personas: personasForAI }),
    });

    console.log(`[OpenAI] Response status: ${resp.status}`);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.fallback) {
        console.warn('[OpenAI] API indisponível, usando FALLBACK. Motivo:', data.error);
        return generateFallbackComments(personasForAI, question);
      }
      throw new Error(data.error || 'API error');
    }

    const data = await resp.json();
    console.log(`[OpenAI] ${data.comments?.length || 0} comentários gerados por GPT-4o-mini`);
    return data.comments || [];
  } catch (err) {
    console.error('[OpenAI] Falha total, usando FALLBACK:', err);
    return generateFallbackComments(personasForAI, question);
  }
}

/** Fallback: use template engine if AI is unavailable */
function generateFallbackComments(
  personasForAI: PersonaForAI[],
  question: string,
): CommentResult[] {
  const topicScores = detectTopics(question);
  const dominantTopic = Object.entries(topicScores).reduce(
    (best, [topic, score]) => score > best[1] ? [topic, score] as [string, number] : best,
    ['general', 0] as [string, number],
  )[0];

  return personasForAI.map(p => {
    const ctx: PersonaContext = {
      region: p.region,
      state: p.state,
      generation: p.generation,
      educationLevel: p.educationLevel,
      socialClass: p.socialClass,
      politicalLeaning: p.politicalLeaning,
      religion: p.religion,
      age: p.age,
      gender: 'Masculino',
      areaType: p.areaType,
      archetypeId: p.archetypeId,
      name: p.name,
    };
    const comment = generateComment(ctx, dominantTopic, p.sentiment);
    return {
      archetype: p.archetypeId,
      sentiment: p.sentiment,
      comment,
      personaName: p.name,
      age: p.age,
      location: p.state,
      state: p.state,
      region: p.region,
      generation: p.generation,
    };
  });
}

// ── Custom Hooks ─────────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration: number, enabled: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled) { setValue(0); return; }
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return value;
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function DonutChart({ positive, negative, neutral, size = 200 }: {
  positive: number;
  negative: number;
  neutral: number;
  size?: number;
}) {
  const total = positive + negative + neutral;
  if (total === 0) return null;

  const radius = size / 2 - 24;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const pPos = positive / total;
  const pNeg = negative / total;
  const pNeu = neutral / total;

  const posLen = pPos * circumference;
  const negLen = pNeg * circumference;
  const neuLen = pNeu * circumference;

  const posOff = 0;
  const negOff = posLen;
  const neuOff = posLen + negLen;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={28} />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#10b981" strokeWidth={28}
          strokeDasharray={`${posLen} ${circumference}`} strokeDashoffset={-posOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f43f5e" strokeWidth={28}
          strokeDasharray={`${negLen} ${circumference}`} strokeDashoffset={-negOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f59e0b" strokeWidth={28}
          strokeDasharray={`${neuLen} ${circumference}`} strokeDashoffset={-neuOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-black text-white tabular-nums">{total.toLocaleString('pt-BR')}</p>
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">respostas</p>
      </div>
    </div>
  );
}

function CommentBubble({ comment, index }: { comment: CommentResult; index: number }) {
  const colors = {
    positive: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' },
    negative: { border: 'border-rose-500/20', bg: 'bg-rose-500/5', dot: 'bg-rose-400' },
    neutral: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', dot: 'bg-amber-400' },
  };

  const generationColors: Record<string, string> = {
    'Gen Z': 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
    'Millennial': 'text-violet-400 border-violet-500/20 bg-violet-500/5',
    'Gen X': 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    'Boomer': 'text-red-400 border-red-500/20 bg-red-500/5',
  };

  const c = colors[comment.sentiment];
  const archetype = ARCHETYPES.find(a => a.id === comment.archetype);
  const genColor = generationColors[comment.generation] || 'text-zinc-400 border-zinc-500/20 bg-zinc-500/5';

  return (
    <div
      className={`p-4 rounded-2xl border ${c.border} ${c.bg} transition-all duration-300 hover:scale-[1.02] animate-slide-up-comment`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
        <span className="text-[11px] font-bold text-zinc-400">
          {comment.personaName}, {comment.age}
        </span>
        <span className="text-[10px] text-zinc-600">{comment.location} · {comment.region}</span>
        {archetype && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${archetype.border} ${archetype.text} font-semibold`}>
            {archetype.name}
          </span>
        )}
        {comment.generation && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${genColor}`}>
            {comment.generation}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">
        &ldquo;{comment.comment}&rdquo;
      </p>
    </div>
  );
}

function ArchetypeBar({ archetype, result }: {
  archetype: typeof ARCHETYPES[0];
  result: ArchetypeResult;
}) {
  const pctPositive = result.count > 0 ? Math.round((result.positive / result.count) * 100) : 0;
  const pctNegative = result.count > 0 ? Math.round((result.negative / result.count) * 100) : 0;
  const pctNeutral = result.count > 0 ? Math.round((result.neutral / result.count) * 100) : 0;

  const Icon = archetype.icon;

  return (
    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${archetype.gradient} flex items-center justify-center shrink-0`}>
          <Icon size={16} className={archetype.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{archetype.name}</p>
          <p className="text-[10px] text-zinc-500">{result.count.toLocaleString('pt-BR')} personas</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-emerald-400">{pctPositive}%</p>
          <p className="text-[9px] text-zinc-600">a favor</p>
        </div>
      </div>

      <div className="h-2.5 rounded-full overflow-hidden flex bg-zinc-900/80">
        <div className="h-full bg-emerald-500 transition-all duration-[2000ms] ease-out rounded-l-full" style={{ width: `${pctPositive}%` }} />
        <div className="h-full bg-amber-500 transition-all duration-[2000ms] ease-out" style={{ width: `${pctNeutral}%` }} />
        <div className="h-full bg-rose-500 transition-all duration-[2000ms] ease-out rounded-r-full" style={{ width: `${pctNegative}%` }} />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[9px] font-bold text-emerald-400/80">{pctPositive}% favor</span>
        <span className="text-[9px] font-bold text-amber-400/80">{pctNeutral}% neutro</span>
        <span className="text-[9px] font-bold text-rose-400/80">{pctNegative}% contra</span>
      </div>
    </div>
  );
}

function ProcessingOrb() {
  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      {/* Outer ping rings */}
      <div className="absolute inset-0 rounded-full border border-violet-500/10 arena-radar-pulse" />
      <div className="absolute inset-0 rounded-full border border-fuchsia-500/10 arena-radar-pulse" style={{ animationDelay: '0.7s' }} />
      <div className="absolute inset-0 rounded-full border border-violet-500/5 arena-radar-pulse" style={{ animationDelay: '1.4s' }} />

      {/* Rotating ring */}
      <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-500/60 border-r-fuchsia-500/40 animate-spin" style={{ animationDuration: '2s' }} />

      {/* Inner rotating ring */}
      <div className="absolute inset-6 rounded-full border-2 border-transparent border-b-violet-400/50 border-l-cyan-400/30 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />

      {/* Core glow */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 flex items-center justify-center backdrop-blur-sm border border-violet-500/20">
        <Brain size={30} className="text-violet-400 animate-pulse" />
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function ArenaPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [personaCount, setPersonaCount] = useState(2000);
  const [showComments, setShowComments] = useState(false);
  const [allPersonas, setAllPersonas] = useState<any[]>([]);
  const [openaiComments, setOpenaiComments] = useState<CommentResult[]>([]);
  const [activeModel, setActiveModel] = useState<'claude' | 'openai'>('claude');

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: number[]; targetColor: number[] }[]>([]);
  const animFrameRef = useRef(0);

  // Placeholder rotation
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const placeholders = [
    'Os meninos que bateram o carro devem ser condenados a prisão perpétua?',
    'O Brasil deveria investir mais em energia nuclear?',
    'A reforma tributária vai beneficiar a classe média?',
    'Deveria existir pena de morte no Brasil?',
    'A maconha deveria ser legalizada?',
  ];

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(p => (p + 1) % placeholders.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Fetch real persona count + ALL data (paginated to bypass Supabase 1000-row limit)
  useEffect(() => {
    (async () => {
      const { count } = await supabase.from('personas').select('*', { count: 'exact', head: true });
      if (count && count > 0) setPersonaCount(count);

      // Fetch all rows in batches of 1000
      const batchSize = 1000;
      const total = count || 2000;
      let allData: any[] = [];

      for (let from = 0; from < total; from += batchSize) {
        const { data } = await supabase
          .from('personas')
          .select('*')
          .range(from, from + batchSize - 1);
        if (data && data.length > 0) {
          allData = [...allData, ...data];
        } else {
          break;
        }
      }

      if (allData.length > 0) setAllPersonas(allData);
    })();
  }, []);

  // Animated counters for results
  const animPositive = useAnimatedNumber(simulation?.positive ?? 0, 2500, phase === 'results');
  const animNegative = useAnimatedNumber(simulation?.negative ?? 0, 2500, phase === 'results');
  const animNeutral = useAnimatedNumber(simulation?.neutral ?? 0, 2500, phase === 'results');

  // ── Canvas Particle System ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles (show up to 600 for performance, representing all personas)
    const PARTICLE_COUNT = Math.min(personaCount, 600);
    const particles: typeof particlesRef.current = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (w || 1200),
        y: Math.random() * (h || 800),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.35 + 0.08,
        color: [255, 255, 255],
        targetColor: [255, 255, 255],
      });
    }
    particlesRef.current = particles;

    const draw = () => {
      if (!w || !h) { resize(); }
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Lerp color
        for (let c = 0; c < 3; c++) {
          p.color[c] += (p.targetColor[c] - p.color[c]) * 0.03;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(p.color[0])},${Math.round(p.color[1])},${Math.round(p.color[2])},${p.alpha})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [personaCount]);

  // Update particle colors based on simulation results
  useEffect(() => {
    const particles = particlesRef.current;
    if (!particles.length) return;

    if (phase === 'idle') {
      for (const p of particles) {
        p.targetColor = [255, 255, 255];
        p.alpha = Math.random() * 0.35 + 0.08;
      }
    } else if (simulation && (phase === 'processing' || phase === 'results')) {
      const total = simulation.total;
      const posRatio = simulation.positive / total;
      const negRatio = simulation.negative / total;

      for (let i = 0; i < particles.length; i++) {
        const ratio = i / particles.length;
        if (ratio < posRatio) {
          particles[i].targetColor = [16, 185, 129]; // emerald
        } else if (ratio < posRatio + negRatio) {
          particles[i].targetColor = [244, 63, 94]; // rose
        } else {
          particles[i].targetColor = [245, 158, 11]; // amber
        }
        particles[i].alpha = Math.random() * 0.5 + 0.2;
      }
    }
  }, [phase, simulation]);

  // ── Submit Handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!question.trim()) return;

    const q = question.trim();
    setSubmittedQuestion(q);
    setPhase('processing');
    setProcessedCount(0);
    setSimulation(null);
    setShowComments(false);
    setOpenaiComments([]);
    setActiveModel('claude');

    // 1. Run sync simulation for metrics (instant)
    const metrics = runSimulation(q, personaCount);

    // 2. Build persona list for AI and start generating comments (async)
    const topicScores = detectTopics(q);
    const personasForAI = buildPersonasForAI(q, allPersonas, topicScores);

    // 3. Launch BOTH models in parallel
    const claudePromise = generateAIComments(q, personasForAI);
    const openaiPromise = generateOpenAIComments(q, personasForAI);

    // 4. Animate processing counter while AI generates
    const duration = 4500;
    const startTime = performance.now();
    let metricsRevealed = false;

    const animateProcessing = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setProcessedCount(Math.round(personaCount * eased));

      if (!metricsRevealed && progress >= 0.7) {
        metricsRevealed = true;
        setSimulation({ ...metrics, comments: [] });
      }

      if (progress < 1) {
        requestAnimationFrame(animateProcessing);
      }
    };

    requestAnimationFrame(animateProcessing);

    // 5. Wait for BOTH to arrive
    const [claudeComments, gptComments] = await Promise.all([claudePromise, openaiPromise]);

    // 6. Store OpenAI comments separately
    setOpenaiComments(gptComments);

    // 7. Merge metrics + Claude comments as primary result
    const fullResult: SimulationResult = {
      ...metrics,
      comments: claudeComments,
    };

    setSimulation(fullResult);
    setPhase('results');
    setTimeout(() => setShowComments(true), 800);
  }, [question, personaCount, allPersonas]);

  const handleReset = () => {
    setPhase('idle');
    setSimulation(null);
    setQuestion('');
    setSubmittedQuestion('');
    setProcessedCount(0);
    setShowComments(false);
    setOpenaiComments([]);
    setActiveModel('claude');
  };

  const pct = (n: number) =>
    simulation && simulation.total > 0 ? Math.round((n / simulation.total) * 100) : 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-black text-white font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 relative lg:pl-64 overflow-y-auto overflow-x-hidden">
        {/* Particle canvas background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
          style={{ opacity: phase === 'results' ? 0.25 : 0.5 }}
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-fuchsia-600/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* ── Top Bar ────────────────────────────────────────────────── */}
          <header className="flex items-center justify-between p-4 md:px-8 md:py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors backdrop-blur-sm"
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/20">
                  <Activity size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight leading-none">Pulse Arena</p>
                  <p className="text-[9px] text-zinc-600 font-medium">Análise de sentimento em tempo real</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-zinc-300 tabular-nums">
                  {personaCount.toLocaleString('pt-BR')} personas
                </span>
              </div>
              {phase === 'results' && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                >
                  <RotateCcw size={14} />
                  Nova Pesquisa
                </button>
              )}
            </div>
          </header>

          {/* ══════════════════════════════════════════════════════════════
              IDLE STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'idle' && (
            <div className="min-h-screen flex flex-col items-center px-4 pb-16 pt-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8 animate-fade-in-up">
                <Sparkles size={13} className="text-violet-400" />
                <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">Inteligência Coletiva Sintética</span>
              </div>

              {/* Hero Title */}
              <h1 className="text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-5 leading-[1.05] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                O que{' '}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent arena-gradient-text">
                  {personaCount.toLocaleString('pt-BR')}
                </span>
                <br />
                <span className="text-zinc-400">personas pensam?</span>
              </h1>

              <p className="text-zinc-500 text-sm md:text-base max-w-lg mx-auto text-center mb-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                Digite uma pergunta polêmica, proposta ou declaração e veja instantaneamente como milhares de personas sintéticas reagem em tempo real.
              </p>

              {/* Input */}
              <div className="w-full max-w-2xl mb-14 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-violet-600/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-zinc-950/90 border border-zinc-800 rounded-[2rem] overflow-hidden group-focus-within:border-violet-500/30 transition-all duration-300 backdrop-blur-sm">
                    <textarea
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder={placeholders[placeholderIdx]}
                      rows={3}
                      className="w-full bg-transparent px-6 pt-6 pb-3 text-white placeholder-zinc-600 focus:outline-none resize-none text-base md:text-lg"
                    />
                    <div className="flex items-center justify-between px-5 pb-4">
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Zap size={13} />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Pressione Enter para analisar</span>
                      </div>
                      <button
                        onClick={handleSubmit}
                        disabled={!question.trim()}
                        className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-bold text-sm hover:from-violet-400 hover:to-fuchsia-400 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
                      >
                        Analisar
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 Archetype Cards */}
              <div className="w-full max-w-4xl">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 text-center mb-5">
                  5 Perfis de Personas na Análise
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {ARCHETYPES.map((arch, idx) => {
                    const Icon = arch.icon;
                    const count = Math.round(personaCount * BASE_DISTRIBUTION[idx]);
                    return (
                      <div
                        key={arch.id}
                        className={`group p-4 rounded-2xl bg-zinc-950/70 border ${arch.border} text-center transition-all duration-300 hover:scale-[1.05] hover:bg-zinc-950 animate-fade-in-up backdrop-blur-sm`}
                        style={{ animationDelay: `${400 + idx * 80}ms` }}
                      >
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${arch.gradient} mx-auto mb-2.5 flex items-center justify-center transition-transform group-hover:scale-110`}>
                          <Icon size={18} className={arch.text} />
                        </div>
                        <p className="text-xs font-bold text-white mb-0.5">{arch.name}</p>
                        <p className="text-[9px] text-zinc-500 mb-2 leading-tight">{arch.subtitle}</p>
                        <p className={`text-lg font-black ${arch.text} tabular-nums`}>{count.toLocaleString('pt-BR')}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PROCESSING STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
              {/* Processing Orb */}
              <ProcessingOrb />

              {/* Counter */}
              <p className="text-5xl sm:text-6xl md:text-7xl font-black tabular-nums tracking-tight mt-8 mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {processedCount.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-zinc-500 mb-8">
                de <span className="font-bold text-zinc-300">{personaCount.toLocaleString('pt-BR')}</span> personas analisadas
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-md mb-8">
                <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${(processedCount / personaCount) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-zinc-600">0%</span>
                  <span className="text-[10px] font-bold text-violet-400 tabular-nums">
                    {Math.round((processedCount / personaCount) * 100)}%
                  </span>
                  <span className="text-[10px] text-zinc-600">100%</span>
                </div>
              </div>

              {/* Status messages */}
              <div className="space-y-2 text-center">
                <p className="text-xs text-zinc-600 animate-pulse">
                  {processedCount < personaCount * 0.3
                    ? 'Carregando perfis psicológicos e crenças...'
                    : processedCount < personaCount * 0.6
                      ? 'Analisando valores morais e vieses cognitivos...'
                      : processedCount < personaCount * 0.9
                        ? 'Processando reações emocionais e racionais...'
                        : 'Consolidando resultados finais...'}
                </p>
              </div>

              {/* Submitted question */}
              <div className="mt-10 px-6 py-4 rounded-2xl bg-zinc-950/80 border border-zinc-900 max-w-lg backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Pergunta</p>
                <p className="text-sm text-zinc-300 text-center leading-relaxed">&ldquo;{submittedQuestion}&rdquo;</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              RESULTS STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'results' && simulation && (
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12">
              <div className="max-w-6xl mx-auto">
                {/* Question recap */}
                <div className="mb-8 text-center animate-fade-in-up">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Resultado da Análise</p>
                  <p className="text-lg md:text-xl font-bold text-white max-w-3xl mx-auto leading-relaxed mb-2">
                    &ldquo;{submittedQuestion}&rdquo;
                  </p>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {simulation.total.toLocaleString('pt-BR')} personas
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={11} /> {simulation.processingTime.toFixed(0)}ms
                    </span>
                  </div>
                </div>

                {/* ── Main Stats Grid ──────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                  {/* Donut Chart */}
                  <div className="lg:row-span-2 flex flex-col items-center justify-center p-6 rounded-3xl bg-zinc-950/80 border border-zinc-900 backdrop-blur-sm animate-fade-in-up">
                    <DonutChart
                      positive={animPositive}
                      negative={animNegative}
                      neutral={animNeutral}
                      size={190}
                    />
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-4">
                      Distribuição Geral
                    </p>
                  </div>

                  {/* Stat: Positive */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-emerald-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '100ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-emerald-400 mb-1 tabular-nums">
                      {pct(animPositive)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-1">Concordam</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animPositive.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Stat: Negative */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-rose-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '200ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-rose-400 mb-1 tabular-nums">
                      {pct(animNegative)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/80 mb-1">Discordam</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animNegative.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Stat: Neutral */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-amber-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '300ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-amber-400 mb-1 tabular-nums">
                      {pct(animNeutral)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-1">Neutros</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animNeutral.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Sentiment Bar */}
                  <div className="lg:col-span-3 p-5 rounded-3xl bg-zinc-950/80 border border-zinc-900 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                      Barra de Sentimento
                    </p>
                    <div className="h-7 rounded-full overflow-hidden flex bg-zinc-900">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.positive)}%` }}
                      >
                        {pct(simulation.positive) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.positive)}%</span>
                        )}
                      </div>
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.neutral)}%` }}
                      >
                        {pct(simulation.neutral) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.neutral)}%</span>
                        )}
                      </div>
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.negative)}%` }}
                      >
                        {pct(simulation.negative) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.negative)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Concordam</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Neutros</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Discordam</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Archetype Breakdown ──────────────────────────────── */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <TrendingUp size={14} className="text-zinc-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Análise por Perfil de Persona
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ARCHETYPES.map((arch, idx) => {
                      const result = simulation.archetypes.find(a => a.id === arch.id);
                      if (!result) return null;
                      return (
                        <div key={arch.id} style={{ animationDelay: `${600 + idx * 100}ms` }}>
                          <ArchetypeBar archetype={arch} result={result} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Comments Section with Model Toggle ─────────────── */}
                {showComments && (
                  <div className="mb-8 animate-fade-in-up">
                    {/* Header with Model Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-1">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-zinc-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          Principais Reações
                        </p>
                      </div>

                      {/* Model Toggle */}
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800/50">
                        <button
                          onClick={() => setActiveModel('claude')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                            activeModel === 'claude'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                          }`}
                        >
                          <Sparkles size={13} />
                          Claude
                        </button>
                        <button
                          onClick={() => setActiveModel('openai')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                            activeModel === 'openai'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                          }`}
                        >
                          <Zap size={13} />
                          GPT-4o
                        </button>
                      </div>
                    </div>

                    {/* Active model indicator */}
                    <div className="mb-4 px-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                        activeModel === 'claude'
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeModel === 'claude' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
                        {activeModel === 'claude' ? 'Claude Haiku 4.5' : 'GPT-4o'}
                        {' '}&middot;{' '}
                        {(activeModel === 'claude' ? simulation.comments : openaiComments).length} comentários
                      </span>
                    </div>

                    {/* Comments Grid */}
                    {(() => {
                      const currentComments = activeModel === 'claude' ? simulation.comments : openaiComments;
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* Positive */}
                          <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">A Favor ({pct(simulation.positive)}%)</span>
                            </div>
                            <div className="space-y-3">
                              {currentComments
                                .filter(c => c.sentiment === 'positive')
                                .slice(0, 5)
                                .map((comment, idx) => (
                                  <CommentBubble key={`${activeModel}-pos-${idx}`} comment={comment} index={idx} />
                                ))}
                            </div>
                          </div>

                          {/* Neutral */}
                          <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Neutros ({pct(simulation.neutral)}%)</span>
                            </div>
                            <div className="space-y-3">
                              {currentComments
                                .filter(c => c.sentiment === 'neutral')
                                .slice(0, 5)
                                .map((comment, idx) => (
                                  <CommentBubble key={`${activeModel}-neu-${idx}`} comment={comment} index={idx} />
                                ))}
                            </div>
                          </div>

                          {/* Negative */}
                          <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Contra ({pct(simulation.negative)}%)</span>
                            </div>
                            <div className="space-y-3">
                              {currentComments
                                .filter(c => c.sentiment === 'negative')
                                .slice(0, 5)
                                .map((comment, idx) => (
                                  <CommentBubble key={`${activeModel}-neg-${idx}`} comment={comment} index={idx} />
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── Demographic Profile ────────────────────────────── */}
                {allPersonas.length > 0 && (
                  <DashboardAnalytics personas={allPersonas} />
                )}

                {/* ── Bottom Action ────────────────────────────────────── */}
                <div className="text-center pt-4 pb-8 animate-fade-in-up" style={{ animationDelay: '1200ms' }}>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
                  >
                    <RotateCcw size={16} />
                    Fazer Nova Pesquisa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
