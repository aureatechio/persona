/**
 * Electoral Arena — Client-side simulation fallback.
 * Used when the Python backend is unavailable.
 * Simulates voting based on 2D ideological scores.
 */

import type {
  PersonaVote,
  RoundResult,
  ClusterVoteResult,
  RegionVoteResult,
  GenerationVoteResult,
  QuadrantVoteResult,
  CriticismCategory,
  CriticismBehavioralProfile,
  CounterProposal,
  VoterShift,
  Politician,
} from './types';

// ── Cluster mapping ──────────────────────────────────────────────────────────

const CLUSTER_MACROS: Record<string, string> = {
  P1: 'Progressista', P2: 'Progressista', P3: 'Progressista',
  P4: 'Progressista', P5: 'Progressista', P6: 'Progressista',
  M1: 'Moderado', M2: 'Moderado', M3: 'Moderado', M4: 'Moderado',
  M5: 'Moderado', M6: 'Moderado', M7: 'Moderado', M8: 'Moderado',
  C1: 'Conservador', C2: 'Conservador', C3: 'Conservador',
  C4: 'Conservador', C5: 'Conservador', C6: 'Conservador',
  C7: 'Conservador', C8: 'Conservador',
  T1: 'Transversal', T2: 'Transversal',
};

const CLUSTER_NAMES: Record<string, string> = {
  P1: 'Base Social', P2: 'Trabalhista', P3: 'Progressista Urbano',
  P4: 'Regulador Técnico', P5: 'Desenvolvimentista', P6: 'Centro-Esquerda Moderada',
  M1: 'Centro Econômico', M2: 'Centro Conservador', M3: 'Institucional',
  M4: 'Gestor Pragmático', M5: 'Volátil Econômico', M6: 'Empreendedor Urbano',
  M7: 'Classe Média Sensível', M8: 'Cético Político',
  C1: 'Liberal de Mercado', C2: 'Conservador Religioso', C3: 'Nacionalista',
  C4: 'Linha Dura Segurança', C5: 'Antissistema', C6: 'Pequeno Empresário',
  C7: 'Direita Digital', C8: 'Conservador Tradicional',
  T1: 'Desengajado', T2: 'Anti-Incumbente',
};

const QUADRANT_LABELS: Record<string, string> = {
  esq_progressista: 'Esquerda + Progressista',
  esq_conservador: 'Esquerda + Conservador',
  dir_conservador: 'Direita + Conservador',
  dir_progressista: 'Direita + Progressista',
};

// ── Leaning to score mapping ─────────────────────────────────────────────────

const LEANING_SCORE: Record<string, number> = {
  esquerda: -0.7,
  'centro-esquerda': -0.35,
  centro: 0,
  'centro-direita': 0.35,
  direita: 0.7,
};

// ── Criticism templates ──────────────────────────────────────────────────────

const CRITICISM_TEMPLATES: Record<string, string[]> = {
  esquerda: [
    'corrupcao do partido',
    'aliancas com centrao',
    'promessas nao cumpridas',
    'economia ruim',
    'inflacao alta',
    'muito assistencialismo',
    'nao fez reforma tributaria',
    'pouca seguranca publica',
  ],
  'centro-esquerda': [
    'falta de posicionamento claro',
    'muita alianca pragmatica',
    'economia estagnada',
    'corrupcao no partido',
    'pouco foco em seguranca',
  ],
  centro: [
    'falta de lideranca forte',
    'muita indecisao',
    'nao resolve nada concreto',
    'fica em cima do muro',
  ],
  'centro-direita': [
    'nao privatizou o suficiente',
    'fala demais e faz pouco',
    'comunicacao ruim',
    'aliancas questionaveis',
    'pouca reforma economica',
  ],
  direita: [
    'fala muita besteira',
    'comunicacao agressiva demais',
    'gestao ambiental pessima',
    'briga com STF desnecessaria',
    'nao privatizou nada',
    'desmatamento',
    'isolamento internacional',
    'negacionismo',
  ],
};

// ── Key Objection Templates (per criticism) ──────────────────────────────────

