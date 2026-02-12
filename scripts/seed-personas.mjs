/**
 * Seed 39 diverse personas into Supabase
 * Run: node scripts/seed-personas.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sobfplitrzgggzqsycew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA'
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(1);

// ── Data Pools ───────────────────────────────────────────────────────────────
const CITIES = [
  // ── Norte (7 UFs) ──
  { city: 'Manaus', state: 'AM', region: 'Norte', lat: -3.12, lng: -60.02, area: 'Capital/Metrópole' },
  { city: 'Belém', state: 'PA', region: 'Norte', lat: -1.46, lng: -48.50, area: 'Capital/Metrópole' },
  { city: 'Rio Branco', state: 'AC', region: 'Norte', lat: -9.97, lng: -67.81, area: 'Urbana/Interior' },
  { city: 'Macapá', state: 'AP', region: 'Norte', lat: 0.03, lng: -51.05, area: 'Urbana/Interior' },
  { city: 'Porto Velho', state: 'RO', region: 'Norte', lat: -8.76, lng: -63.90, area: 'Urbana/Interior' },
  { city: 'Boa Vista', state: 'RR', region: 'Norte', lat: 2.82, lng: -60.67, area: 'Urbana/Interior' },
  { city: 'Palmas', state: 'TO', region: 'Norte', lat: -10.18, lng: -48.33, area: 'Urbana/Interior' },
  // ── Nordeste (9 UFs) ──
  { city: 'Salvador', state: 'BA', region: 'Nordeste', lat: -12.97, lng: -38.51, area: 'Capital/Metrópole' },
  { city: 'Fortaleza', state: 'CE', region: 'Nordeste', lat: -3.72, lng: -38.53, area: 'Capital/Metrópole' },
  { city: 'Recife', state: 'PE', region: 'Nordeste', lat: -8.05, lng: -34.87, area: 'Capital/Metrópole' },
  { city: 'São Luís', state: 'MA', region: 'Nordeste', lat: -2.53, lng: -44.28, area: 'Capital/Metrópole' },
  { city: 'João Pessoa', state: 'PB', region: 'Nordeste', lat: -7.12, lng: -34.86, area: 'Litoral' },
  { city: 'Teresina', state: 'PI', region: 'Nordeste', lat: -5.09, lng: -42.80, area: 'Urbana/Interior' },
  { city: 'Natal', state: 'RN', region: 'Nordeste', lat: -5.79, lng: -35.21, area: 'Litoral' },
  { city: 'Maceió', state: 'AL', region: 'Nordeste', lat: -9.67, lng: -35.74, area: 'Litoral' },
  { city: 'Aracaju', state: 'SE', region: 'Nordeste', lat: -10.91, lng: -37.07, area: 'Litoral' },
  // ── Centro-Oeste (4 UFs) ──
  { city: 'Brasília', state: 'DF', region: 'Centro-Oeste', lat: -15.79, lng: -47.88, area: 'Capital/Metrópole' },
  { city: 'Goiânia', state: 'GO', region: 'Centro-Oeste', lat: -16.69, lng: -49.25, area: 'Capital/Metrópole' },
  { city: 'Cuiabá', state: 'MT', region: 'Centro-Oeste', lat: -15.60, lng: -56.10, area: 'Urbana/Interior' },
  { city: 'Campo Grande', state: 'MS', region: 'Centro-Oeste', lat: -20.44, lng: -54.65, area: 'Urbana/Interior' },
  // ── Sudeste (4 UFs) ──
  { city: 'São Paulo', state: 'SP', region: 'Sudeste', lat: -23.55, lng: -46.63, area: 'Capital/Metrópole' },
  { city: 'Rio de Janeiro', state: 'RJ', region: 'Sudeste', lat: -22.91, lng: -43.17, area: 'Capital/Metrópole' },
  { city: 'Belo Horizonte', state: 'MG', region: 'Sudeste', lat: -19.92, lng: -43.94, area: 'Capital/Metrópole' },
  { city: 'Vitória', state: 'ES', region: 'Sudeste', lat: -20.32, lng: -40.34, area: 'Litoral' },
  { city: 'Campinas', state: 'SP', region: 'Sudeste', lat: -22.91, lng: -47.06, area: 'Urbana/Interior' },
  { city: 'Uberlândia', state: 'MG', region: 'Sudeste', lat: -18.92, lng: -48.28, area: 'Urbana/Interior' },
  { city: 'Ribeirão Preto', state: 'SP', region: 'Sudeste', lat: -21.18, lng: -47.81, area: 'Urbana/Interior' },
  { city: 'Niterói', state: 'RJ', region: 'Sudeste', lat: -22.88, lng: -43.10, area: 'Capital/Metrópole' },
  // ── Sul (3 UFs) ──
  { city: 'Curitiba', state: 'PR', region: 'Sul', lat: -25.43, lng: -49.27, area: 'Capital/Metrópole' },
  { city: 'Porto Alegre', state: 'RS', region: 'Sul', lat: -30.03, lng: -51.23, area: 'Capital/Metrópole' },
  { city: 'Florianópolis', state: 'SC', region: 'Sul', lat: -27.60, lng: -48.55, area: 'Litoral' },
  { city: 'Joinville', state: 'SC', region: 'Sul', lat: -26.30, lng: -48.85, area: 'Urbana/Interior' },
  { city: 'Londrina', state: 'PR', region: 'Sul', lat: -23.31, lng: -51.16, area: 'Urbana/Interior' },
  // ── Cidades rurais/interiores (diversidade de area_type) ──
  { city: 'Juazeiro do Norte', state: 'CE', region: 'Nordeste', lat: -7.21, lng: -39.32, area: 'Urbana/Interior' },
  { city: 'Petrolina', state: 'PE', region: 'Nordeste', lat: -9.39, lng: -40.50, area: 'Urbana/Interior' },
  { city: 'Marabá', state: 'PA', region: 'Norte', lat: -5.37, lng: -49.12, area: 'Urbana/Interior' },
  { city: 'Chapecó', state: 'SC', region: 'Sul', lat: -27.10, lng: -52.62, area: 'Urbana/Interior' },
  { city: 'Montes Claros', state: 'MG', region: 'Sudeste', lat: -16.73, lng: -43.86, area: 'Urbana/Interior' },
  { city: 'Caruaru', state: 'PE', region: 'Nordeste', lat: -8.28, lng: -35.97, area: 'Urbana/Interior' },
  { city: 'Santarém', state: 'PA', region: 'Norte', lat: -2.44, lng: -54.71, area: 'Rural' },
];

const MALE_NAMES = [
  'João Silva', 'Pedro Oliveira', 'Lucas Mendes', 'Gabriel Santos', 'Matheus Costa',
  'Rafael Pereira', 'Bruno Almeida', 'Carlos Ferreira', 'André Souza', 'Felipe Nascimento',
  'Ricardo Lima', 'Marcos Ribeiro', 'Daniel Barbosa', 'Paulo Carvalho', 'Thiago Fernandes',
  'Eduardo Gomes', 'Henrique Martins', 'Rodrigo Araújo', 'Gustavo Rocha', 'Vinícius Lopes',
];

const FEMALE_NAMES = [
  'Maria Oliveira', 'Ana Santos', 'Juliana Mendes', 'Fernanda Costa', 'Camila Pereira',
  'Beatriz Almeida', 'Larissa Ferreira', 'Patrícia Souza', 'Raquel Nascimento', 'Sandra Lima',
  'Carla Ribeiro', 'Letícia Barbosa', 'Amanda Carvalho', 'Renata Fernandes', 'Daniela Gomes',
  'Mariana Martins', 'Isabela Araújo', 'Carolina Rocha', 'Natália Lopes', 'Bruna Teixeira',
];

const OCCUPATIONS = {
  low: ['Auxiliar administrativo', 'Atendente', 'Operador de caixa', 'Motorista de app', 'Diarista', 'Pedreiro', 'Cozinheiro', 'Porteiro'],
  mid: ['Analista de marketing', 'Professor', 'Enfermeiro', 'Técnico de TI', 'Policial militar', 'Contador', 'Designer gráfico', 'Vendedor'],
  high: ['Engenheiro de software', 'Médico', 'Advogado', 'Gerente de projetos', 'Analista de dados', 'Arquiteto', 'Economista', 'Psicólogo'],
  top: ['Diretor de tecnologia', 'CEO', 'Cirurgião', 'Juiz', 'Empresário', 'Gestor de fundos', 'Consultor estratégico', 'VP de Marketing'],
};

const COMPANIES = [
  'Autônomo', 'Itaú Unibanco', 'Petrobras', 'Magazine Luiza', 'iFood', 'Nubank',
  'Hospital Sírio-Libanês', 'Embraer', 'Vale', 'Natura', 'XP Investimentos',
  'Rede de Ensino Municipal', 'Startup local', 'Comércio próprio', 'Uber',
];

const ETHNICITIES = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena'];

// ── Persona Templates (39 diverse personas) ──────────────────────────────────

function generatePersona(index) {
  const isMale = Math.random() > 0.48;
  const gender = isMale ? 'Masculino' : 'Feminino';
  const namePool = isMale ? MALE_NAMES : FEMALE_NAMES;
  const name = namePool[index % namePool.length];
  const cityData = CITIES[index % CITIES.length];

  // Age distribution
  const age = randInt(18, 72);
  const generation = age <= 28 ? 'Gen Z' : age <= 44 ? 'Millennial' : age <= 60 ? 'Gen X' : 'Boomer';

  // Social class + income correlation
  const classRoll = Math.random();
  let socialClass, incomeRange, occupationTier;
  if (classRoll < 0.05) { socialClass = 'A'; incomeRange = [15000, 50000]; occupationTier = 'top'; }
  else if (classRoll < 0.15) { socialClass = 'B1'; incomeRange = [8000, 15000]; occupationTier = 'high'; }
  else if (classRoll < 0.30) { socialClass = 'B2'; incomeRange = [5000, 8000]; occupationTier = 'high'; }
  else if (classRoll < 0.55) { socialClass = 'C1'; incomeRange = [3000, 5000]; occupationTier = 'mid'; }
  else if (classRoll < 0.75) { socialClass = 'C2'; incomeRange = [1800, 3000]; occupationTier = 'mid'; }
  else if (classRoll < 0.90) { socialClass = 'D'; incomeRange = [1200, 1800]; occupationTier = 'low'; }
  else { socialClass = 'E'; incomeRange = [600, 1200]; occupationTier = 'low'; }

  const income = randInt(incomeRange[0], incomeRange[1]);
  const occupation = pick(OCCUPATIONS[occupationTier]);
  const company = pick(COMPANIES);

  // Education correlates with class
  const eduOptions = {
    A: ['Superior Completo', 'Pós-Graduação/MBA', 'Mestrado/Doutorado'],
    B1: ['Superior Completo', 'Pós-Graduação/MBA', 'Mestrado/Doutorado'],
    B2: ['Superior Completo', 'Pós-Graduação/MBA', 'Superior Incompleto'],
    C1: ['Médio', 'Superior Incompleto', 'Superior Completo'],
    C2: ['Médio', 'Superior Incompleto'],
    D: ['Fundamental', 'Médio'],
    E: ['Fundamental', 'Médio'],
  };
  const educationLevel = pick(eduOptions[socialClass]);

  const civilStatus = pick(['Solteiro', 'Casado', 'União Estável', 'Divorciado', 'Viúvo']);
  const ethnicity = pick(ETHNICITIES);
  const cronotype = pick(['Matutino', 'Vespertino', 'Noturno/Night Owl']);

  // ── Archetype distribution to match Pulse Arena ──
  // 9 traditionalist, 8 activist, 7 analyst, 9 moderate, 6 entrepreneur
  const archetypeProfiles = [
    // 0-8: Tradicionalista (9)
    { political: pick(['Direita', 'Centro-Direita', 'Extrema Direita']), religion: pick(['Católico', 'Evangélico/Protestante']), archetype: pick(['O Governante', 'O Cidadão Comum', 'O Cuidador']), disc: 'Conformidade' },
    { political: pick(['Direita', 'Centro-Direita', 'Extrema Direita']), religion: pick(['Católico', 'Evangélico/Protestante']), archetype: pick(['O Governante', 'O Cidadão Comum', 'O Cuidador']), disc: 'Conformidade' },
    { political: pick(['Direita', 'Centro-Direita', 'Extrema Direita']), religion: pick(['Católico', 'Evangélico/Protestante']), archetype: pick(['O Governante', 'O Cidadão Comum', 'O Cuidador']), disc: 'Estabilidade' },
    { political: pick(['Direita', 'Centro-Direita']), religion: pick(['Católico', 'Evangélico/Protestante']), archetype: pick(['O Governante', 'O Cidadão Comum', 'O Herói']), disc: 'Conformidade' },
    { political: pick(['Direita', 'Centro-Direita', 'Extrema Direita']), religion: pick(['Católico', 'Evangélico/Protestante']), archetype: pick(['O Governante', 'O Cidadão Comum', 'O Cuidador']), disc: 'Estabilidade' },
    { political: pick(['Direita', 'Centro-Direita']), religion: 'Católico', archetype: 'O Cidadão Comum', disc: 'Conformidade' },
    { political: 'Extrema Direita', religion: 'Evangélico/Protestante', archetype: 'O Herói', disc: 'Dominância' },
    { political: 'Centro-Direita', religion: 'Católico', archetype: 'O Governante', disc: 'Conformidade' },
    { political: 'Direita', religion: 'Evangélico/Protestante', archetype: 'O Cuidador', disc: 'Estabilidade' },
    // 9-16: Engajado Social (8)
    { political: pick(['Esquerda', 'Centro-Esquerda', 'Extrema Esquerda']), religion: pick(['Espírita (Kardecista)', 'Ateu/Agnóstico', 'Espiritualidade Eclética']), archetype: pick(['O Cuidador', 'O Rebelde', 'O Herói']), disc: 'Influência' },
    { political: pick(['Esquerda', 'Centro-Esquerda', 'Extrema Esquerda']), religion: pick(['Ateu/Agnóstico', 'Espiritualidade Eclética', 'Matriz Africana (Candomblé/Umbanda)']), archetype: pick(['O Rebelde', 'O Herói', 'O Cuidador']), disc: 'Influência' },
    { political: pick(['Esquerda', 'Centro-Esquerda']), religion: pick(['Espírita (Kardecista)', 'Ateu/Agnóstico']), archetype: pick(['O Cuidador', 'O Rebelde']), disc: 'Influência' },
    { political: 'Extrema Esquerda', religion: 'Ateu/Agnóstico', archetype: 'O Rebelde', disc: 'Dominância' },
    { political: 'Esquerda', religion: 'Espiritualidade Eclética', archetype: 'O Cuidador', disc: 'Influência' },
    { political: 'Centro-Esquerda', religion: 'Espírita (Kardecista)', archetype: 'O Herói', disc: 'Influência' },
    { political: 'Esquerda', religion: 'Matriz Africana (Candomblé/Umbanda)', archetype: 'O Rebelde', disc: 'Influência' },
    { political: 'Centro-Esquerda', religion: 'Ateu/Agnóstico', archetype: 'O Cuidador', disc: 'Estabilidade' },
    // 17-23: Analítico Racional (7)
    { political: pick(['Centro', 'Centro-Liberal']), religion: pick(['Ateu/Agnóstico', 'Espírita (Kardecista)']), archetype: pick(['O Sábio', 'O Explorador']), disc: 'Conformidade' },
    { political: pick(['Centro', 'Centro-Liberal']), religion: pick(['Ateu/Agnóstico', 'Judaísmo']), archetype: pick(['O Sábio', 'O Explorador', 'O Mago']), disc: 'Conformidade' },
    { political: 'Centro', religion: 'Ateu/Agnóstico', archetype: 'O Sábio', disc: 'Conformidade' },
    { political: 'Centro-Liberal', religion: 'Espírita (Kardecista)', archetype: 'O Explorador', disc: 'Conformidade' },
    { political: 'Centro', religion: 'Ateu/Agnóstico', archetype: 'O Mago', disc: 'Conformidade' },
    { political: 'Centro-Liberal', religion: 'Judaísmo', archetype: 'O Sábio', disc: 'Dominância' },
    { political: 'Centro', religion: 'Ateu/Agnóstico', archetype: 'O Explorador', disc: 'Conformidade' },
    // 24-32: Moderado (9)
    { political: pick(['Centro', 'Centro-Esquerda', 'Centro-Direita']), religion: pick(['Católico', 'Espírita (Kardecista)', 'Espiritualidade Eclética']), archetype: pick(['O Cidadão Comum', 'O Cuidador', 'O Inocente']), disc: 'Estabilidade' },
    { political: pick(['Centro', 'Centro-Esquerda', 'Centro-Direita']), religion: pick(['Católico', 'Evangélico/Protestante', 'Espírita (Kardecista)']), archetype: pick(['O Cidadão Comum', 'O Inocente']), disc: 'Estabilidade' },
    { political: 'Centro', religion: 'Católico', archetype: 'O Cidadão Comum', disc: 'Estabilidade' },
    { political: 'Centro-Esquerda', religion: 'Espírita (Kardecista)', archetype: 'O Cuidador', disc: 'Estabilidade' },
    { political: 'Centro-Direita', religion: 'Evangélico/Protestante', archetype: 'O Inocente', disc: 'Estabilidade' },
    { political: 'Centro', religion: 'Católico', archetype: 'O Cidadão Comum', disc: 'Influência' },
    { political: 'Centro-Esquerda', religion: 'Espiritualidade Eclética', archetype: 'O Cuidador', disc: 'Estabilidade' },
    { political: 'Centro-Direita', religion: 'Católico', archetype: 'O Inocente', disc: 'Estabilidade' },
    { political: 'Centro', religion: 'Espírita (Kardecista)', archetype: 'O Cidadão Comum', disc: 'Estabilidade' },
    // 33-38: Empreendedor (6)
    { political: pick(['Centro-Liberal', 'Centro-Direita', 'Direita']), religion: pick(['Católico', 'Ateu/Agnóstico', 'Espiritualidade Eclética']), archetype: pick(['O Criador', 'O Explorador', 'O Mago']), disc: 'Dominância' },
    { political: pick(['Centro-Liberal', 'Centro-Direita', 'Direita']), religion: pick(['Católico', 'Ateu/Agnóstico']), archetype: pick(['O Criador', 'O Explorador']), disc: 'Dominância' },
    { political: 'Centro-Liberal', religion: 'Ateu/Agnóstico', archetype: 'O Criador', disc: 'Dominância' },
    { political: 'Direita', religion: 'Católico', archetype: 'O Explorador', disc: 'Dominância' },
    { political: 'Centro-Direita', religion: 'Espiritualidade Eclética', archetype: 'O Mago', disc: 'Influência' },
    { political: 'Centro-Liberal', religion: 'Ateu/Agnóstico', archetype: 'O Criador', disc: 'Dominância' },
  ];

  const profile = archetypeProfiles[index % archetypeProfiles.length];

  // DISC profile scores
  const discScores = {
    Dominância: profile.disc === 'Dominância' ? randFloat(65, 90) : randFloat(15, 50),
    Influência: profile.disc === 'Influência' ? randFloat(65, 90) : randFloat(15, 50),
    Estabilidade: profile.disc === 'Estabilidade' ? randFloat(65, 90) : randFloat(15, 50),
    Conformidade: profile.disc === 'Conformidade' ? randFloat(65, 90) : randFloat(15, 50),
  };

  // Big Five personality
  const bigFive = {
    openness: randFloat(30, 95),
    conscientiousness: randFloat(30, 95),
    extraversion: randFloat(20, 90),
    agreeableness: randFloat(25, 90),
    neuroticism: randFloat(15, 80),
  };

  // Moral foundations vary by archetype group
  let moralFoundations;
  if (index < 9) {
    // Tradicionalista - higher authority, purity, loyalty
    moralFoundations = { care: randFloat(40, 70), fairness: randFloat(30, 60), loyalty: randFloat(70, 95), authority: randFloat(75, 95), purity: randFloat(70, 95), liberty: randFloat(30, 55) };
  } else if (index < 17) {
    // Engajado Social - higher care, fairness
    moralFoundations = { care: randFloat(80, 98), fairness: randFloat(80, 98), loyalty: randFloat(30, 55), authority: randFloat(15, 40), purity: randFloat(20, 50), liberty: randFloat(60, 85) };
  } else if (index < 24) {
    // Analítico Racional - balanced, higher fairness
    moralFoundations = { care: randFloat(50, 75), fairness: randFloat(70, 90), loyalty: randFloat(35, 60), authority: randFloat(30, 55), purity: randFloat(25, 50), liberty: randFloat(65, 85) };
  } else if (index < 33) {
    // Moderado - balanced across all
    moralFoundations = { care: randFloat(55, 75), fairness: randFloat(55, 75), loyalty: randFloat(50, 70), authority: randFloat(45, 70), purity: randFloat(45, 65), liberty: randFloat(50, 70) };
  } else {
    // Empreendedor - higher liberty, fairness (merit-based)
    moralFoundations = { care: randFloat(35, 60), fairness: randFloat(50, 75), loyalty: randFloat(40, 65), authority: randFloat(45, 70), purity: randFloat(30, 55), liberty: randFloat(75, 95) };
  }

  const cognitiveBiases = pick([
    ['Viés de confirmação', 'Efeito halo'],
    ['Viés de ancoragem', 'Efeito Dunning-Kruger'],
    ['Viés de disponibilidade', 'Efeito de dotação'],
    ['Viés de grupo', 'Viés de status quo'],
    ['Viés otimista', 'Efeito de enquadramento'],
    ['Viés de autoridade', 'Viés de retrospectiva'],
  ]);

  const communicationStyle = pick([
    'Direto e assertivo', 'Empático e acolhedor', 'Analítico e detalhista',
    'Diplomático e equilibrado', 'Prático e objetivo', 'Expressivo e emocional',
    'Reservado e reflexivo', 'Persuasivo e carismático',
  ]);

  const decisionProcess = pick([
    'Baseado em dados e evidências', 'Guiado por valores morais',
    'Ponderação de prós e contras', 'Instintivo e rápido',
    'Consensual e colaborativo', 'Estratégico e calculado',
  ]);

  const valoresCore = pick([
    ['Família', 'Fé', 'Ordem'],
    ['Justiça', 'Igualdade', 'Empatia'],
    ['Conhecimento', 'Verdade', 'Racionalidade'],
    ['Equilíbrio', 'Diálogo', 'Harmonia'],
    ['Liberdade', 'Mérito', 'Inovação'],
    ['Segurança', 'Tradição', 'Respeito'],
    ['Progresso', 'Criatividade', 'Autonomia'],
    ['Comunidade', 'Solidariedade', 'Cuidado'],
  ]);

  const hasChildren = civilStatus === 'Casado' || civilStatus === 'União Estável' ? Math.random() > 0.3 : Math.random() > 0.7;
  const numChildren = hasChildren ? randInt(1, 3) : 0;

  const hobbies = pick([
    ['Leitura', 'Caminhada', 'Culinária'],
    ['Futebol', 'Churrasco', 'Música'],
    ['Yoga', 'Meditação', 'Viagens'],
    ['Games', 'Séries', 'Tecnologia'],
    ['Academia', 'Corrida', 'Nutrição'],
    ['Artesanato', 'Jardinagem', 'Voluntariado'],
    ['Investimentos', 'Podcast', 'Networking'],
    ['Cinema', 'Teatro', 'Fotografia'],
  ]);

  const lat = cityData.lat + (Math.random() - 0.5) * 0.5;
  const lng = cityData.lng + (Math.random() - 0.5) * 0.5;

  return {
    name,
    age,
    city: cityData.city,
    state: cityData.state,
    lat,
    lng,
    gender,
    gender_identity: gender,
    civil_status: civilStatus,
    social_class: socialClass,
    education_level: educationLevel,
    generation,
    political_leaning: profile.political,
    archetype_primary: profile.archetype,
    disc_main_factor: profile.disc,
    macro_religion: profile.religion,
    cronotype,
    region_br: cityData.region,
    area_type: cityData.area,
    psychology_json: {
      disc_profile: discScores,
      big_five: bigFive,
      moral_foundations: moralFoundations,
      cognitive_biases: cognitiveBiases,
      communication_style: communicationStyle,
      decision_process: decisionProcess,
      valores_core: valoresCore,
      archetypes: {
        primary: profile.archetype,
        secondary: pick(['O Inocente', 'O Sábio', 'O Explorador', 'O Rebelde', 'O Mago', 'O Herói', 'O Amante', 'O Comediante', 'O Cidadão Comum', 'O Cuidador', 'O Governante', 'O Criador'].filter(a => a !== profile.archetype)),
      },
      resilience: randFloat(40, 90),
      stress_tolerance: randFloat(30, 85),
      emotional_intelligence: randFloat(35, 90),
    },
    career_json: {
      atuação_e_cargo: {
        cargo_atual: occupation,
        empresa: company,
        setor: pick(['Tecnologia', 'Saúde', 'Educação', 'Comércio', 'Finanças', 'Indústria', 'Serviços', 'Governo', 'Autônomo']),
        tempo_no_cargo: `${randInt(1, 15)} anos`,
      },
      satisfação_profissional: randFloat(3, 10),
      ambição: randFloat(4, 10),
      work_life_balance: randFloat(3, 9),
      comunicacao_e_linguagem: {
        regionalismo_na_fala: cityData.area === 'Rural' ? 'Alto' : cityData.area === 'Urbana/Interior' ? 'Médio' : 'Baixo',
        eloquencia: educationLevel.includes('Superior') || educationLevel.includes('Pós') || educationLevel.includes('Mestrado') ? 'Alta' : educationLevel === 'Médio' ? 'Média' : 'Baixa',
        nivel_formalidade: socialClass === 'A' || socialClass === 'B1' ? 'Formal' : socialClass === 'C1' || socialClass === 'B2' ? 'Semi-formal' : 'Informal',
        uso_de_jargao_tecnico: occupationTier === 'top' || occupationTier === 'high' ? 'Frequente' : 'Raro',
        estilo_internet: generation === 'Gen Z' ? 'Abreviações pesadas, emoji, memes, caps' : generation === 'Millennial' ? 'Abreviações moderadas, emoji médio' : generation === 'Gen X' ? 'Poucas abreviações, pouco emoji' : 'Texto formal, CAPS frequente, sem abreviações',
        erros_comuns: educationLevel === 'Fundamental' ? ['mais/mas', 'mim/eu', 'agente/a gente', 'concerteza'] : educationLevel === 'Médio' ? ['mais/mas', 'agente/a gente'] : [],
      },
    },
    beliefs_json: {
      religião: {
        fé_ou_doutrina: profile.religion,
        praticante: Math.random() > 0.4,
        frequência: pick(['Semanal', 'Quinzenal', 'Mensal', 'Raramente', 'Nunca']),
      },
      orientação_política: {
        espectro: profile.political,
        engajamento: pick(['Alto', 'Médio', 'Baixo', 'Muito baixo']),
        vota_regularmente: Math.random() > 0.2,
      },
      valores_morais: moralFoundations,
      posições_sociais: {
        pena_de_morte: index < 9 ? pick(['A favor', 'A favor com ressalvas']) : index < 17 ? pick(['Contra', 'Totalmente contra']) : index < 24 ? pick(['Depende dos dados', 'Inconclusivo']) : index < 33 ? pick(['Neutro', 'Não tenho certeza']) : pick(['A favor se eficaz', 'Depende do custo-benefício']),
        aborto: index < 9 ? 'Contra' : index < 17 ? 'A favor' : pick(['Depende do contexto', 'Neutro']),
        porte_de_armas: index < 9 ? pick(['A favor', 'A favor com restrições']) : index < 17 ? 'Contra' : pick(['Neutro', 'Contra', 'A favor com restrições']),
        legalização_drogas: index < 9 ? 'Contra' : index < 17 ? 'A favor' : pick(['A favor com regulação', 'Neutro', 'Contra']),
      },
    },
    demographic_json: {
      identidade_basica: {
        etnia: ethnicity,
        nacionalidade: 'Brasileira',
        naturalidade: `${cityData.city}, ${cityData.state}`,
      },
      familia_e_estado_civil: {
        estado_civil: civilStatus,
        filhos: numChildren,
        mora_com: civilStatus === 'Casado' || civilStatus === 'União Estável' ? 'Cônjuge' + (numChildren > 0 ? ` e ${numChildren} filho(s)` : '') : civilStatus === 'Solteiro' && age < 25 ? 'Pais' : 'Sozinho(a)',
      },
      renda_e_financas: {
        renda_mensal_individual: income,
        renda_familiar: Math.round(income * randFloat(1.2, 2.5)),
        possui_imovel: socialClass === 'A' || socialClass === 'B1' ? Math.random() > 0.2 : Math.random() > 0.6,
        investimentos: socialClass === 'A' || socialClass === 'B1' || socialClass === 'B2',
      },
      localização: {
        cidade: cityData.city,
        estado: cityData.state,
        região: cityData.region,
        tipo_área: cityData.area,
        latitude: cityData.lat + (Math.random() - 0.5) * 0.5,
        longitude: cityData.lng + (Math.random() - 0.5) * 0.5,
      },
      estilo_de_vida: {
        hobbies,
        redes_sociais: pick([
          ['Instagram', 'WhatsApp', 'YouTube'],
          ['Twitter/X', 'LinkedIn', 'WhatsApp'],
          ['TikTok', 'Instagram', 'WhatsApp'],
          ['Facebook', 'WhatsApp', 'YouTube'],
          ['LinkedIn', 'Instagram', 'WhatsApp'],
        ]),
        consumo_midia: pick(['TV aberta', 'Streaming', 'Redes sociais', 'Jornais online', 'Podcasts', 'Rádio']),
        transporte: pick(['Carro próprio', 'Transporte público', 'Moto', 'Uber/99', 'Bicicleta', 'A pé']),
      },
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Generating 39 diverse personas...\n');

  const personas = [];
  for (let i = 0; i < 39; i++) {
    personas.push(generatePersona(i));
  }

  // Show distribution summary
  const distribution = {
    'Tradicionalista (0-8)': personas.slice(0, 9).length,
    'Engajado Social (9-16)': personas.slice(9, 17).length,
    'Analítico Racional (17-23)': personas.slice(17, 24).length,
    'Moderado (24-32)': personas.slice(24, 33).length,
    'Empreendedor (33-38)': personas.slice(33, 39).length,
  };
  console.log('Distribution:', distribution);
  console.log(`Total: ${personas.length}\n`);

  // Insert in batches of 10
  let inserted = 0;
  const batchSize = 10;

  for (let i = 0; i < personas.length; i += batchSize) {
    const batch = personas.slice(i, i + batchSize);
    const { data, error } = await supabase.from('personas').insert(batch).select('id, name');

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
      console.error('Details:', JSON.stringify(error, null, 2));
      // Try one by one to find the problematic record
      for (const persona of batch) {
        const { data: d, error: e } = await supabase.from('personas').insert(persona).select('id, name');
        if (e) {
          console.error(`  Failed: ${persona.name} - ${e.message}`);
        } else {
          inserted++;
          console.log(`  OK: ${d[0].name} (${d[0].id})`);
        }
      }
    } else {
      inserted += data.length;
      data.forEach(p => console.log(`  Inserted: ${p.name} (${p.id})`));
    }
  }

  console.log(`\nDone! Inserted ${inserted} of ${personas.length} personas.`);

  // Verify total count
  const { count } = await supabase.from('personas').select('id', { count: 'exact', head: true });
  console.log(`Total personas in database: ${count}`);
}

main().catch(console.error);
