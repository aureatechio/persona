/**
 * Test: Lula vs Bolsonaro comparison substring fix
 *
 * Verifies that "desaprova" no longer matches "aprova",
 * and that comparison questions give inverse results.
 *
 * Run: npx tsx scripts/test-comparison-fix.ts
 */

// Inline the helpers to test independently
function norm(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasAprova(s: string): boolean {
  return s.includes('aprova') && !s.includes('desaprova');
}

function hasDesaprova(s: string): boolean {
  return s.includes('desaprova');
}

// ── Unit tests for hasAprova / hasDesaprova ──

console.log('=== Unit Tests: hasAprova / hasDesaprova ===');
const cases = [
  { input: 'aprova', expectAprova: true, expectDesaprova: false },
  { input: 'Aprova', expectAprova: true, expectDesaprova: false },
  { input: 'desaprova', expectAprova: false, expectDesaprova: true },
  { input: 'Desaprova', expectAprova: false, expectDesaprova: true },
  { input: 'bom', expectAprova: false, expectDesaprova: false },
  { input: 'ruim', expectAprova: false, expectDesaprova: false },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  const n = norm(c.input);
  const gotA = hasAprova(n);
  const gotD = hasDesaprova(n);
  const ok = gotA === c.expectAprova && gotD === c.expectDesaprova;
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL: "${c.input}" → hasAprova=${gotA} (expected ${c.expectAprova}), hasDesaprova=${gotD} (expected ${c.expectDesaprova})`);
  }
}
console.log(`  ${passed}/${passed + failed} passed\n`);

// ── Simulate comparison classification ──

type Sentiment = 'positive' | 'negative' | 'neutral';

interface MockPersona {
  aprovacao_lula: string;
  q_avaliacao_bolsonaro: string;
  voto_2022: string;
  voto_2026: string;
}

function classifyComparison(persona: MockPersona, question: string): Sentiment {
  const normQuestion = norm(question);
  const lulaPos = normQuestion.indexOf('lula');
  const bolsoPos = normQuestion.indexOf('bolsonaro');
  const lulaIsSubject = lulaPos < bolsoPos;

  const voto22 = norm(persona.voto_2022 || '');
  const voto26 = norm(persona.voto_2026 || '');
  const aprovLula = norm(persona.aprovacao_lula || '');
  const avalBolso = norm(persona.q_avaliacao_bolsonaro || '');

  const supportsLula =
    hasAprova(aprovLula) || aprovLula.includes('bom') || aprovLula.includes('otimo') ||
    voto22.includes('lula') || voto26.includes('lula');
  const supportsBolsonaro =
    avalBolso.includes('bom') || avalBolso.includes('otimo') || avalBolso.includes('excelente') ||
    voto22.includes('bolsonaro') || voto26.includes('bolsonaro');

  let stance: Sentiment = 'neutral';
  if (lulaIsSubject) {
    if (supportsLula && !supportsBolsonaro) stance = 'positive';
    else if (supportsBolsonaro && !supportsLula) stance = 'negative';
  } else {
    if (supportsBolsonaro && !supportsLula) stance = 'positive';
    else if (supportsLula && !supportsBolsonaro) stance = 'negative';
  }

  return stance;
}

// Mock dataset: 50% Lula supporters, 50% Bolsonaro supporters
const mockPersonas: MockPersona[] = [];

// 50 Lula supporters (mix of approval types)
for (let i = 0; i < 25; i++) {
  mockPersonas.push({ aprovacao_lula: 'Aprova', q_avaliacao_bolsonaro: 'Ruim', voto_2022: 'Lula', voto_2026: 'Lula' });
}
for (let i = 0; i < 25; i++) {
  mockPersonas.push({ aprovacao_lula: 'Bom', q_avaliacao_bolsonaro: 'Péssimo', voto_2022: 'Lula', voto_2026: '' });
}

// 50 Bolsonaro supporters (mix of approval types)
for (let i = 0; i < 25; i++) {
  mockPersonas.push({ aprovacao_lula: 'Desaprova', q_avaliacao_bolsonaro: 'Bom', voto_2022: 'Bolsonaro', voto_2026: 'Bolsonaro' });
}
for (let i = 0; i < 25; i++) {
  mockPersonas.push({ aprovacao_lula: 'Desaprova', q_avaliacao_bolsonaro: 'Ótimo', voto_2022: 'Bolsonaro', voto_2026: '' });
}

console.log('=== Comparison Simulation (100 personas: 50 Lula, 50 Bolsonaro) ===\n');

for (const question of ['Lula é melhor que Bolsonaro?', 'Bolsonaro é melhor que Lula?']) {
  let pos = 0, neg = 0, neu = 0;
  for (const p of mockPersonas) {
    const s = classifyComparison(p, question);
    if (s === 'positive') pos++;
    else if (s === 'negative') neg++;
    else neu++;
  }
  const total = mockPersonas.length;
  console.log(`  "${question}"`);
  console.log(`    A favor:  ${pos} (${(pos / total * 100).toFixed(0)}%)`);
  console.log(`    Contra:   ${neg} (${(neg / total * 100).toFixed(0)}%)`);
  console.log(`    Neutro:   ${neu} (${(neu / total * 100).toFixed(0)}%)`);
  console.log();
}

// ── Test the OLD buggy behavior for comparison ──
console.log('=== What the OLD code would produce (for reference) ===\n');

function classifyComparisonOLD(persona: MockPersona, question: string): Sentiment {
  const normQuestion = norm(question);
  const lulaPos = normQuestion.indexOf('lula');
  const bolsoPos = normQuestion.indexOf('bolsonaro');
  const lulaIsSubject = lulaPos < bolsoPos;

  const voto22 = norm(persona.voto_2022 || '');
  const voto26 = norm(persona.voto_2026 || '');
  const aprovLula = norm(persona.aprovacao_lula || '');
  const avalBolso = norm(persona.q_avaliacao_bolsonaro || '');

  // BUG: "desaprova".includes("aprova") === true
  const supportsLula =
    aprovLula.includes('aprova') || aprovLula.includes('bom') || aprovLula.includes('otimo') ||
    voto22.includes('lula') || voto26.includes('lula');
  const supportsBolsonaro =
    avalBolso.includes('bom') || avalBolso.includes('otimo') || avalBolso.includes('excelente') ||
    voto22.includes('bolsonaro') || voto26.includes('bolsonaro');

  let stance: Sentiment = 'neutral';
  if (lulaIsSubject) {
    if (supportsLula && !supportsBolsonaro) stance = 'positive';
    else if (supportsBolsonaro && !supportsLula) stance = 'negative';
  } else {
    if (supportsBolsonaro && !supportsLula) stance = 'positive';
    else if (supportsLula && !supportsBolsonaro) stance = 'negative';
  }

  return stance;
}

for (const question of ['Lula é melhor que Bolsonaro?', 'Bolsonaro é melhor que Lula?']) {
  let pos = 0, neg = 0, neu = 0;
  for (const p of mockPersonas) {
    const s = classifyComparisonOLD(p, question);
    if (s === 'positive') pos++;
    else if (s === 'negative') neg++;
    else neu++;
  }
  const total = mockPersonas.length;
  console.log(`  "${question}"`);
  console.log(`    A favor:  ${pos} (${(pos / total * 100).toFixed(0)}%)`);
  console.log(`    Contra:   ${neg} (${(neg / total * 100).toFixed(0)}%)`);
  console.log(`    Neutro:   ${neu} (${(neu / total * 100).toFixed(0)}%)`);
  console.log();
}
