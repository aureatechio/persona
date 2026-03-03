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
  actorIds?: Partial<Record<SocialPlatform, string[]>>;
}

// InstagramCollectionResult is now unified as CollectionResult (defined near collectTwitter)

const DEFAULT_ACTORS: Record<SocialPlatform, string[]> = {
  instagram: ['apify/instagram-profile-scraper'],
  twitter: ['apidojo/tweet-scraper'],
  tiktok: ['clockworks/tiktok-scraper'],
  facebook: ['apify/facebook-posts-scraper'],
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
  return raw
    .replace(/^@/, '')
    .replace(/\?.*$/, '')
    .replace(/\s+/g, '')
    .trim();
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
  timeoutMs = 70000,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const encodedActor = encodeActorId(actorId);
  const url = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Apify actor falhou (${actorId}): ${response.status} ${detail}`);
    }

    const data: unknown = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Apify actor timeout (${actorId}) apos ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runActorWithFallbackInputs(
  token: string,
  actorIds: string[],
  inputCandidates: Record<string, unknown>[],
): Promise<unknown[]> {
  const errors: string[] = [];
  for (const actorId of actorIds) {
    for (const input of inputCandidates) {
      try {
        const items = await runApifyActor(token, actorId, input);
        if (items.length > 0) return items;
      } catch (error: unknown) {
        errors.push(`${actorId}: ${getErrorMessage(error)}`);
      }
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

function extractProfileFallbackText(items: unknown[]): string {
  if (!items.length) return '';
  const first = items[0];
  if (!first || typeof first !== 'object') return '';
  const item = first as Record<string, unknown>;
  const parts = [
    pickString(item, ['fullName', 'name', 'userName', 'username']),
    pickString(item, ['biography', 'bio', 'description', 'about']),
    pickString(item, ['category', 'pageCategory']),
  ].filter(Boolean);
  return parts.join(' | ').slice(0, 1200);
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
  actorIds: string[],
  handle: string,
): Promise<CollectionResult> {
  const dataset = await runActorWithFallbackInputs(token, actorIds, [
    { usernames: [handle] },
    { usernames: [`@${handle}`] },
    { usernames: [handle], resultsLimit: 30 },
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

interface CollectionResult {
  source: SourceBundle | null;
  discovered: Partial<SocialIntelInput>;
}

async function collectTwitter(
  token: string,
  actorIds: string[],
  handle: string,
  profileUrl?: string,
): Promise<CollectionResult> {
  const url = profileUrl || `https://x.com/${handle}`;
  const dataset = await runActorWithFallbackInputs(token, actorIds, [
    { searchTerms: [`from:${handle}`], maxItems: 120, sort: 'Latest' },
    { handles: [handle], maxItems: 120 },
    { usernames: [handle], maxItems: 120 },
    { startUrls: [{ url }], maxItems: 120 },
  ]);

  if (!dataset.length) return { source: null, discovered: {} };
  const posts = normalizeGenericPosts('twitter', dataset);
  if (!posts.length) {
    const fallback = extractProfileFallbackText(dataset);
    if (fallback) posts.push({ platform: 'twitter', text: fallback });
  }

  const first = dataset[0] as Record<string, unknown>;
  const avatarUrl = pickString(first, ['profileImageUrl', 'profileImageUrlHttps', 'avatar', 'userProfileImageUrl', 'profilePicUrl']);
  const displayName = pickString(first, ['name', 'fullName', 'userName', 'username']) || `@${handle}`;
  const followers = pickNumeric(first, ['followersCount', 'followers', 'followersNum', 'userFollowersCount']);
  const bio = pickString(first, ['description', 'bio', 'biography', 'userDescription']);

  const discovered = discoverHandlesFromText(bio);

  return {
    source: {
      platform: 'twitter',
      handle,
      profileSummary: `X/Twitter: @${handle} | itens coletados: ${dataset.length}`,
      posts,
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
      profileUrl: `https://x.com/${handle}`,
      ...(followers !== undefined ? { followers } : {}),
    },
    discovered,
  };
}