const OBJECTION_TEMPLATES: Record<string, string> = {
  'corrupcao do partido': 'O partido fala em combater corrupção mas não explica os escândalos próprios',
  'aliancas com centrao': 'Prometeu mudança mas fez aliança com os mesmos políticos de sempre',
  'promessas nao cumpridas': 'A população ainda espera pelas promessas feitas na campanha',
  'economia ruim': 'O custo de vida subiu e o salário não acompanhou',
  'inflacao alta': 'O preço dos alimentos e combustível continua insustentável',
  'muito assistencialismo': 'Gasta demais com programas sociais e pouco com infraestrutura',
  'nao fez reforma tributaria': 'A reforma tributária é urgente mas segue emperrada',
  'pouca seguranca publica': 'A violência continua alta e o governo não apresenta soluções',
  'falta de posicionamento claro': 'Não tem coragem de defender uma posição firme em temas polêmicos',
  'muita alianca pragmatica': 'Negocia com qualquer partido para se manter no poder',
  'economia estagnada': 'A economia não cresce e o desemprego continua alto',
  'corrupcao no partido': 'O partido tem histórico de envolvimento em escândalos',
  'pouco foco em seguranca': 'Ignora a crise de segurança pública que afeta a população',
  'falta de lideranca forte': 'Não demonstra capacidade de tomar decisões difíceis',
  'muita indecisao': 'Demora demais para se posicionar em crises',
  'nao resolve nada concreto': 'Muito discurso e pouca entrega de resultados',
  'fica em cima do muro': 'Tenta agradar todos os lados e não agrada ninguém',
  'nao privatizou o suficiente': 'Prometeu reduzir o estado mas manteve estatais ineficientes',
  'fala demais e faz pouco': 'As promessas não se traduzem em ações concretas',
  'comunicacao ruim': 'Não consegue comunicar suas conquistas para a população',
  'aliancas questionaveis': 'Se aliou a figuras políticas que contradizem seu discurso',
  'pouca reforma economica': 'As reformas necessárias continuam travadas no congresso',
  'fala muita besteira': 'Declarações polêmicas prejudicam a imagem do país',
  'comunicacao agressiva demais': 'O tom agressivo afasta moderados e prejudica o diálogo',
  'gestao ambiental pessima': 'O desmatamento e a crise ambiental pioraram significativamente',
  'briga com STF desnecessaria': 'Conflitos institucionais desnecessários enfraquecem a democracia',
  'nao privatizou nada': 'O discurso liberal não se traduziu em privatizações reais',
  'desmatamento': 'O avanço do desmatamento prejudica a imagem internacional do Brasil',
  'isolamento internacional': 'O Brasil perdeu relevância e parcerias no cenário global',
  'negacionismo': 'Posições anticientíficas custaram vidas e credibilidade',
};

// ── Behavioral Profile Templates ─────────────────────────────────────────────

const RELIGION_PROFILES: Record<string, string> = {
  Evangélica: 'Evangélicos praticantes',
  Católica: 'Católicos tradicionais',
  'Sem religião': 'Sem religião declarada',
  Espírita: 'Espíritas e espiritualistas',
};

const EDUCATION_PROFILES: Record<string, string> = {
  'Ensino Fundamental': 'Ensino Fundamental',
  'Ensino Médio': 'Ensino Médio completo',
  'Ensino Superior': 'Ensino Superior',
  'Pós-Graduação': 'Pós-graduados',
};

// ── Leaning Strategies (for proposals) ───────────────────────────────────────

