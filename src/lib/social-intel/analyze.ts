import OpenAI from 'openai';
import type {
  BeliefProfile,
  LabelConfidence,
  PlatformBreakdown,
  PoliticalProfile,
  SocialEvidence,
  SocialIntelCoverage,
  SocialIntelIndicators,
  SocialIntelInput,
  SocialProfileCard,
  SocialIntelReport,
  SocialPlatform,
} from '@/lib/social-intel/types';

interface NormalizedPost {
  platform: SocialPlatform;
  text: string;
  url?: string;
  likes?: number;
  comments?: number;
  timestamp?: string;
}

interface SourceBundle {
  platform: SocialPlatform;
  handle: string;
  profileSummary: string;
  posts: NormalizedPost[];
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  followers?: number;
}

interface AnalysisDeps {
  apifyToken: string;
  openAiKey?: string;
  actorIds?: Partial<Record<SocialPlatform, string>>;
}

interface InstagramCollectionResult {
  source: SourceBundle | null;
  discovered: Partial<SocialIntelInput>;
}

const DEFAULT_ACTORS: Record<SocialPlatform, string> = {
  instagram: 'apify/instagram-profile-scraper',
  twitter: 'apidojo/tweet-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  facebook: 'apify/facebook-posts-scraper',
};

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'do', 'da', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'sem', 'que', 'um', 'uma', 'me', 'te', 'se', 'eu', 'vc',
  'voce', 'voces', 'ele', 'ela', 'eles', 'elas', 'isso', 'isto', 'aquele', 'essa',
  'esse', 'as', 'os', 'mais', 'menos', 'muito', 'muita', 'muitas', 'muitos', 'ja',
  'tambem', 'sobre', 'so', 'ao', 'aos', 'ate', 'ou', 'mas', 'como', 'quem',
  'onde', 'quando', 'porque', 'pra', 'pro', 'nao', 'sim', 'hoje', 'ontem',
  'amanha', 'ser', 'estar', 'vai', 'vou', 'foi', 'era', 'sao', 'que', 'isso',
]);

const POLITICAL_LEFT = [
  'lula', 'pt', 'psol', 'mst', 'sindicato', 'social', 'redistribuicao',
  'imposto dos ricos', 'justica social', 'feminismo', 'antifascista',
];
const POLITICAL_RIGHT = [
  'bolsonaro', 'mito', 'agro', 'liberdade economica', 'conservador',
  'patriota', 'intervencao militar', 'anti esquerda', 'estado minimo',
  'familia tradicional',
];
const CUSTOMS_PROGRESSIVE = [
  'lgbt', 'trans', 'inclusao', 'diversidade', 'aborto legal', 'casamento igualitario',
  'direitos humanos', 'antirracista', 'clima',
];
const CUSTOMS_CONSERVATIVE = [
  'valores cristaos', 'contra aborto', 'ideologia de genero',
  'familia', 'tradicao', 'ordem',
];
const ECON_LEFT = ['estado forte', 'programa social', 'regulacao', 'subsidio'];
const ECON_RIGHT = ['livre mercado', 'empreendedorismo', 'menos imposto', 'desregulamentacao'];

const RELIGION_MAP: Record<string, string[]> = {
  Evangelica: ['jesus', 'deus', 'igreja', 'evangelho', 'pastor', 'culto', 'gospel'],
  Catolica: ['nossa senhora', 'missa', 'catolico', 'santo', 'padre', 'amem'],
  Espiritualista: ['energia', 'universo', 'lei da atracao', 'espiritualidade'],
};

const BRAZIL_TEAMS: Record<string, string[]> = {
  Flamengo: ['flamengo', 'mengao', 'mengo'],
  Corinthians: ['corinthians', 'timao', 'coringao'],
  Palmeiras: ['palmeiras', 'verdao'],
  'Sao Paulo': ['sao paulo', 'tricolor paulista'],
  Vasco: ['vasco', 'vascao'],
  Santos: ['santos fc', 'santos'],
  Gremio: ['gremio', 'imortal'],
  Internacional: ['internacional', 'inter rs', 'colorado'],
  'Atletico Mineiro': ['atletico mineiro', 'galo'],
  Cruzeiro: ['cruzeiro', 'cabulo', 'raposa'],
  Fluminense: ['fluminense', 'flu'],
  Botafogo: ['botafogo', 'fogao'],
};

