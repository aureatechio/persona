import {
  Target,
  BookOpen,
  Shield,
  Megaphone,
  Heart,
  Flame,
  Crown,
  Smartphone,
  GraduationCap,
  Wrench,
} from 'lucide-react';

// ── Cluster Definitions (24 Clusters Ideológicos) ────────────────────────────
export const CLUSTERS = [
  // Progressistas (P1-P6)
  { id: 'P1', name: 'Base Social', macro: 'Progressista' as const },
  { id: 'P2', name: 'Trabalhista', macro: 'Progressista' as const },
  { id: 'P3', name: 'Progressista Urbano', macro: 'Progressista' as const },
  { id: 'P4', name: 'Regulador Técnico', macro: 'Progressista' as const },
  { id: 'P5', name: 'Desenvolvimentista', macro: 'Progressista' as const },
  { id: 'P6', name: 'Centro-Esquerda Moderada', macro: 'Progressista' as const },
  // Moderados (M1-M8)
  { id: 'M1', name: 'Centro Econômico', macro: 'Moderado' as const },
  { id: 'M2', name: 'Centro Conservador', macro: 'Moderado' as const },
  { id: 'M3', name: 'Institucional', macro: 'Moderado' as const },
  { id: 'M4', name: 'Gestor Pragmático', macro: 'Moderado' as const },
  { id: 'M5', name: 'Volátil Econômico', macro: 'Moderado' as const },
  { id: 'M6', name: 'Empreendedor Urbano', macro: 'Moderado' as const },
  { id: 'M7', name: 'Classe Média Sensível', macro: 'Moderado' as const },
  { id: 'M8', name: 'Cético Político', macro: 'Moderado' as const },
  // Conservadores (C1-C8)
  { id: 'C1', name: 'Liberal de Mercado', macro: 'Conservador' as const },
  { id: 'C2', name: 'Conservador Religioso', macro: 'Conservador' as const },
  { id: 'C3', name: 'Nacionalista', macro: 'Conservador' as const },
  { id: 'C4', name: 'Linha Dura Segurança', macro: 'Conservador' as const },
  { id: 'C5', name: 'Antissistema', macro: 'Conservador' as const },
  { id: 'C6', name: 'Pequeno Empresário', macro: 'Conservador' as const },
  { id: 'C7', name: 'Direita Digital', macro: 'Conservador' as const },
  { id: 'C8', name: 'Conservador Tradicional', macro: 'Conservador' as const },
  // Transversais (T1-T2)
  { id: 'T1', name: 'Desengajado', macro: 'Transversal' as const },
  { id: 'T2', name: 'Anti-Incumbente', macro: 'Transversal' as const },
];

export const MACRO_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Progressista: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  Moderado: { bg: 'bg-zinc-400/10', text: 'text-zinc-300', border: 'border-zinc-400/20', dot: 'bg-zinc-300' },
  Conservador: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', dot: 'bg-sky-400' },
  Transversal: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400' },
};

export const MACRO_GROUPS = ['Progressista', 'Moderado', 'Conservador', 'Transversal'] as const;