const LEANING_STRATEGIES: Record<string, {
  approaches: string[];
  messageTemplates: string[];
  riskTemplates: string[];
  fitPrefix: string;
}> = {
  esquerda: {
    approaches: [
      'Ampliar programas sociais focados em',
      'Propor regulação estatal mais transparente para',
      'Criar comitê popular de fiscalização sobre',
      'Fortalecer políticas públicas universais em',
    ],
    messageTemplates: [
      'O povo precisa de um governo que cuide de verdade:',
      'Ninguém vai ficar para trás — vamos enfrentar',
      'Direito social não é favor, é obrigação do Estado:',
      'Trabalho, renda e dignidade para resolver',
    ],
    riskTemplates: [
      'Pode ser visto como aumento de gastos públicos, afastando eleitores de centro preocupados com responsabilidade fiscal',
      'Risco de ser percebido como "mais do mesmo" se não houver diferenciação clara das propostas atuais do governo',
      'Pode alienar setores empresariais e classe média alta que temem aumento de impostos',
    ],
    fitPrefix: 'Coerente com o posicionamento de esquerda',
  },
  'centro-esquerda': {
    approaches: [
      'Propor parceria público-privada para resolver',
      'Reformar mecanismos existentes para melhorar',
      'Criar programa de incentivo focado em',
      'Modernizar a legislação sobre',
    ],
    messageTemplates: [
      'Desenvolvimento com responsabilidade social:',
      'Modernizar sem abandonar quem precisa:',
      'Equilíbrio entre crescimento e inclusão:',
      'Reforma inteligente para resolver',
    ],
    riskTemplates: [
      'Pode desagradar tanto a esquerda radical quanto a direita liberal por parecer "em cima do muro"',
      'Risco de diluir identidade ideológica ao tentar agradar muitos públicos simultaneamente',
      'Pode ser percebido como insuficientemente ambicioso pela base mais à esquerda',
    ],
    fitPrefix: 'Alinhado com o posicionamento de centro-esquerda',
  },
  centro: {
    approaches: [
      'Propor reforma técnica e apartidária para',
      'Criar mesa de diálogo multipartidária sobre',
      'Implementar solução baseada em evidências para',
      'Buscar consenso institucional sobre',
    ],
    messageTemplates: [
      'Chega de polarização — vamos resolver com competência:',
      'Nem esquerda nem direita, solução técnica para',
      'Gestão eficiente e diálogo para resolver',
      'Resultado concreto sem ideologia:',
    ],
    riskTemplates: [
      'Pode ser percebido como fraco ou indeciso por eleitores que querem posicionamento firme',
      'Risco de não mobilizar paixão suficiente para reverter votos já consolidados em candidatos mais carismáticos',
      'O discurso técnico pode soar distante da realidade cotidiana dos eleitores mais humildes',
    ],
    fitPrefix: 'Coerente com o posicionamento de centro',
  },
  'centro-direita': {
    approaches: [
      'Reduzir burocracia e simplificar processos para',
      'Propor parceria público-privada eficiente para',
      'Criar incentivo fiscal para o setor privado resolver',
      'Descentralizar a gestão de',
    ],
    messageTemplates: [
      'Menos Estado, mais eficiência:',
      'O setor privado pode ajudar a resolver:',
      'Desburocratizar para destravar',
      'Eficiência e resultado concreto em',
    ],
    riskTemplates: [
      'Pode alienar trabalhadores e classes mais baixas que dependem de serviços públicos robustos',
      'Risco de parecer elitista ou desconectado das necessidades populares em regiões mais carentes',
      'Pode afastar eleitores moderados que esperam papel ativo do governo em questões sociais',
    ],
    fitPrefix: 'Alinhado com o posicionamento de centro-direita',
  },
  direita: {
    approaches: [
      'Propor privatização ou concessão para resolver',
      'Endurecer legislação e fiscalização sobre',
      'Reduzir impostos e encargos relacionados a',
      'Fortalecer segurança e ordem para combater',
    ],
    messageTemplates: [
      'Ordem, segurança e progresso para resolver:',
      'O mercado livre é o melhor caminho para',
      'Chega de gastar errado — eficiência e resultado em',
      'Liberdade econômica e responsabilidade para',
    ],
    riskTemplates: [
      'Pode ser visto como insensível socialmente, afastando moderados e indecisos que valorizam políticas sociais',
      'Risco de alienar setores que dependem de investimento público e regulação na área',
      'Pode reforçar imagem de governo para ricos, prejudicando adesão nas classes C e D',
    ],
    fitPrefix: 'Coerente com o posicionamento de direita',
  },
};

// ── Simulate Vote ────────────────────────────────────────────────────────────

