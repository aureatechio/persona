// Arena PWA — Constants (ported from mobile)

import type { SegmentItem } from './types';

function z(label: string): SegmentItem {
  return { label, count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 0 };
}

export const EMPTY_SEGMENTS = {
  gender: [z('Masculino'), z('Feminino')],
  religion: [z('Católico'), z('Evangélico/Protestante'), z('Sem religião'), z('Espírita (Kardecista)'), z('Ateu/Agnóstico'), z('Umbanda/Candomblé'), z('Espiritualidade Eclética'), z('Outros')],
  race: [z('Branco'), z('Pardo'), z('Preto'), z('Amarelo'), z('Indígena')],
  region: [z('Sudeste'), z('Nordeste'), z('Sul'), z('Norte'), z('Centro-Oeste')],
  generation: [z('Gen Z'), z('Millennial'), z('Gen X'), z('Boomer')],
  socialClass: [z('Classe A'), z('Classe B'), z('Classe C'), z('Classe D'), z('Classe E')],
  education: [z('Superior Completo'), z('Médio'), z('Fundamental'), z('Mestrado/Doutorado'), z('Pós-Graduação/MBA')],
  politicalLeaning: [z('Centro'), z('Centro-Direita'), z('Centro-Esquerda'), z('Direita'), z('Esquerda'), z('Extrema Direita'), z('Extrema Esquerda'), z('Centro-Liberal'), z('Libertário')],
  voto2022: [z('Lula'), z('Bolsonaro'), z('Nulo/Branco'), z('Ciro'), z('Tebet'), z('Não votou')],
  aprovacaoLula: [z('Aprova'), z('Desaprova'), z('Neutro')],
  voto2026: [z('Lula'), z('Bolsonaro'), z('Outros'), z('Indeciso')],
  archetype: [z('O Cidadão Comum'), z('O Governante'), z('O Cuidador'), z('O Herói'), z('O Rebelde'), z('O Sábio')],
  clusterMacro: [z('Progressista'), z('Moderado'), z('Conservador'), z('Transversal')],
  scoreEco: [z('Esquerda Forte'), z('Centro-Esquerda'), z('Centro'), z('Centro-Direita'), z('Direita Forte')],
  scoreCost: [z('Progressista Forte'), z('Progressista'), z('Centro'), z('Conservador'), z('Conservador Forte')],
};

export const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
};

export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#e879f9' },
  { id: 'youtube', label: 'YouTube', color: '#f87171' },
  { id: 'tiktok', label: 'TikTok', color: '#22d3ee' },
  { id: 'x', label: 'X (Twitter)', color: '#a3a3a3' },
  { id: 'tv', label: 'TV', color: '#38bdf8' },
  { id: 'radio', label: 'Rádio', color: '#fbbf24' },
  { id: 'outdoor', label: 'Outdoor', color: '#34d399' },
  { id: 'impresso', label: 'Impresso', color: '#a1a1aa' },
] as const;

export const BRAZILIAN_STATES = [
  { value: 'brasil', label: 'Brasil (Nacional)' },
  { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' },
  { value: 'AM', label: 'Amazonas' }, { value: 'AP', label: 'Amapá' },
  { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' }, { value: 'MA', label: 'Maranhão' },
  { value: 'MG', label: 'Minas Gerais' }, { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MT', label: 'Mato Grosso' }, { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' }, { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' }, { value: 'PR', label: 'Paraná' },
  { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' },
  { value: 'RS', label: 'Rio Grande do Sul' }, { value: 'SC', label: 'Santa Catarina' },
  { value: 'SE', label: 'Sergipe' }, { value: 'SP', label: 'São Paulo' },
  { value: 'TO', label: 'Tocantins' },
];

export function scoreToEmoji(score: number): string {
  if (score <= 1) return '💣';
  if (score <= 3) return '😡';
  if (score <= 5) return '😐';
  if (score <= 7) return '👍';
  if (score <= 9) return '❤️';
  return '🔥';
}

export function scoreToLabel(score: number): string {
  if (score <= 1) return 'Rejeição total';
  if (score <= 3) return 'Rejeição';
  if (score <= 5) return 'Indiferença';
  if (score <= 7) return 'Aceitou';
  if (score <= 9) return 'Gostou';
  return 'Impacto máximo';
}

export function scoreToHex(score: number): string {
  const s = Math.max(0, Math.min(10, score));
  if (s <= 3) {
    const t = s / 3;
    return `rgb(${Math.round(251)},${Math.round(113 + 33 * t)},${Math.round(133 - 73 * t)})`;
  }
  if (s <= 5) {
    const t = (s - 3) / 2;
    return `rgb(251,${Math.round(146 + 45 * t)},${Math.round(60 - 24 * t)})`;
  }
  if (s <= 7) {
    const t = (s - 5) / 2;
    return `rgb(${Math.round(251 - 199 * t)},${Math.round(191 + 20 * t)},${Math.round(36 + 117 * t)})`;
  }
  const t = (s - 7) / 3;
  return `rgb(${Math.round(52 + 58 * t)},${Math.round(211 + 20 * t)},${Math.round(153 + 30 * t)})`;
}