const TOPIC_MAP: Record<string, string[]> = {
  Politica: ['governo', 'politica', 'eleicao', 'presidente', 'congresso', 'stf', 'esquerda', 'direita'],
  Negocios: ['negocio', 'vendas', 'cliente', 'empresa', 'empreender', 'startup', 'marketing'],
  Familia: ['familia', 'filho', 'filha', 'casamento', 'marido', 'esposa'],
  Fitness: ['treino', 'academia', 'fitness', 'corrida', 'nutricao'],
  Religiao: ['deus', 'igreja', 'oracao', 'fe'],
  Futebol: ['futebol', 'gol', 'campeonato', 'torcida', 'libertadores'],
  Tecnologia: ['ia', 'ai', 'tecnologia', 'software', 'programacao'],
  Viagem: ['viagem', 'aeroporto', 'hotel', 'praia', 'turismo'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizePlainText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s#@]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeActorId(actorId: string): string {
  return actorId.trim().replace(/\//g, '~');
}

function normalizeHandle(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const withoutDomain = withoutProtocol
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^x\.com\//i, '')
    .replace(/^twitter\.com\//i, '')
    .replace(/^tiktok\.com\/@?/i, '')
    .replace(/^facebook\.com\//i, '');

  const raw = withoutDomain.split('/').filter(Boolean)[0] || '';
  return raw.replace(/^@/, '').replace(/\?.*$/, '').trim();
}

function discoverHandlesFromText(text: string): Partial<SocialIntelInput> {
  const discovered: Partial<SocialIntelInput> = {};
  const normalized = text || '';

  const twitterUrl = normalized.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_\.]+)/i);
  if (twitterUrl?.[1]) discovered.twitter = normalizeHandle(twitterUrl[1]);

  const tiktokUrl = normalized.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?([A-Za-z0-9_\.]+)/i);
  if (tiktokUrl?.[1]) discovered.tiktok = normalizeHandle(tiktokUrl[1]);

  const facebookUrl = normalized.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9._-]+)/i);
  if (facebookUrl?.[1]) discovered.facebook = normalizeHandle(facebookUrl[1]);

  const twitterMention = normalized.match(/(?:twitter|x)\s*[:\-]?\s*@([A-Za-z0-9_\.]+)/i);
  if (!discovered.twitter && twitterMention?.[1]) discovered.twitter = normalizeHandle(twitterMention[1]);

  const tiktokMention = normalized.match(/tiktok\s*[:\-]?\s*@([A-Za-z0-9_\.]+)/i);
  if (!discovered.tiktok && tiktokMention?.[1]) discovered.tiktok = normalizeHandle(tiktokMention[1]);

  const facebookMention = normalized.match(/facebook\s*[:\-]?\s*([A-Za-z0-9._-]+)/i);
  if (!discovered.facebook && facebookMention?.[1]) discovered.facebook = normalizeHandle(facebookMention[1]);

  return discovered;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runApifyActor(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<unknown[]> {
  const encodedActor = encodeActorId(actorId);
  const url = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Apify actor falhou (${actorId}): ${response.status} ${detail}`);
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? data : [];
}

async function runActorWithFallbackInputs(
  token: string,
  actorId: string,
  inputCandidates: Record<string, unknown>[],
): Promise<unknown[]> {
  const errors: string[] = [];
  for (const input of inputCandidates) {
    try {
      const items = await runApifyActor(token, actorId, input);
      if (items.length > 0) return items;
    } catch (error: unknown) {
      errors.push(getErrorMessage(error));
    }
  }
  if (errors.length > 0) throw new Error(errors[errors.length - 1]);
  return [];
}

function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumeric(item: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = asNumber(item[key]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function normalizeGenericPosts(platform: SocialPlatform, items: unknown[]): NormalizedPost[] {
  const posts: NormalizedPost[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const text = pickString(item, [
      'caption',
      'text',
      'fullText',
      'description',
      'message',
      'title',
      'postText',
    ]);
    if (!text) continue;

    const url = pickString(item, ['url', 'postUrl', 'link', 'displayUrl', 'videoUrl']);
    const timestamp = pickString(item, ['timestamp', 'createdAt', 'time']);

    posts.push({
      platform,
      text: text.slice(0, 1500),
      ...(url ? { url } : {}),
      likes: pickNumeric(item, ['likesCount', 'likes', 'diggCount', 'reactionsCount']),
      comments: pickNumeric(item, ['commentsCount', 'comments', 'commentCount']),
      ...(timestamp ? { timestamp } : {}),
    });
  }

  return posts;
}

function scoreFromKeywords(texts: string[], positive: string[], negative: string[], scale: number): number {
  const pos = countKeywordMatches(texts, positive);
  const neg = countKeywordMatches(texts, negative);
  return clamp((pos - neg) * scale, -100, 100);
}

function countKeywordMatches(texts: string[], keywords: string[]): number {
  let count = 0;
  for (const text of texts) {
    const normalized = normalizePlainText(text);
    for (const keyword of keywords) {
      if (normalized.includes(normalizePlainText(keyword))) count += 1;
    }
  }
  return count;
}

function buildRanked(map: Record<string, number>, maxItems = 5): LabelConfidence[] {
  const total = Object.values(map).reduce((acc, n) => acc + n, 0) || 1;
  return Object.entries(map)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label, score]) => ({
      label,
      confidence: clamp(Math.round((score / total) * 100), 1, 99),
    }));
}

function tokenize(texts: string[]): string[] {
  const all = normalizePlainText(texts.join(' '));
  return all
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function extractTopInterests(texts: string[], maxItems = 8): LabelConfidence[] {
  const hashtags: Record<string, number> = {};
  for (const text of texts) {
    const normalized = normalizePlainText(text);
    const matches = normalized.match(/#[\p{L}\p{N}_]+/gu) || [];
    for (const tag of matches) {
      hashtags[tag] = (hashtags[tag] || 0) + 1;
    }
  }
  const topHashtags = buildRanked(hashtags, Math.floor(maxItems / 2));

  const tokens = tokenize(texts);
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    if (token.startsWith('#') || token.startsWith('@')) continue;
    counts[token] = (counts[token] || 0) + 1;
  }

  const topWords = buildRanked(counts, maxItems);
  return [...topHashtags, ...topWords].slice(0, maxItems);
}

function extractTopTopics(texts: string[]): LabelConfidence[] {
  const topicScores: Record<string, number> = {};
  for (const [topic, words] of Object.entries(TOPIC_MAP)) {
    topicScores[topic] = countKeywordMatches(texts, words);
  }
  return buildRanked(topicScores, 6);
}

function buildLikelyPoliticalSide(score: number): LabelConfidence[] {
  if (score > 25) {
    return [
      { label: 'Direita', confidence: clamp(56 + Math.round(score / 2), 56, 95) },
      { label: 'Centro-direita', confidence: clamp(20 + Math.round(score / 4), 10, 70) },
      { label: 'Centro', confidence: 10 },
    ];
  }
  if (score < -25) {
    return [
      { label: 'Esquerda', confidence: clamp(56 + Math.round(Math.abs(score) / 2), 56, 95) },
      { label: 'Centro-esquerda', confidence: clamp(20 + Math.round(Math.abs(score) / 4), 10, 70) },
      { label: 'Centro', confidence: 10 },
    ];
  }
  return [
    { label: 'Centro', confidence: 58 },
    { label: 'Centro-direita', confidence: 22 },
    { label: 'Centro-esquerda', confidence: 20 },
  ];
}

function buildAxisLabel(score: number, negative: string, middle: string, positive: string): string {
  if (score <= -25) return negative;
  if (score >= 25) return positive;
  return middle;
}

function buildContradictions(platforms: PlatformBreakdown[]): string[] {
  if (platforms.length < 2) return [];

  const contradictions: string[] = [];
  const sorted = [...platforms].sort((a, b) => a.platform.localeCompare(b.platform));

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const politicalGap = Math.abs(a.politicalScore - b.politicalScore);
      const religionGap = Math.abs(a.religiosityScore - b.religiosityScore);

      if (politicalGap >= 45) {
        contradictions.push(
          `Sinal politico divergente entre ${a.platform} (${a.politicalScore}) e ${b.platform} (${b.politicalScore}).`,
        );
      }
      if (religionGap >= 45) {
        contradictions.push(
          `Intensidade religiosa muito diferente entre ${a.platform} (${a.religiosityScore}) e ${b.platform} (${b.religiosityScore}).`,
        );
      }
    }
  }

  return contradictions.slice(0, 5);
}

function buildRecommendations(indicators: SocialIntelIndicators, topTopics: LabelConfidence[]): string[] {
  const recommendations: string[] = [];

  if (Math.abs(indicators.politicalOrientationScore) >= 45) {
    recommendations.push('Abordar temas politicos com linguagem objetiva e sem confronto frontal.');
  } else {
    recommendations.push('Usar abordagem pragmatica, sem posicionamento ideologico agressivo.');
  }

  if (indicators.religiosityScore >= 50) {
    recommendations.push('Usar tom respeitoso com valores tradicionais e evitar ironia sobre fe.');
  }

  if (indicators.polarizationScore >= 65) {
    recommendations.push('Comecar conversa por objetivos praticos antes de temas sensiveis.');
  }

  const topical = topTopics[0]?.label;
  if (topical) recommendations.push(`Abrir conversa por ${topical.toLowerCase()} para ganhar rapport rapido.`);

  recommendations.push('Validar as hipoteses com 2-3 perguntas diretas antes de assumir perfil fechado.');
  return recommendations.slice(0, 5);
}

function computePlatformBreakdown(sources: SourceBundle[]): PlatformBreakdown[] {
  return sources.map((source) => {
    const texts = source.posts.map((p) => p.text);
    const politicalScore = scoreFromKeywords(texts, POLITICAL_RIGHT, POLITICAL_LEFT, 8);
    const religiosityScore = clamp(
      Object.values(RELIGION_MAP).reduce((acc, words) => acc + countKeywordMatches(texts, words), 0) * 12,
      0,
      100,
    );
    const polarizationScore = clamp(
      countKeywordMatches(texts, ['absurdo', 'vergonha', 'nunca', 'sempre', 'ridiculo', 'lixo']) * 8,
      0,
      100,
    );

    return {
      platform: source.platform,
      postsAnalyzed: source.posts.length,
      topTopics: extractTopTopics(texts).slice(0, 3),
      politicalScore,
      religiosityScore,
      polarizationScore,
    };
  });
}

function buildPoliticalProfile(indicators: SocialIntelIndicators, topTopics: LabelConfidence[]): PoliticalProfile {
  return {
    primarySide: indicators.likelyPoliticalSide[0]?.label || 'Centro',
    sideConfidence: indicators.likelyPoliticalSide[0]?.confidence || indicators.confidence,
    economicAxis: buildAxisLabel(
      indicators.economicScore,
      'Mais estatista',
      'Centro economico',
      'Mais pro-mercado',
    ),
    customsAxis: buildAxisLabel(
      indicators.customsScore,
      'Mais progressista',
      'Centro em costumes',
      'Mais conservador',
    ),
    summary: `Tendencia ${indicators.likelyPoliticalSide[0]?.label || 'de centro'} com score politico ${indicators.politicalOrientationScore}.`,
    keySignals: topTopics.slice(0, 4).map((topic) => `Tema dominante: ${topic.label} (${topic.confidence}%)`),
  };
}

function buildBeliefProfile(indicators: SocialIntelIndicators, topTopics: LabelConfidence[]): BeliefProfile {
  return {
    religion: indicators.likelyReligions[0]?.label || 'Sem sinal forte',
    favoriteTeam: indicators.likelyTeams[0]?.label || 'Sem sinal forte',
    coreValues: [
      buildAxisLabel(indicators.customsScore, 'Pluralismo social', 'Equilibrio de valores', 'Tradicao e ordem'),
      buildAxisLabel(indicators.economicScore, 'Protecao estatal', 'Pragmatismo economico', 'Meritocracia e mercado'),
    ],
    ideologicalBeliefs: [
      `Polarizacao estimada: ${indicators.polarizationScore}/100`,
      `Consistencia cross-platform: ${indicators.consistencyScore}/100`,
      ...topTopics.slice(0, 2).map((topic) => `Interesse recorrente em ${topic.label.toLowerCase()}`),
    ],
  };
}

async function collectInstagram(
  token: string,
  actorId: string,
  handle: string,
): Promise<InstagramCollectionResult> {
  const dataset = await runActorWithFallbackInputs(token, actorId, [
    { usernames: [handle] },
    { usernames: [`@${handle}`] },
  ]);
  if (!dataset.length) return { source: null, discovered: {} };

  const profile = dataset[0] as Record<string, unknown>;
  const latestPosts = Array.isArray(profile.latestPosts) ? profile.latestPosts : [];
  const firstPostImage = latestPosts.find((post) => {
    if (!post || typeof post !== 'object') return false;
    const p = post as Record<string, unknown>;
    return Boolean(asText(p.displayUrl));
  }) as Record<string, unknown> | undefined;
  const posts = latestPosts
    .map((post) => {
      if (!post || typeof post !== 'object') return null;
      const p = post as Record<string, unknown>;
      const text = asText(p.caption);
      if (!text) return null;
      return {
        platform: 'instagram' as const,
        text: text.slice(0, 1500),
        url: pickString(p, ['url', 'displayUrl']),
        likes: pickNumeric(p, ['likesCount', 'likes']),
        comments: pickNumeric(p, ['commentsCount', 'comments']),
      };
    })
    .filter((post) => post !== null) as NormalizedPost[];

  const profileSummary = [
    `Nome: ${asText(profile.fullName) || 'N/A'}`,
    `Bio: ${asText(profile.biography) || 'N/A'}`,
    `Seguidores: ${asNumber(profile.followersCount) ?? 'N/A'}`,
    `Seguindo: ${asNumber(profile.followsCount) ?? 'N/A'}`,
    `Posts: ${asNumber(profile.postsCount) ?? 'N/A'}`,
  ].join(' | ');

  const discovered = discoverHandlesFromText([
    asText(profile.biography),
    asText(profile.externalUrl),
    pickString(profile, ['externalUrls', 'bioLinks']),
  ].join(' '));

  return {
    source: {
      platform: 'instagram',
      handle,
      profileSummary,
      posts,
      displayName: asText(profile.fullName) || handle,
      avatarUrl:
        asText(profile.profilePicUrlHD) ||
        asText(profile.profilePicUrl) ||
        (firstPostImage ? asText(firstPostImage.displayUrl) : ''),
      profileUrl: `https://www.instagram.com/${handle}/`,
      followers: asNumber(profile.followersCount),
    },
    discovered,
  };
}