function simulateVote(
  persona: any,
  candidateA: Politician,
  candidateB: Politician,
): { vote: 'candidateA' | 'candidateB' | 'abstain'; confidence: number; criticisms: string[] } {
  const scoreEco = parseFloat(persona.score_economico) || 0;
  const clusterId = persona.cluster_id || '';

  const leaningA = LEANING_SCORE[candidateA.leaning || 'centro'] || 0;
  const leaningB = LEANING_SCORE[candidateB.leaning || 'centro'] || 0;

  const affinityA = 1 - Math.abs(scoreEco - leaningA);
  const affinityB = 1 - Math.abs(scoreEco - leaningB);

  const noise = (Math.random() - 0.5) * 0.3;
  const finalA = affinityA + noise;
  const finalB = affinityB + noise * -1;

  if (clusterId === 'T1' && Math.random() < 0.6) {
    const crits = [
      ...(CRITICISM_TEMPLATES[candidateA.leaning || 'centro'] || []).slice(0, 1),
      ...(CRITICISM_TEMPLATES[candidateB.leaning || 'centro'] || []).slice(0, 1),
    ];
    return { vote: 'abstain', confidence: 0.2, criticisms: crits };
  }

  if (Math.abs(finalA - finalB) < 0.15 && Math.random() < 0.3) {
    return { vote: 'abstain', confidence: 0.25, criticisms: ['todos iguais'] };
  }

  const vote = finalA > finalB ? 'candidateA' : 'candidateB';
  const confidence = Math.min(1, Math.abs(finalA - finalB) * 1.5 + 0.2);

  const winnerLeaning = vote === 'candidateA' ? candidateA.leaning : candidateB.leaning;
  const templates = CRITICISM_TEMPLATES[winnerLeaning || 'centro'] || CRITICISM_TEMPLATES.centro;
  const numCriticisms = confidence > 0.7 ? 1 : confidence > 0.4 ? 2 : 3;
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  const criticisms = shuffled.slice(0, numCriticisms);

  return { vote, confidence, criticisms };
}

// ── Main Simulation ──────────────────────────────────────────────────────────