async function collectTikTok(
  token: string,
  actorIds: string[],
  handle: string,
  profileUrl?: string,
): Promise<CollectionResult> {
  const url = profileUrl || `https://www.tiktok.com/@${handle}`;
  const dataset = await runActorWithFallbackInputs(token, actorIds, [
    { profiles: [handle], resultsPerPage: 100, shouldDownloadVideos: false },
    { usernames: [handle], resultsPerPage: 100 },
    { profileNames: [handle], maxItems: 100 },
    { startUrls: [{ url }], maxItems: 100 },
  ]);

  if (!dataset.length) return { source: null, discovered: {} };
  const posts = normalizeGenericPosts('tiktok', dataset);
  if (!posts.length) {
    const fallback = extractProfileFallbackText(dataset);
    if (fallback) posts.push({ platform: 'tiktok', text: fallback });
  }

  const first = dataset[0] as Record<string, unknown>;
  const authorMeta = (first.authorMeta && typeof first.authorMeta === 'object' ? first.authorMeta : {}) as Record<string, unknown>;
  const avatarUrl = pickString(first, ['avatarUrl', 'avatar', 'profilePicUrl']) || pickString(authorMeta, ['avatar', 'avatarLarger', 'avatarMedium']);
  const displayName = pickString(first, ['nickname', 'name', 'authorName']) || pickString(authorMeta, ['nickName', 'name']) || `@${handle}`;
  const followers = pickNumeric(first, ['fans', 'followersCount', 'followers']) ?? pickNumeric(authorMeta, ['fans', 'followers']);
  const bio = pickString(first, ['signature', 'bio', 'description']) || pickString(authorMeta, ['signature']);

  const discovered = discoverHandlesFromText(bio);

  return {
    source: {
      platform: 'tiktok',
      handle,
      profileSummary: `TikTok: @${handle} | itens coletados: ${dataset.length}`,
      posts,
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
      profileUrl: `https://www.tiktok.com/@${handle}`,
      ...(followers !== undefined ? { followers } : {}),
    },
    discovered,
  };
}

