import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

/* ─── Config ─── */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const apifyToken = process.env.APIFY_API_TOKEN || '';

const ANTHROPIC_KEYS = [
  process.env.ANTHROPIC_API_KEY,
  process.env.ANTHROPIC_API_KEY_2,
  process.env.ANTHROPIC_API_KEY_3,
  process.env.ANTHROPIC_API_KEY_4,
].filter(Boolean) as string[];

let keyIndex = 0;
function getAnthropicClient() {
  const key = ANTHROPIC_KEYS[keyIndex % ANTHROPIC_KEYS.length];
  keyIndex++;
  return new Anthropic({ apiKey: key });
}

const VALID_CATEGORIES = [
  'politico', 'religioso', 'empresario', 'influenciador', 'jornalista',
  'ativista', 'celebridade', 'funcionario_publico', 'educador', 'saude',
  'juridico', 'outro',
];

const CATEGORY_LABELS: Record<string, string> = {
  politico: 'Politico', religioso: 'Religioso', empresario: 'Empresario',
  influenciador: 'Influenciador', jornalista: 'Jornalista', ativista: 'Ativista',
  celebridade: 'Celebridade', funcionario_publico: 'Func. Publico',
  educador: 'Educador', saude: 'Saude', juridico: 'Juridico', outro: 'Outro',
};

/* ─── System Prompt (concise mode) ─── */

const SYSTEM_PROMPT = `Voce e um analista de inteligencia social brasileiro. Analise o perfil de Instagram fornecido e retorne APENAS um JSON valido (sem markdown, sem code blocks) com esta estrutura:

{
  "resumo": "2-3 frases diretas e objetivas sobre quem e essa pessoa e o que faz. Sem emojis, sem enrolacao.",
  "genero": "homem | mulher | indefinido",
  "faixa_etaria": "16-24 | 25-34 | 35-44 | 45-59 | 60+ | indefinido",
  "renda_estimada": "baixa | media | alta | indefinido",
  "profissao": "Profissao curta (ex: Advogada, Empresario, Estudante, Personal Trainer). Se incerto: 'Indefinido'",
  "grupo": "FAMILIA | EMPREENDEDOR | FE | ESPORTE | EDUCACAO | SAUDE | TECH | POLITICA | MODA | ARTE | MUSICA | GASTRONOMIA | AGRO | PET | VIAGEM | FITNESS | JURIDICO | INFLUENCER | COMUNIDADE | LIFESTYLE",
  "engajamento_politico": "passivo | moderado | ativo | indefinido",
  "temas_interesse": ["lista", "de", "temas", "principais"],
  "categoria": "politico | religioso | empresario | influenciador | jornalista | ativista | celebridade | funcionario_publico | educador | saude | juridico | outro",
  "categoria_label": "Label legivel da categoria",
  "frase_comunicacao": "Frase personalizada de abordagem para essa pessoa (veja regras abaixo)"
}

REGRAS:
- Baseie-se EXCLUSIVAMENTE nos dados fornecidos.
- Para genero: analise nome, bio, fotos mencionadas e linguagem usada.
- Para faixa etaria: estime pela linguagem, temas, aparencia descrita, contexto de vida.
- Para grupo: escolha a tag que MELHOR representa o perfil geral da pessoa entre as 20 opcoes.
- Para renda: analise profissao, estilo de vida nos posts, viagens, produtos mencionados.
- Para frase_comunicacao: crie uma mensagem UNICA e personalizada para abordar essa pessoa.
  REGRAS DA FRASE:
  - Comece com "Oi, [PRIMEIRO NOME]," (use o primeiro nome real, nao o @username)
  - O restante da frase deve ser 100% personalizado com base no RESUMO e nos POSTS da pessoa
  - Mencione algo ESPECIFICO da vida dela (profissao, hobby, causa, conquista, conteudo que posta)
  - Seja criativo, humano e genuino. Nao use formulas repetitivas.
  - Maximo 2 frases curtas. Tom acolhedor e proximo.
  - NUNCA repita estruturas como "X e tudo pra gente, ne?" ou "Conte comigo sempre!" — varie o tom.
  Exemplos de BOAS frases (cada uma totalmente diferente):
  - "Oi, Rose, vi que voce ama cozinhar em familia — que delicia essas receitas! Quero muito te conhecer melhor."
  - "Oi, Marcos, parabens pelo crescimento da sua empresa, inspirador demais! Bora trocar uma ideia?"
  - "Oi, Ana, suas trilhas sao incriveis, da vontade de ir junto! Conta comigo no que precisar."
  - "Oi, Pedro, que trabalho lindo com resgate de animais. O mundo precisa de mais gente como voce."
  - "Oi, Julia, seu conteudo sobre educacao infantil e muito necessario. Admiro muito seu trabalho!"
- Seja direto e preciso. Nao invente dados.`;

/* ─── Apify Instagram Scraper ─── */

interface ApifyPost {
  caption?: string;
  displayUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  type?: string;
}

interface ApifyProfile {
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  profilePicUrlHD?: string;
  profilePicUrl?: string;
  isPrivate?: boolean;
  private?: boolean;
  latestPosts?: ApifyPost[];
  externalUrl?: string;
  [key: string]: unknown;
}