async function collectTwitter(token: string, actorId: string, handle: string): Promise<SourceBundle | null> {
  const dataset = await runActorWithFallbackInputs(token, actorId, [
    { searchTerms: [`from:${handle}`], maxItems: 120, sort: 'Latest' },
    { handles: [handle], maxItems: 120 },
    { usernames: [handle], maxItems: 120 },
  ]);

  if (!dataset.length) return null;
  const posts = normalizeGenericPosts('twitter', dataset);

  return {
    platform: 'twitter',
    handle,
    profileSummary: `X/Twitter: @${handle} | itens coletados: ${dataset.length}`,
    posts,
    displayName: `@${handle}`,
    profileUrl: `https://x.com/${handle}`,
  };
}

async function collectTikTok(token: string, actorId: string, handle: string): Promise<SourceBundle | null> {
  const dataset = await runActorWithFallbackInputs(token, actorId, [
    { profiles: [handle], resultsPerPage: 100, shouldDownloadVideos: false },
    { usernames: [handle], resultsPerPage: 100 },
    { profileNames: [handle], maxItems: 100 },
  ]);

  if (!dataset.length) return null;
  const posts = normalizeGenericPosts('tiktok', dataset);

  return {
    platform: 'tiktok',
    handle,
    profileSummary: `TikTok: @${handle} | itens coletados: ${dataset.length}`,
    posts,
    displayName: `@${handle}`,
    profileUrl: `https://www.tiktok.com/@${handle}`,
  };
}