// ── Archetype Definitions (10 Perfis Brasileiros) ────────────────────────────
export const ARCHETYPES = [
  {
    id: 'patriota_radical',
    name: 'Patriota Radical',
    subtitle: 'Intervenção Militar & Armas',
    icon: Target,
    gradient: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/20',
    text: 'text-green-400',
    bg: 'bg-green-500',
    dot: 'bg-green-400',
    political: ['Extrema Direita', 'Direita'],
    sentimentBias: { crime: 0.9, social: 0.1, economy: 0.6, politics: 0.7, environment: 0.15, general: 0.4 },
  },
  {
    id: 'pastor_evangelico',
    name: 'Pastor Evangélico',
    subtitle: 'Fé, Moral & Julgamento',
    icon: BookOpen,
    gradient: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    bg: 'bg-violet-500',
    dot: 'bg-violet-400',
    political: ['Direita', 'Centro-Direita', 'Extrema Direita'],
    sentimentBias: { crime: 0.75, social: 0.1, economy: 0.5, politics: 0.55, environment: 0.3, general: 0.4 },
  },
  {
    id: 'policial_militar',
    name: 'Força da Lei',
    subtitle: 'Policial, Militar & Ordem',
    icon: Shield,
    gradient: 'from-indigo-500/20 to-indigo-600/5',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500',
    dot: 'bg-indigo-400',
    political: ['Direita', 'Centro-Direita', 'Extrema Direita'],
    sentimentBias: { crime: 0.95, social: 0.2, economy: 0.55, politics: 0.65, environment: 0.25, general: 0.45 },
  },
  {
    id: 'militante_esquerda',
    name: 'Militante Social',
    subtitle: 'Anti-Fascista & Direitos',
    icon: Megaphone,
    gradient: 'from-rose-500/20 to-rose-600/5',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    bg: 'bg-rose-500',
    dot: 'bg-rose-400',
    political: ['Esquerda', 'Extrema Esquerda', 'Centro-Esquerda'],
    sentimentBias: { crime: 0.15, social: 0.95, economy: 0.2, politics: 0.3, environment: 0.9, general: 0.5 },
  },
  {
    id: 'mae_familia',
    name: 'Mãe de Família',
    subtitle: 'Proteção, Filhos & Valores',
    icon: Heart,
    gradient: 'from-pink-500/20 to-pink-600/5',
    border: 'border-pink-500/20',
    text: 'text-pink-400',
    bg: 'bg-pink-500',
    dot: 'bg-pink-400',
    political: ['Centro', 'Centro-Direita', 'Centro-Esquerda'],
    sentimentBias: { crime: 0.6, social: 0.45, economy: 0.4, politics: 0.45, environment: 0.5, general: 0.45 },
  },
  {
    id: 'jovem_periferia',
    name: 'Jovem Periferia',
    subtitle: 'Funk, Quebrada & Resistência',
    icon: Flame,
    gradient: 'from-yellow-500/20 to-yellow-600/5',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500',
    dot: 'bg-yellow-400',
    political: ['Esquerda', 'Centro-Esquerda', 'Centro'],
    sentimentBias: { crime: 0.15, social: 0.75, economy: 0.2, politics: 0.3, environment: 0.5, general: 0.4 },
  },
  {
    id: 'elite_indignada',
    name: 'Elite Indignada',
    subtitle: 'Classe A, Impostos & Emigrar',
    icon: Crown,
    gradient: 'from-sky-500/20 to-sky-600/5',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    bg: 'bg-sky-500',
    dot: 'bg-sky-400',
    political: ['Centro-Direita', 'Direita', 'Centro-Liberal'],
    sentimentBias: { crime: 0.7, social: 0.3, economy: 0.85, politics: 0.5, environment: 0.4, general: 0.5 },
  },
  {
    id: 'tiozao_zap',
    name: 'Tiozão do Zap',
    subtitle: 'Correntes, Fake News & CAPS',
    icon: Smartphone,
    gradient: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    bg: 'bg-orange-500',
    dot: 'bg-orange-400',
    political: ['Direita', 'Extrema Direita', 'Centro-Direita'],
    sentimentBias: { crime: 0.85, social: 0.15, economy: 0.6, politics: 0.7, environment: 0.2, general: 0.45 },
  },
  {
    id: 'intelectual',
    name: 'Intelectual Crítico',
    subtitle: 'Pós-Graduação & Ironia',
    icon: GraduationCap,
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500',
    dot: 'bg-cyan-400',
    political: ['Centro-Esquerda', 'Centro', 'Esquerda'],
    sentimentBias: { crime: 0.4, social: 0.7, economy: 0.5, politics: 0.4, environment: 0.75, general: 0.5 },
  },
  {
    id: 'trabalhador',
    name: 'Trabalhador Revoltado',
    subtitle: 'CLT, Salário & Sobrevivência',
    icon: Wrench,
    gradient: 'from-red-500/20 to-red-600/5',
    border: 'border-red-500/20',
    text: 'text-red-400',
    bg: 'bg-red-500',
    dot: 'bg-red-400',
    political: ['Centro-Esquerda', 'Esquerda', 'Centro'],
    sentimentBias: { crime: 0.45, social: 0.5, economy: 0.2, politics: 0.25, environment: 0.4, general: 0.35 },
  },
];