async function scrapeInstagramProfile(username: string): Promise<ApifyProfile | null> {
  const encodedActor = encodeURIComponent('apify/instagram-profile-scraper');
  const url = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=70`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username] }),
    signal: AbortSignal.timeout(75000),
  });

  if (!res.ok) return null;

  const data = await res.json() as ApifyProfile[];
  if (!Array.isArray(data) || data.length === 0) return null;

  return data[0];
}

/* ─── Build AI Prompt ─── */

function buildUserPrompt(profile: ApifyProfile, username: string): string {
  const posts = profile.latestPosts || [];

  const postTexts = posts
    .filter((p) => p.caption && p.caption.trim().length > 0)
    .slice(0, 15)
    .map((p, i) => `Post ${i + 1}: "${p.caption}" (${p.likesCount ?? 0} curtidas)`)
    .join('\n');

  return `Perfil: @${username}
Nome: ${profile.fullName || 'N/A'}
Bio: "${profile.biography || 'Sem bio'}"
Seguidores: ${profile.followersCount ?? 'N/A'} | Seguindo: ${profile.followsCount ?? 'N/A'} | Posts: ${profile.postsCount ?? 'N/A'}
Link: ${profile.externalUrl || 'Nenhum'}

Posts recentes:
${postTexts || 'Sem posts com legenda.'}`;
}

/* ─── Parse JSON ─── */

interface AnalysisResult {
  resumo: string;
  genero: string;
  faixa_etaria: string;
  renda_estimada: string;
  profissao: string;
  grupo: string;
  engajamento_politico: string;
  temas_interesse: string[];
  categoria: string;
  categoria_label: string;
  frase_comunicacao: string;
}

function tryParseJson(text: string): AnalysisResult | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* continue */ }
  }
  return null;
}

/* ─── POST Handler ─── */

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN nao configurado' }, { status: 500 });
    }
    if (ANTHROPIC_KEYS.length === 0) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nao configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { followerId, username, saveToDb = true } = body as {
      followerId?: string | null;
      username: string;
      saveToDb?: boolean;
    };

    if (!username) {
      return NextResponse.json({ error: 'username e obrigatorio' }, { status: 400 });
    }

    const cleanUsername = username.replace(/^@/, '').trim();

    // Step 1: Scrape Instagram profile via Apify
    const profile = await scrapeInstagramProfile(cleanUsername);

    // Step 2: Check if profile is private/empty
    const isPrivate = profile?.isPrivate === true || profile?.private === true;
    const biography = profile?.biography || '';
    const latestPosts = profile?.latestPosts || [];
    const postsCount = profile?.postsCount || 0;

    const hasNoUsefulData = !profile || (isPrivate && latestPosts.length === 0 && !biography) || (!isPrivate && postsCount === 0 && latestPosts.length === 0 && !biography);

    if (hasNoUsefulData) {
      // In search mode (saveToDb=false), just skip
      if (!saveToDb || !followerId) {
        return NextResponse.json({
          skipped: true,
          reason: isPrivate ? 'Perfil privado' : 'Sem dados uteis',
        });
      }

      // Legacy mode: delete from DB
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('instagram_followers').delete().eq('id', followerId);

      return NextResponse.json({
        deleted: true,
        reason: isPrivate ? 'Perfil privado sem dados acessiveis' : 'Perfil sem dados uteis',
      });
    }

    // Step 3: Build prompt and call Claude
    const userPrompt = buildUserPrompt(profile!, cleanUsername);
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('');

    // Step 4: Parse JSON response
    const analysis = tryParseJson(responseText);

    let category = 'outro';
    let categoryLabel = 'Outro';

    if (analysis && VALID_CATEGORIES.includes(analysis.categoria)) {
      category = analysis.categoria;
      categoryLabel = analysis.categoria_label || CATEGORY_LABELS[category] || 'Outro';
    }

    // Step 5: Return result for search mode (no DB save)
    if (!saveToDb || !followerId) {
      return NextResponse.json({
        analyzed: true,
        username: cleanUsername,
        display_name: profile!.fullName || cleanUsername,
        avatar_url: profile!.profilePicUrlHD || profile!.profilePicUrl || '',
        analysis: analysis || {
          resumo: responseText.slice(0, 500),
          genero: 'indefinido',
          faixa_etaria: 'indefinido',
          renda_estimada: 'indefinido',
          profissao: 'Indefinido',
          grupo: 'LIFESTYLE',
          engajamento_politico: 'indefinido',
          temas_interesse: [],
          categoria: 'outro',
          categoria_label: 'Outro',
          frase_comunicacao: '',
        },
        category,
        profile: {
          biography: profile!.biography,
          followers_count: profile!.followersCount,
          follows_count: profile!.followsCount,
          posts_count: profile!.postsCount,
        },
      });
    }

    // Step 6: Save to DB (legacy mode)
    const supabase = createClient(supabaseUrl, supabaseKey);
    const aiSummary = analysis?.resumo || responseText.slice(0, 500);

    const updateData: Record<string, unknown> = {
      ai_summary: aiSummary,
      category,
      category_label: categoryLabel,
      metadata_json: {
        scraped_at: new Date().toISOString(),
        biography: profile!.biography,
        followers_count: profile!.followersCount,
        follows_count: profile!.followsCount,
        posts_count: profile!.postsCount,
        external_url: profile!.externalUrl,
        latest_posts: (profile!.latestPosts || []).slice(0, 20).map((p) => ({
          caption: p.caption,
          likes: p.likesCount,
          comments: p.commentsCount,
          type: p.type,
        })),
        analysis_raw: analysis,
      },
      updated_at: new Date().toISOString(),
    };

    if (profile!.profilePicUrlHD || profile!.profilePicUrl) {
      updateData.avatar_url = profile!.profilePicUrlHD || profile!.profilePicUrl;
    }
    if (profile!.fullName) {
      updateData.display_name = profile!.fullName;
    }

    const { data: updatedFollower, error: updateError } = await supabase
      .from('instagram_followers')
      .update(updateData)
      .eq('id', followerId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      follower: updatedFollower,
      analyzed: true,
      category,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('analyze-follower error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