async function collectFacebook(token: string, actorId: string, handle: string): Promise<SourceBundle | null> {
  const dataset = await runActorWithFallbackInputs(token, actorId, [
    { startUrls: [{ url: `https://www.facebook.com/${handle}` }], resultsLimit: 80 },
    { pages: [handle], resultsLimit: 80 },
    { profiles: [handle], maxItems: 80 },
  ]);

  if (!dataset.length) return null;
  const posts = normalizeGenericPosts('facebook', dataset);

  return {
    platform: 'facebook',
    handle,
    profileSummary: `Facebook: ${handle} | itens coletados: ${dataset.length}`,
    posts,
    displayName: handle,
    profileUrl: `https://www.facebook.com/${handle}`,
  };
}

function buildHeuristicReport(sources: SourceBundle[], warnings: string[]): SocialIntelReport {
  const allPosts = sources.flatMap((s) => s.posts);
  const texts = allPosts.map((p) => p.text);
  const profileSummaries = sources.map((s) => `[${s.platform}] ${s.profileSummary}`);
  const allTexts = [...texts, ...profileSummaries];

  const politicalOrientationScore = scoreFromKeywords(allTexts, POLITICAL_RIGHT, POLITICAL_LEFT, 8);
  const customsScore = scoreFromKeywords(allTexts, CUSTOMS_CONSERVATIVE, CUSTOMS_PROGRESSIVE, 10);
  const economicScore = scoreFromKeywords(allTexts, ECON_RIGHT, ECON_LEFT, 11);

  const religionScores: Record<string, number> = {};
  for (const [religion, words] of Object.entries(RELIGION_MAP)) {
    religionScores[religion] = countKeywordMatches(allTexts, words);
  }
  const likelyReligions = buildRanked(religionScores, 3);
  const religiosityScore = clamp(
    Object.values(religionScores).reduce((acc, n) => acc + n, 0) * 12,
    0,
    100,
  );

  const teamScores: Record<string, number> = {};
  for (const [team, words] of Object.entries(BRAZIL_TEAMS)) {
    teamScores[team] = countKeywordMatches(allTexts, words);
  }
  const likelyTeams = buildRanked(teamScores, 3);

  const polarizationScore = clamp(
    (Math.abs(politicalOrientationScore) / 2) +
      (countKeywordMatches(allTexts, ['absurdo', 'vergonha', 'nunca', 'sempre', 'ridiculo', 'cancelar', 'lixo']) * 5),
    0,
    100,
  );

  const topInterests = extractTopInterests(allTexts, 10);
  const topTopics = extractTopTopics(allTexts);
  const likelyPoliticalSide = buildLikelyPoliticalSide(politicalOrientationScore);

  const evidence: SocialEvidence[] = allPosts
    .filter((p) => p.text.length > 50)
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 14)
    .map((p) => ({
      platform: p.platform,
      excerpt: p.text.slice(0, 260),
      ...(p.url ? { url: p.url } : {}),
    }));

  const platformBreakdown = computePlatformBreakdown(sources);
  const profiles: SocialProfileCard[] = sources.map((source) => ({
    platform: source.platform,
    handle: source.handle,
    ...(source.displayName ? { displayName: source.displayName } : {}),
    ...(source.avatarUrl ? { avatarUrl: source.avatarUrl } : {}),
    ...(source.profileUrl ? { profileUrl: source.profileUrl } : {}),
    ...(typeof source.followers === 'number' ? { followers: source.followers } : {}),
  }));
  const politicalSpread = platformBreakdown.map((p) => p.politicalScore);
  const spread = politicalSpread.length
    ? Math.max(...politicalSpread) - Math.min(...politicalSpread)
    : 0;
  const consistencyScore = clamp(100 - spread, 20, 100);

  const confidence = clamp(
    Math.round(28 + (allPosts.length * 1.3) + (sources.length * 11) + (consistencyScore * 0.2)),
    20,
    98,
  );

  const indicators: SocialIntelIndicators = {
    politicalOrientationScore,
    customsScore,
    economicScore,
    religiosityScore,
    polarizationScore,
    consistencyScore,
    likelyPoliticalSide,
    likelyReligions: likelyReligions.length ? likelyReligions : [{ label: 'Sem sinal forte', confidence: 45 }],
    likelyTeams: likelyTeams.length ? likelyTeams : [{ label: 'Sem sinal forte', confidence: 40 }],
    confidence,
  };

  const coverage: SocialIntelCoverage = {
    profilesAnalyzed: sources.length,
    platformsAnalyzed: sources.map((s) => s.platform),
    totalPostsAnalyzed: allPosts.length,
    totalTextsAnalyzed: allTexts.length,
  };

  const politicalLabel =
    politicalOrientationScore > 25 ? 'inclinacao a direita' :
      politicalOrientationScore < -25 ? 'inclinacao a esquerda' : 'inclinacao ao centro';

  const contradictions = buildContradictions(platformBreakdown);
  const politicalProfile = buildPoliticalProfile(indicators, topTopics);
  const beliefProfile = buildBeliefProfile(indicators, topTopics);
  const recommendations = buildRecommendations(indicators, topTopics);

  const quickSummary = [
    `Analise baseada em ${allPosts.length} posts publicos e ${sources.length} perfis.`,
    `Tendencia politica provavel: ${likelyPoliticalSide[0]?.label || 'Centro'} (${indicators.confidence}% de confianca).`,
    `Panorama politico: ${politicalLabel} com score ${politicalOrientationScore}.`,
    `Religiao provavel: ${indicators.likelyReligions[0]?.label || 'Sem sinal forte'}.`,
    `Time provavel: ${indicators.likelyTeams[0]?.label || 'Sem sinal forte'}.`,
    `Interesses dominantes: ${topInterests.slice(0, 5).map((x) => x.label).join(', ') || 'nao identificados'}.`,
  ];

  return {
    quickSummary,
    executiveSummary:
      'Perfil construído com sinais públicos de conteúdo, linguagem e temas recorrentes em múltiplas redes. Use como mapa probabilístico.',
    detailed: {
      identity:
        `A presenca digital sugere foco em ${topTopics.slice(0, 2).map((x) => x.label).join(' e ') || 'temas variados'}, com interesses em ${topInterests.slice(0, 5).map((x) => x.label).join(', ')}.`,
      politicalPanorama:
        `Score politico ${politicalOrientationScore}, score de costumes ${customsScore} e score economico ${economicScore}. Predomina ${politicalLabel}.`,
      beliefs:
        `Sinais de crenca: ${indicators.likelyReligions.map((r) => `${r.label} (${r.confidence}%)`).join(', ')}. Consistencia entre redes: ${consistencyScore}/100.`,
      interests:
        `Os principais interesses observados foram ${topInterests.slice(0, 10).map((x) => x.label).join(', ')}.`,
      communicationStyle:
        `Polarizacao estimada em ${polarizationScore}/100. A linguagem aparenta ${polarizationScore > 65 ? 'alto vies de confronto' : 'tom misto com confronto pontual'}.`,
    },
    indicators,
    topInterests,
    topTopics,
    evidence,
    profiles,
    platformBreakdown,
    politicalProfile,
    beliefProfile,
    contradictions,
    recommendations,
    coverage,
    warnings,
  };
}