async function collectFacebook(
  token: string,
  actorIds: string[],
  handle: string,
  profileUrl?: string,
): Promise<CollectionResult> {
  const url = profileUrl || `https://www.facebook.com/${handle}`;
  const dataset = await runActorWithFallbackInputs(token, actorIds, [
    { startUrls: [{ url }], resultsLimit: 80 },
    { startUrls: [url], resultsLimit: 80 },
    { urls: [url], resultsLimit: 80 },
    { pages: [url], resultsLimit: 80 },
    { pages: [handle], resultsLimit: 80 },
    { profiles: [handle], maxItems: 80 },
    { usernames: [handle], maxItems: 80 },
  ]);

  if (!dataset.length) return { source: null, discovered: {} };
  const posts = normalizeGenericPosts('facebook', dataset);
  if (!posts.length) {
    const fallback = extractProfileFallbackText(dataset);
    if (fallback) posts.push({ platform: 'facebook', text: fallback });
  }

  const first = dataset[0] as Record<string, unknown>;
  const avatarUrl = pickString(first, ['profilePicUrl', 'profilePic', 'avatar', 'pageLogo', 'profileImage']);
  const displayName = pickString(first, ['pageName', 'name', 'fullName', 'userName']) || handle;
  const followers = pickNumeric(first, ['likes', 'followersCount', 'followers', 'pageLikes']);
  const about = pickString(first, ['about', 'description', 'bio', 'pageAbout', 'info']);

  const discovered = discoverHandlesFromText(about);

  return {
    source: {
      platform: 'facebook',
      handle,
      profileSummary: `Facebook: ${handle} | itens coletados: ${dataset.length}`,
      posts,
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
      profileUrl: `https://www.facebook.com/${handle}`,
      ...(followers !== undefined ? { followers } : {}),
    },
    discovered,
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

function buildEmptyReport(handles: SocialIntelInput, warnings: string[]): SocialIntelReport {
  const normalizedWarnings = Array.from(new Set(warnings));
  const platforms: SocialPlatform[] = ['instagram', 'twitter', 'tiktok', 'facebook'];
  const platformBreakdown: PlatformBreakdown[] = platforms.map((platform) => ({
    platform,
    postsAnalyzed: 0,
    topTopics: [],
    politicalScore: 0,
    religiosityScore: 0,
    polarizationScore: 0,
  }));

  const profiles: SocialProfileCard[] = platforms
    .filter((platform) => Boolean(handles[platform]))
    .map((platform) => ({
      platform,
      handle: handles[platform] as string,
      displayName: handles[platform] as string,
    }));

  return {
    quickSummary: [
      'Nenhum conteúdo público textual foi retornado pelos scrapers para os handles informados.',
      'Revise se os perfis estão públicos e com publicações visíveis sem login.',
      'Tente também informar manualmente os handles de Twitter, TikTok e Facebook.',
    ],
    executiveSummary:
      'A análise não conseguiu montar evidências porque os coletores retornaram vazio nas plataformas consultadas.',
    detailed: {
      identity: 'Sem dados suficientes para inferir identidade digital.',
      politicalPanorama: 'Sem evidências para estimar orientação política.',
      beliefs: 'Sem evidências para inferir crenças ou religião.',
      interests: 'Sem evidências para mapear interesses.',
      communicationStyle: 'Sem conteúdo textual para avaliar estilo de comunicação.',
    },
    indicators: {
      politicalOrientationScore: 0,
      customsScore: 0,
      economicScore: 0,
      religiosityScore: 0,
      polarizationScore: 0,
      consistencyScore: 0,
      likelyPoliticalSide: [{ label: 'Indefinido', confidence: 0 }],
      likelyReligions: [{ label: 'Indefinido', confidence: 0 }],
      likelyTeams: [{ label: 'Indefinido', confidence: 0 }],
      confidence: 0,
    },
    topInterests: [],
    topTopics: [],
    evidence: [],
    profiles,
    platformBreakdown,
    politicalProfile: {
      primarySide: 'Indefinido',
      sideConfidence: 0,
      economicAxis: 'Indefinido',
      customsAxis: 'Indefinido',
      summary: 'Sem dados para classificação política.',
      keySignals: [],
    },
    beliefProfile: {
      religion: 'Indefinido',
      favoriteTeam: 'Indefinido',
      coreValues: [],
      ideologicalBeliefs: [],
    },
    contradictions: [],
    recommendations: [
      'Confirme se o perfil está público.',
      'Informe os handles exatos de cada rede.',
      'Teste novamente em alguns minutos (limite/instabilidade do provider pode causar retorno vazio).',
    ],
    coverage: {
      profilesAnalyzed: 0,
      platformsAnalyzed: [],
      totalPostsAnalyzed: 0,
      totalTextsAnalyzed: 0,
    },
    warnings: normalizedWarnings,
  };
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
  const allDiscovered: Partial<SocialIntelInput> = {};
  const explicitUrls: Partial<Record<SocialPlatform, string>> = {
    instagram: input.instagram?.startsWith('http') ? input.instagram.trim() : undefined,
    twitter: input.twitter?.startsWith('http') ? input.twitter.trim() : undefined,
    tiktok: input.tiktok?.startsWith('http') ? input.tiktok.trim() : undefined,
    facebook: input.facebook?.startsWith('http') ? input.facebook.trim() : undefined,
  };

  // ---------- FASE 1: coletar todas as plataformas com handle informado em PARALELO ----------
  const phase1Tasks: Array<{
    platform: SocialPlatform;
    promise: Promise<CollectionResult>;
  }> = [];

  if (handles.instagram) {
    phase1Tasks.push({
      platform: 'instagram',
      promise: collectInstagram(deps.apifyToken, actorIds.instagram, handles.instagram),
    });
  }
  if (handles.twitter) {
    phase1Tasks.push({
      platform: 'twitter',
      promise: collectTwitter(deps.apifyToken, actorIds.twitter, handles.twitter, explicitUrls.twitter),
    });
  }
  if (handles.tiktok) {
    phase1Tasks.push({
      platform: 'tiktok',
      promise: collectTikTok(deps.apifyToken, actorIds.tiktok, handles.tiktok, explicitUrls.tiktok),
    });
  }
  if (handles.facebook) {
    phase1Tasks.push({
      platform: 'facebook',
      promise: collectFacebook(deps.apifyToken, actorIds.facebook, handles.facebook, explicitUrls.facebook),
    });
  }

  const phase1Results = await Promise.allSettled(phase1Tasks.map((t) => t.promise));

  for (let i = 0; i < phase1Tasks.length; i++) {
    const { platform } = phase1Tasks[i];
    const result = phase1Results[i];

    if (result.status === 'rejected') {
      warnings.push(`${platform}: ${getErrorMessage(result.reason)}`);
      continue;
    }

    const { source, discovered } = result.value;
    if (source && source.posts.length) {
      sources.push(source);
    } else {
      const hint = platform === 'facebook'
        ? 'facebook: sem dados retornados. Perfis pessoais do Facebook sao protegidos - use a URL de uma pagina publica.'
        : `${platform}: sem conteudo textual suficiente para analise.`;
      warnings.push(hint);
    }
    if (discovered) {
      for (const [key, val] of Object.entries(discovered)) {
        if (val && !allDiscovered[key as SocialPlatform]) {
          allDiscovered[key as SocialPlatform] = val;
        }
      }
    }
  }

  // ---------- FASE 2: tentar plataformas descobertas via bio (que nao tinham handle) ----------
  const phase2Tasks: Array<{
    platform: SocialPlatform;
    promise: Promise<CollectionResult>;
  }> = [];

  const platformsCollected = new Set(sources.map((s) => s.platform));

  if (!handles.twitter && !platformsCollected.has('twitter') && allDiscovered.twitter) {
    phase2Tasks.push({
      platform: 'twitter',
      promise: collectTwitter(deps.apifyToken, actorIds.twitter, allDiscovered.twitter),
    });
  }
  if (!handles.tiktok && !platformsCollected.has('tiktok') && allDiscovered.tiktok) {
    phase2Tasks.push({
      platform: 'tiktok',
      promise: collectTikTok(deps.apifyToken, actorIds.tiktok, allDiscovered.tiktok),
    });
  }
  if (!handles.facebook && !platformsCollected.has('facebook') && allDiscovered.facebook) {
    phase2Tasks.push({
      platform: 'facebook',
      promise: collectFacebook(deps.apifyToken, actorIds.facebook, allDiscovered.facebook),
    });
  }
  if (!handles.instagram && !platformsCollected.has('instagram') && allDiscovered.instagram) {
    phase2Tasks.push({
      platform: 'instagram',
      promise: collectInstagram(deps.apifyToken, actorIds.instagram, allDiscovered.instagram),
    });
  }

  if (phase2Tasks.length) {
    const phase2Results = await Promise.allSettled(phase2Tasks.map((t) => t.promise));

    for (let i = 0; i < phase2Tasks.length; i++) {
      const { platform } = phase2Tasks[i];
      const result = phase2Results[i];

      if (result.status === 'rejected') {
        warnings.push(`${platform} (descoberto): ${getErrorMessage(result.reason)}`);
        continue;
      }

      const { source } = result.value;
      if (source && source.posts.length) {
        sources.push(source);
      }
    }
  }

  if (!sources.length) {
    warnings.push('Nenhum dado pode ser coletado. Verifique os handles informados.');
    return buildEmptyReport(handles, warnings);
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