export function runElectoralSimulation(
  personas: any[],
  candidateA: Politician,
  candidateB: Politician,
  roundNumber: number,
  proposals?: CounterProposal[],
  previousVotes?: Record<string, string>,
): {
  result: RoundResult;
  shifts: VoterShift[];
} {
  const startTime = performance.now();
  const votes: PersonaVote[] = [];
  const shifts: VoterShift[] = [];

  const clusterAgg: Record<string, { total: number; votesA: number; votesB: number; abstentions: number }> = {};
  const regionAgg: Record<string, { total: number; votesA: number; votesB: number; abstentions: number }> = {};
  const genAgg: Record<string, { total: number; votesA: number; votesB: number; abstentions: number; totalAge: number }> = {};
  const quadrantAgg: Record<string, { total: number; votesA: number; votesB: number; abstentions: number }> = {};

  let totalA = 0;
  let totalB = 0;
  let totalAbs = 0;

  const enabledProposals = proposals?.filter((p) => p.enabled) || [];
  const proposalClusters = new Set(enabledProposals.flatMap((p) => p.targetClusters));

  for (const persona of personas) {
    const pid = String(persona.id || persona.name || '');
    const { vote: rawVote, confidence, criticisms } = simulateVote(persona, candidateA, candidateB);

    let vote = rawVote;

    if (roundNumber > 1 && previousVotes && enabledProposals.length > 0) {
      const prevVote = previousVotes[pid];
      const clusterId = persona.cluster_id || '';

      if (prevVote && proposalClusters.has(clusterId) && Math.random() < 0.12) {
        if (prevVote === 'candidateA') vote = 'candidateB';
        else if (prevVote === 'candidateB') vote = 'candidateA';
        else vote = rawVote;
      }
    }

    if (roundNumber > 1 && previousVotes) {
      const prev = previousVotes[pid];
      if (prev && prev !== vote) {
        shifts.push({
          personaId: pid,
          personaName: persona.name || 'Anônimo',
          age: persona.age || 0,
          state: persona.state || '',
          clusterId: persona.cluster_id || '',
          clusterName: persona.nome_grupo || '',
          generation: persona.generation || '',
          previousVote: prev as any,
          newVote: vote,
          reason: `Influenciado pelas novas propostas de ${vote === 'candidateA' ? candidateA.name : candidateB.name}`,
        });
      }
    }

    if (vote === 'candidateA') totalA++;
    else if (vote === 'candidateB') totalB++;
    else totalAbs++;

    const scoreEco = parseFloat(persona.score_economico) || 0;
    const scoreCost = parseFloat(persona.score_costumes) || 0;
    const clusterId = persona.cluster_id || 'unknown';
    const region = persona.region_br || 'Não informado';
    const gen = persona.generation || 'Não informado';

    if (!clusterAgg[clusterId]) clusterAgg[clusterId] = { total: 0, votesA: 0, votesB: 0, abstentions: 0 };
    clusterAgg[clusterId].total++;
    if (vote === 'candidateA') clusterAgg[clusterId].votesA++;
    else if (vote === 'candidateB') clusterAgg[clusterId].votesB++;
    else clusterAgg[clusterId].abstentions++;

    if (!regionAgg[region]) regionAgg[region] = { total: 0, votesA: 0, votesB: 0, abstentions: 0 };
    regionAgg[region].total++;
    if (vote === 'candidateA') regionAgg[region].votesA++;
    else if (vote === 'candidateB') regionAgg[region].votesB++;
    else regionAgg[region].abstentions++;

    if (!genAgg[gen]) genAgg[gen] = { total: 0, votesA: 0, votesB: 0, abstentions: 0, totalAge: 0 };
    genAgg[gen].total++;
    genAgg[gen].totalAge += persona.age || 0;
    if (vote === 'candidateA') genAgg[gen].votesA++;
    else if (vote === 'candidateB') genAgg[gen].votesB++;
    else genAgg[gen].abstentions++;

    const q = scoreEco <= 0
      ? (scoreCost <= 0 ? 'esq_progressista' : 'esq_conservador')
      : (scoreCost > 0 ? 'dir_conservador' : 'dir_progressista');
    if (!quadrantAgg[q]) quadrantAgg[q] = { total: 0, votesA: 0, votesB: 0, abstentions: 0 };
    quadrantAgg[q].total++;
    if (vote === 'candidateA') quadrantAgg[q].votesA++;
    else if (vote === 'candidateB') quadrantAgg[q].votesB++;
    else quadrantAgg[q].abstentions++;

    votes.push({
      personaId: pid,
      personaName: persona.name || 'Anônimo',
      age: persona.age || 0,
      state: persona.state || '',
      region,
      generation: gen,
      educationLevel: persona.education_level || '',
      clusterId,
      clusterName: persona.nome_grupo || CLUSTER_NAMES[clusterId] || clusterId,
      scoreEco,
      scoreCost,
      politicalLeaning: persona.political_leaning || '',
      vote,
      confidence,
      comment: '',
      criticisms,
    });
  }

  const effective = totalA + totalB;
  const byCluster: ClusterVoteResult[] = Object.entries(clusterAgg)
    .map(([id, d]) => ({ clusterId: id, clusterName: CLUSTER_NAMES[id] || id, macro: (CLUSTER_MACROS[id] || 'Transversal') as any, ...d }))
    .sort((a, b) => a.clusterId.localeCompare(b.clusterId));

  const byRegion: RegionVoteResult[] = Object.entries(regionAgg)
    .map(([region, d]) => ({ region, ...d }))
    .sort((a, b) => b.total - a.total);

  const byGeneration: GenerationVoteResult[] = Object.entries(genAgg)
    .map(([gen, d]) => ({ generation: gen, total: d.total, votesA: d.votesA, votesB: d.votesB, abstentions: d.abstentions, avgAge: d.total > 0 ? Math.round(d.totalAge / d.total) : 0 }));

  const byQuadrant: QuadrantVoteResult[] = Object.entries(quadrantAgg)
    .map(([q, d]) => ({ quadrant: q, label: QUADRANT_LABELS[q] || q, ...d }));

  const result: RoundResult = {
    roundNumber,
    totalVoters: personas.length,
    votesA: totalA,
    votesB: totalB,
    abstentions: totalAbs,
    percentA: effective > 0 ? Math.round((totalA / effective) * 1000) / 10 : 0,
    percentB: effective > 0 ? Math.round((totalB / effective) * 1000) / 10 : 0,
    votes,
    byCluster,
    byRegion,
    byGeneration,
    byQuadrant,
    winner: totalA > totalB ? 'candidateA' : totalB > totalA ? 'candidateB' : 'tie',
    processingTime: performance.now() - startTime,
  };

  return { result, shifts };
}