function stripCodeFence(content: string): string {
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
}

function tryParseJson<T>(content: string): T | null {
  const cleaned = stripCodeFence(content);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function enrichWithOpenAI(base: SocialIntelReport, apiKey: string): Promise<SocialIntelReport> {
  const client = new OpenAI({ apiKey });
  const prompt = `
Voce e um analista senior de inteligencia social.
Receba o relatorio heuristico e devolva um JSON mais util para decisao.

Regras:
- Portugues do Brasil.
- Nao invente fatos fora das evidencias.
- Mantenha os indicadores numericos (nao inventar novos valores).
- Deixe recomendacoes praticas e objetivas.

JSON de entrada:
${JSON.stringify(base)}

Retorne APENAS JSON valido com os mesmos campos:
quickSummary, executiveSummary, detailed, indicators, topInterests, topTopics,
evidence, profiles, platformBreakdown, politicalProfile, beliefProfile, contradictions,
recommendations, coverage, warnings.
`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.25,
    max_tokens: 2600,
    messages: [
      { role: 'system', content: 'Voce transforma sinais sociais em diagnostico objetivo e acionavel.' },
      { role: 'user', content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content || '';
  const parsed = tryParseJson<SocialIntelReport>(text);
  if (!parsed) return base;

  return {
    ...base,
    ...parsed,
    indicators: { ...base.indicators, ...(parsed.indicators || {}) },
    warnings: Array.from(new Set([...(base.warnings || []), ...(parsed.warnings || [])])),
  };
}

export async function runSocialIntelligenceAnalysis(
  input: SocialIntelInput,
  deps: AnalysisDeps,
): Promise<SocialIntelReport> {
  const warnings: string[] = [];
  const handles: SocialIntelInput = {
    instagram: normalizeHandle(input.instagram),
    twitter: normalizeHandle(input.twitter),
    tiktok: normalizeHandle(input.tiktok),
    facebook: normalizeHandle(input.facebook),
  };

  const actorIds = { ...DEFAULT_ACTORS, ...(deps.actorIds || {}) };
  const sources: SourceBundle[] = [];
  const discoveredHandles: Partial<SocialIntelInput> = {};

  if (handles.instagram) {
    try {
      const result = await collectInstagram(deps.apifyToken, actorIds.instagram, handles.instagram);
      if (result.source && result.source.posts.length) sources.push(result.source);
      else warnings.push('Instagram: sem conteudo textual suficiente para analise.');
      Object.assign(discoveredHandles, result.discovered);
    } catch (error: unknown) {
      warnings.push(`Instagram: ${getErrorMessage(error)}`);
    }
  }

  const optionalCollectors: Array<{
    platform: Exclude<SocialPlatform, 'instagram'>;
    handle?: string;
    collector: (token: string, actorId: string, handle: string) => Promise<SourceBundle | null>;
  }> = [
    { platform: 'twitter', handle: handles.twitter, collector: collectTwitter },
    { platform: 'tiktok', handle: handles.tiktok, collector: collectTikTok },
    { platform: 'facebook', handle: handles.facebook, collector: collectFacebook },
  ];

  await Promise.all(
    optionalCollectors.map(async ({ platform, handle, collector }) => {
      let resolvedHandle = handle;
      if (!resolvedHandle && discoveredHandles[platform]) {
        resolvedHandle = discoveredHandles[platform];
      }
      if (!resolvedHandle && handles.instagram) {
        resolvedHandle = handles.instagram;
      }
      if (!resolvedHandle) return;
      const actorId = actorIds[platform];

      try {
        const source = await collector(deps.apifyToken, actorId, resolvedHandle);
        if (source && source.posts.length) sources.push(source);
        else warnings.push(`${platform}: sem conteudo textual suficiente para analise.`);
      } catch (error: unknown) {
        warnings.push(`${platform}: ${getErrorMessage(error)}`);
      }
    }),
  );

  if (!sources.length) {
    throw new Error('Nenhum dado pode ser coletado. Verifique os handles informados.');
  }

  const baseReport = buildHeuristicReport(sources, warnings);
  if (!deps.openAiKey) {
    baseReport.warnings.push('OPENAI_API_KEY nao configurada. Resultado gerado sem enriquecimento LLM.');
    return baseReport;
  }

  try {
    return await enrichWithOpenAI(baseReport, deps.openAiKey);
  } catch (error: unknown) {
    baseReport.warnings.push(`OpenAI: ${getErrorMessage(error)}`);
    return baseReport;
  }
}