//                          [patriota, pastor, policial, militante, mae, jovem, elite, tiozao, intelectual, trabalhador]
export const BASE_DISTRIBUTION = [0.08, 0.12, 0.06, 0.10, 0.14, 0.12, 0.08, 0.10, 0.08, 0.12];

// ── Topic Detection Keywords ─────────────────────────────────────────────────
export const TOPICS: Record<string, string[]> = {
  crime: ['pris', 'crime', 'conden', 'puni', 'cadeia', 'assassin', 'roubo', 'assalto', 'ladr', 'band', 'trafic', 'matar', 'morte', 'violenc', 'estupro', 'perpetu', 'pena', 'matar', 'homicid', 'latrocin', 'menor', 'menino', 'condenar', 'julgam', 'impunid', 'arma', 'porte', 'milici', 'segur', 'polici', 'delegac'],
  social: ['direito', 'igualdade', 'inclus', 'diversid', 'lgbt', 'feminism', 'racismo', 'preconceito', 'educac', 'saude', 'sus', 'cotas', 'social', 'pobreza', 'fome', 'moradia', 'escola', 'aborto', 'droga', 'maconha', 'legaliz', 'genero', 'trans', 'casamento', 'adoc'],
  economy: ['econom', 'mercado', 'invest', 'emprego', 'salario', 'imposto', 'inflac', 'pib', 'dolar', 'bolsa', 'empresa', 'negocio', 'cresciment', 'reform', 'fiscal', 'privat', 'estatal', 'petrob', 'petrobras', 'privatiz', 'banco', 'juros', 'selic', 'divida', 'orcament', 'tributar', 'empreend', 'startup', 'comerci', 'industri'],
  politics: ['govern', 'president', 'congresso', 'politic', 'eleic', 'votac', 'partido', 'democrac', 'corrupc', 'reforma', 'senado', 'camara', 'stf', 'ministro', 'lula', 'bolsonar', 'impeach', 'cpi', 'deputad', 'vereador', 'prefeit', 'governad'],
  environment: ['ambient', 'clima', 'sustentab', 'desmata', 'poluic', 'ecolog', 'verde', 'amazon', 'naturez', 'carbono', 'energia', 'renovavel', 'queimad', 'floresta', 'bioma', 'pantanal', 'agrotox'],
};

// ── Dynamic Archetype Distribution by Topic ──────────────────────────────────
// Order: [patriota, pastor, policial, militante, mae, jovem, elite, tiozao, intelectual, trabalhador]
export const TOPIC_DISTRIBUTIONS: Record<string, number[]> = {
  crime:       [0.14, 0.10, 0.14, 0.08, 0.12, 0.10, 0.06, 0.12, 0.06, 0.08],
  social:      [0.08, 0.14, 0.04, 0.18, 0.10, 0.14, 0.06, 0.06, 0.12, 0.08],
  economy:     [0.06, 0.06, 0.04, 0.08, 0.12, 0.10, 0.18, 0.08, 0.10, 0.18],
  politics:    [0.14, 0.10, 0.08, 0.12, 0.08, 0.08, 0.10, 0.14, 0.08, 0.08],
  environment: [0.04, 0.06, 0.04, 0.20, 0.10, 0.10, 0.08, 0.06, 0.18, 0.14],
  general:     [0.08, 0.12, 0.06, 0.10, 0.14, 0.12, 0.08, 0.10, 0.08, 0.12],
};