// ── Extract Criticisms (client-side with behavioral data) ────────────────────

function getMostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) if (v) counts[v] = (counts[v] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'Não informado';
}

function getAgeRange(ages: number[]): string {
  if (ages.length === 0) return 'Variada';
  const sorted = ages.filter(Boolean).sort((a, b) => a - b);
  if (sorted.length === 0) return 'Variada';
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return `${p25}-${p75} anos`;
}

function getTopWithPercent(arr: string[], total: number): string {
  const counts: Record<string, number> = {};
  for (const v of arr) if (v) counts[v] = (counts[v] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 'Não informado';
  const pct = Math.round((sorted[0][1] / total) * 100);
  return `${sorted[0][0]} (${pct}%)`;
}

export function extractCriticisms(
  result: RoundResult,
  winnerSide: 'candidateA' | 'candidateB',
  allPersonas?: any[],
): CriticismCategory[] {
  const winnerVotes = result.votes.filter((v) => v.vote === winnerSide);
  const allCriticisms: string[] = [];
  const criticismPersonas: Record<string, string[]> = {}; // criticism → personaIds

  for (const vote of winnerVotes) {
    if (vote.criticisms) {
      for (const crit of vote.criticisms) {
        allCriticisms.push(crit);
        if (!criticismPersonas[crit]) criticismPersonas[crit] = [];
        criticismPersonas[crit].push(vote.personaId);
      }
    }
  }

  // Count occurrences
  const counts: Record<string, number> = {};
  for (const c of allCriticisms) counts[c] = (counts[c] || 0) + 1;

  // Build persona lookup for behavioral data
  const personaMap = new Map<string, any>();
  if (allPersonas) {
    for (const p of allPersonas) {
      personaMap.set(String(p.id || p.name || ''), p);
    }
  }

  // Group into categories
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const categories: CriticismCategory[] = sorted.slice(0, 8).map(([crit, count]) => {
    const personaIds = criticismPersonas[crit] || [];

    // Get affected clusters
    const clusterCounts: Record<string, number> = {};
    const ages: number[] = [];
    const regions: string[] = [];
    const educations: string[] = [];
    const religions: string[] = [];
    const socialClasses: string[] = [];

    for (const pid of personaIds) {
      const persona = personaMap.get(pid);
      if (persona) {
        const cid = persona.cluster_id || '';
        if (cid) clusterCounts[cid] = (clusterCounts[cid] || 0) + 1;
        if (persona.age) ages.push(persona.age);
        if (persona.region_br) regions.push(persona.region_br);
        if (persona.education_level) educations.push(persona.education_level);
        if (persona.macro_religion) religions.push(persona.macro_religion);
        if (persona.social_class) socialClasses.push(persona.social_class);
      } else {
        // Use vote data as fallback
        const voteData = winnerVotes.find((v) => v.personaId === pid);
        if (voteData) {
          if (voteData.clusterId) clusterCounts[voteData.clusterId] = (clusterCounts[voteData.clusterId] || 0) + 1;
          if (voteData.age) ages.push(voteData.age);
          if (voteData.region) regions.push(voteData.region);
          if (voteData.educationLevel) educations.push(voteData.educationLevel);
        }
      }
    }

    const affectedClusters = Object.entries(clusterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // Build behavioral profiles
    const behavioralProfiles: CriticismBehavioralProfile[] = [];
    const total = personaIds.length || 1;

    // Religion profile
    if (religions.length > 0) {
      const relCounts: Record<string, number> = {};
      for (const r of religions) relCounts[r] = (relCounts[r] || 0) + 1;
      const topRel = Object.entries(relCounts).sort((a, b) => b[1] - a[1])[0];
      if (topRel) {
        const pct = Math.round((topRel[1] / total) * 100);
        const label = RELIGION_PROFILES[topRel[0]] || topRel[0];
        behavioralProfiles.push({
          label: `${label} (${pct}%)`,
          percentage: pct,
          insight: `Criticam influenciados por valores ${topRel[0] === 'Evangélica' ? 'religiosos e morais' : topRel[0] === 'Sem religião' ? 'seculares e pragmáticos' : 'tradicionais'}`,
        });
      }
    }

    // Education profile
    if (educations.length > 0) {
      const eduCounts: Record<string, number> = {};
      for (const e of educations) eduCounts[e] = (eduCounts[e] || 0) + 1;
      const topEdu = Object.entries(eduCounts).sort((a, b) => b[1] - a[1])[0];
      if (topEdu) {
        const pct = Math.round((topEdu[1] / total) * 100);
        const label = EDUCATION_PROFILES[topEdu[0]] || topEdu[0];
        behavioralProfiles.push({
          label: `${label} (${pct}%)`,
          percentage: pct,
          insight: topEdu[0].includes('Superior') || topEdu[0].includes('Pós')
            ? 'Elaboram críticas com base em dados e argumentos técnicos'
            : 'Expressam insatisfação de forma direta e emocional',
        });
      }
    }

    // Social class profile
    if (socialClasses.length > 0) {
      const classCounts: Record<string, number> = {};
      for (const sc of socialClasses) classCounts[sc] = (classCounts[sc] || 0) + 1;
      const topClass = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0];
      if (topClass) {
        const pct = Math.round((topClass[1] / total) * 100);
        behavioralProfiles.push({
          label: `${topClass[0]} (${pct}%)`,
          percentage: pct,
          insight: topClass[0].includes('A') || topClass[0].includes('B')
            ? 'Focam em eficiência econômica e retorno sobre impostos'
            : 'Preocupados com custo de vida e acesso a serviços básicos',
        });
      }
    }

    // Generation/age profile
    if (ages.length > 0) {
      const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
      const young = ages.filter((a) => a < 35).length;
      const middle = ages.filter((a) => a >= 35 && a < 55).length;
      const senior = ages.filter((a) => a >= 55).length;
      const dominant = young > middle && young > senior ? 'Jovens (< 35 anos)' : middle > senior ? 'Adultos (35-55 anos)' : 'Seniores (55+ anos)';
      const dominantPct = Math.round((Math.max(young, middle, senior) / total) * 100);
      behavioralProfiles.push({
        label: `${dominant} (${dominantPct}%)`,
        percentage: dominantPct,
        insight: avgAge < 35 ? 'Influenciados por redes sociais e conteúdo digital' : avgAge < 55 ? 'Priorizam estabilidade econômica e emprego' : 'Valorizam experiência política e estabilidade institucional',
      });
    }

    // If no personas available, generate generic profiles
    if (behavioralProfiles.length === 0) {
      behavioralProfiles.push(
        { label: 'Classe média urbana', percentage: 35, insight: 'Exigem transparência e eficiência do governo' },
        { label: 'Jovens digitais 18-35', percentage: 28, insight: 'Viram denúncias e debates nas redes sociais' },
        { label: 'Trabalhadores formais', percentage: 22, insight: 'Sentem o impacto direto na renda e no emprego' },
      );
    }

    const dominantRegion = regions.length > 0 ? getMostCommon(regions) : 'Variada';
    const dominantEducation = educations.length > 0 ? getMostCommon(educations) : 'Variada';
    const dominantSocialClass = socialClasses.length > 0 ? getMostCommon(socialClasses) : 'Variada';
    const dominantReligion = religions.length > 0 ? getTopWithPercent(religions, total) : 'Variada';

    // Determine media pattern from cluster
    const topClusterMacro = affectedClusters.length > 0 ? CLUSTER_MACROS[affectedClusters[0]] : '';
    const mediaPattern = topClusterMacro === 'Progressista'
      ? 'Alto consumo de redes sociais e portais de notícias independentes'
      : topClusterMacro === 'Conservador'
        ? 'Consumo de TV tradicional, WhatsApp e YouTube'
        : topClusterMacro === 'Transversal'
          ? 'Baixo consumo geral de mídia política'
          : 'Consumo misto de redes sociais e TV';

    const psychologicalTrait = count > allCriticisms.length * 0.2
      ? 'Alta conscienciosidade — exigem accountability e transparência de seus representantes'
      : count > allCriticisms.length * 0.1
        ? 'Moderada abertura a mudança — dispostos a trocar de candidato se virem alternativa viável'
        : 'Crítica pontual — leais ao candidato mas com ressalvas específicas';

    return {
      category: crit.charAt(0).toUpperCase() + crit.slice(1).replace(/_/g, ' '),
      description: `${count} eleitores mencionaram: "${crit}"`,
      voterCount: count,
      sampleComments: [],
      affectedClusters,
      severity: count > allCriticisms.length * 0.2 ? 'high' : count > allCriticisms.length * 0.1 ? 'medium' : 'low',
      behavioralProfiles,
      dominantAge: getAgeRange(ages),
      dominantRegion,
      dominantEducation,
      dominantSocialClass,
      dominantReligion,
      mediaPattern,
      psychologicalTrait,
      keyObjection: OBJECTION_TEMPLATES[crit] || `Eleitores insatisfeitos com a questão de "${crit}" buscam alternativa`,
    };
  });

  return categories;
}

// ── Generate Proposals (client-side, ideology-aware) ─────────────────────────

export function generateProposals(
  criticisms: CriticismCategory[],
  loser: Politician,
  winner: Politician,
  margin: number,
): CounterProposal[] {
  const leaning = loser.leaning || 'centro';
  const strategy = LEANING_STRATEGIES[leaning] || LEANING_STRATEGIES.centro;

  return criticisms.map((c, i) => {
    const approach = strategy.approaches[i % strategy.approaches.length];
    const message = strategy.messageTemplates[i % strategy.messageTemplates.length];
    const risk = strategy.riskTemplates[i % strategy.riskTemplates.length];
    const category = c.category.toLowerCase();

    return {
      id: `proposal_${i + 1}`,
      targetCriticism: c.category,
      title: `Contra-proposta: ${c.category}`,
      description: `${loser.name} (${loser.party || '?'}) propõe medidas concretas para resolver a questão de "${category}" que ${c.voterCount} eleitores de ${winner.name} criticam. A proposta é coerente com o posicionamento ${leaning} do ${loser.party || 'partido'}.`,
      expectedImpact: `Pode atrair eleitores insatisfeitos dos clusters ${c.affectedClusters.join(', ')}, especialmente aqueles com confiança média-baixa no voto atual.`,
      targetClusters: c.affectedClusters,
      estimatedFlip: Math.max(1, Math.round(c.voterCount * 0.1)),
      enabled: true,
      strategicRationale: `A crítica "${category}" revela uma fraqueza explorada por ${c.voterCount} eleitores do próprio ${winner.name}. ${loser.name} pode capturar essa insatisfação propondo uma abordagem coerente com sua base ideológica de ${leaning}, diferenciando-se do ${winner.name} nesse ponto específico. A severidade ${c.severity === 'high' ? 'alta' : c.severity === 'medium' ? 'média' : 'baixa'} desta crítica indica ${c.severity === 'high' ? 'grande' : 'moderado'} potencial de virada.`,
      actionPlan: [
        { step: 1, action: `${approach} "${category}"`, timeline: 'Primeiros 30 dias' },
        { step: 2, action: `Anunciar plano detalhado em evento público focado nos clusters ${c.affectedClusters.slice(0, 2).join(' e ')}`, timeline: '30-60 dias' },
        { step: 3, action: `Campanha direcionada nas redes sociais para eleitores insatisfeitos com ${winner.name} nesta questão`, timeline: 'Contínuo' },
      ],
      voterMessage: `${message} ${category}. ${loser.name} tem um plano real para isso.`,
      ideologicalFit: `${strategy.fitPrefix} do ${loser.party || 'partido'}. Esta proposta não contradiz a base ideológica do candidato e pode ser apresentada de forma autêntica.`,
      risk,
      affectedDemographics: `Eleitores dos clusters ${c.affectedClusters.join(', ')} — ${c.dominantAge || 'faixa etária variada'}, ${c.dominantSocialClass || 'diversas classes'}, ${c.dominantRegion || 'diversas regiões'}.`,
    };
  });
}