// ── Archetype → Persona SMART matching ───────────────────────────────────────
type PersonaScorer = (p: Record<string, any>) => number;

export const ARCHETYPE_SCORERS: Record<string, PersonaScorer> = {
  patriota_radical: (p) => {
    let s = 0;
    if (['Extrema Direita', 'Direita'].includes(p.political_leaning)) s += 4;
    if (p.gender_identity === 'Masculino') s += 1;
    if (['Policial Militar', 'Vigilante'].includes(p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual)) s += 2;
    if (['Evangélico/Protestante', 'Católico'].includes(p.macro_religion)) s += 1;
    if (['Fundamental', 'Médio'].includes(p.education_level)) s += 1;
    return s;
  },
  pastor_evangelico: (p) => {
    let s = 0;
    if (p.macro_religion === 'Evangélico/Protestante') s += 5;
    if (['Direita', 'Centro-Direita', 'Extrema Direita'].includes(p.political_leaning)) s += 2;
    if (['Boomer', 'Gen X'].includes(p.generation)) s += 1;
    return s;
  },
  policial_militar: (p) => {
    let s = 0;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Policial Militar', 'Vigilante'].includes(cargo)) s += 6;
    if (['Técnico em Segurança do Trabalho', 'Soldador', 'Operador de Máquinas'].includes(cargo)) s += 2;
    if (['Direita', 'Centro-Direita', 'Extrema Direita'].includes(p.political_leaning)) s += 3;
    if (p.gender_identity === 'Masculino') s += 1;
    if (['Boomer', 'Gen X'].includes(p.generation)) s += 1;
    return s;
  },
  militante_esquerda: (p) => {
    let s = 0;
    if (['Esquerda', 'Extrema Esquerda'].includes(p.political_leaning)) s += 4;
    if (p.political_leaning === 'Centro-Esquerda') s += 2;
    if (['Gen Z', 'Millennial'].includes(p.generation)) s += 2;
    if (['Ateu/Agnóstico', 'Espiritualidade Eclética'].includes(p.macro_religion)) s += 1;
    if (['Superior Completo', 'Mestrado/Doutorado'].includes(p.education_level)) s += 1;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Professor', 'Professor Universitário', 'Assistente Social', 'Psicólogo Clínico'].includes(cargo)) s += 2;
    return s;
  },
  mae_familia: (p) => {
    let s = 0;
    if (p.gender_identity === 'Feminino') s += 4;
    if (['Casado', 'União Estável', 'Viúvo', 'Divorciado'].includes(p.civil_status)) s += 3;
    if (['C1', 'C2', 'D'].includes(p.social_class)) s += 2;
    if (['Gen X', 'Millennial'].includes(p.generation)) s += 1;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Diarista', 'Costureira', 'Manicure', 'Cabeleireiro/Barbeiro', 'Recepcionista', 'Auxiliar Administrativo', 'Cozinheiro', 'Lavadeira'].includes(cargo)) s += 2;
    return s;
  },
  jovem_periferia: (p) => {
    let s = 0;
    if (p.generation === 'Gen Z') s += 4;
    if (p.generation === 'Millennial' && (p.age || 30) < 30) s += 3;
    if (['D', 'E', 'C2'].includes(p.social_class)) s += 3;
    if (['Fundamental', 'Médio'].includes(p.education_level)) s += 2;
    if (p.area_type === 'Capital/Metrópole') s += 1;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Motoboy/Entregador', 'Atendente', 'Balconista', 'Ajudante de Obra', 'Servente', 'Catador de Recicláveis', 'Ambulante', 'Garçom/Garçonete', 'Operador de Caixa', 'Faxineiro'].includes(cargo)) s += 2;
    return s;
  },
  elite_indignada: (p) => {
    let s = 0;
    if (['A', 'B1'].includes(p.social_class)) s += 4;
    if (['Superior Completo', 'Mestrado/Doutorado', 'Pós-Graduação/MBA'].includes(p.education_level)) s += 2;
    if (['Centro-Direita', 'Direita', 'Centro-Liberal', 'Libertário'].includes(p.political_leaning)) s += 2;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['CEO', 'CTO', 'Empresário', 'Advogado', 'Médico Clínico', 'Médico Especialista', 'Cirurgião', 'Desembargador', 'Juiz', 'Diretor Financeiro', 'Diretor de Marketing', 'VP de Vendas', 'Gestor de Fundos', 'Sócio de Escritório', 'Consultor Estratégico', 'Analista de Investimentos'].includes(cargo)) s += 3;
    return s;
  },
  tiozao_zap: (p) => {
    let s = 0;
    if (p.generation === 'Boomer') s += 4;
    if (p.generation === 'Gen X') s += 2;
    if (p.gender_identity === 'Masculino') s += 2;
    if (['Direita', 'Extrema Direita', 'Centro-Direita'].includes(p.political_leaning)) s += 2;
    if (['Fundamental', 'Médio'].includes(p.education_level)) s += 1;
    return s;
  },
  intelectual: (p) => {
    let s = 0;
    if (['Mestrado/Doutorado', 'Pós-Graduação/MBA'].includes(p.education_level)) s += 5;
    if (p.education_level === 'Superior Completo') s += 2;
    if (['Centro-Esquerda', 'Centro', 'Esquerda', 'Centro-Liberal'].includes(p.political_leaning)) s += 2;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Professor Universitário', 'Professor', 'Economista', 'Advogado', 'Psicólogo Clínico', 'Analista de Dados Sênior'].includes(cargo)) s += 3;
    if (['Ateu/Agnóstico', 'Espírita (Kardecista)', 'Espiritualidade Eclética'].includes(p.macro_religion)) s += 1;
    return s;
  },
  trabalhador: (p) => {
    let s = 0;
    if (['C1', 'C2', 'D', 'E'].includes(p.social_class)) s += 3;
    if (['Fundamental', 'Médio'].includes(p.education_level)) s += 2;
    const cargo = p.career_json?.['atuação_e_cargo']?.cargo_atual || p.career_json?.atuacao_e_cargo?.cargo_atual || '';
    if (['Pedreiro', 'Soldador', 'Mecânico Especializado', 'Eletricista', 'Operador de Máquinas', 'Motorista de App', 'Motoboy/Entregador', 'Vendedor', 'Porteiro', 'Servente', 'Ajudante de Obra', 'Cozinheiro', 'Auxiliar de Cozinha', 'Balconista', 'Atendente'].includes(cargo)) s += 3;
    if (['Centro-Esquerda', 'Esquerda', 'Centro', 'Apolítico'].includes(p.political_leaning)) s += 1;
    return s;
  },
};

// Fallback political mapping (used when scoring isn't enough)
export const ARCHETYPE_TO_POLITICAL: Record<string, string[]> = {
  patriota_radical: ['Extrema Direita', 'Direita'],
  pastor_evangelico: ['Direita', 'Centro-Direita', 'Extrema Direita'],
  policial_militar: ['Direita', 'Centro-Direita', 'Extrema Direita'],
  militante_esquerda: ['Esquerda', 'Extrema Esquerda', 'Centro-Esquerda'],
  mae_familia: ['Centro', 'Centro-Direita', 'Centro-Esquerda'],
  jovem_periferia: ['Esquerda', 'Centro-Esquerda', 'Centro'],
  elite_indignada: ['Centro-Direita', 'Direita', 'Centro-Liberal', 'Libertário'],
  tiozao_zap: ['Direita', 'Extrema Direita', 'Centro-Direita'],
  intelectual: ['Centro-Esquerda', 'Centro', 'Esquerda'],
  trabalhador: ['Centro-Esquerda', 'Esquerda', 'Centro'],
};
