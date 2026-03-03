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

/* ─── System Prompt ─── */

const SYSTEM_PROMPT = `Voce e um analista senior de inteligencia social e comportamento humano, especializado no contexto cultural brasileiro.

Sua tarefa e analisar o perfil de Instagram de uma pessoa e produzir uma analise comportamental profunda e criteriosa baseada EXCLUSIVAMENTE nos dados fornecidos.

DIRETRIZES ABSOLUTAS:
- Escreva em portugues do Brasil, tom profissional e objetivo.
- Seja ESPECIFICO: cite trechos dos posts, hashtags, e dados concretos como evidencia.
- Se nao houver evidencia suficiente para uma categoria, escreva "Sem evidencia suficiente nos dados analisados".
- NAO invente, NAO presuma, NAO extrapole alem do que os dados mostram.
- Considere TUDO: biografia, legendas dos posts, hashtags usadas, engajamento, frequencia, tom de linguagem.
- Para orientacao politica: busque SINAIS CONCRETOS - mencoes a politicos, partidos, hashtags politicas, posicionamentos sobre temas polemicos. Se nao houver sinais claros, classifique como "indefinido" com confianca "baixa".
- Para time esportivo: busque mencoes a times, escudos, hashtags (#Flamengo, #VaiCorinthians, etc), fotos com camisa de time.
- Para profissao: analise bio, conteudo dos posts, hashtags profissionais, linguagem tecnica.

Retorne APENAS um JSON valido (sem markdown, sem code blocks, sem texto antes ou depois) com esta estrutura exata:

{
  "resumo_comportamental": "Paragrafo de 4-6 frases descrevendo detalhadamente quem e essa pessoa, o que faz, como se comporta nas redes sociais, e seus interesses. Seja rico em detalhes e especifico.",
  "personalidade_e_interesses": "Descricao da personalidade percebida (extrovertida/introvertida, seria/descontraida, provocadora/conciliadora) e lista detalhada dos interesses identificados com evidencias dos posts.",
  "time_esportivo": "Nome do time que torce com evidencia citada, ou 'Sem evidencia suficiente'.",
  "assuntos_principais": "Os 3-5 temas mais recorrentes nos posts, cada um com exemplo concreto extraido do conteudo.",
  "profissao_e_industria": "Profissao ou area de atuacao identificada, setor da industria, e nivel de confianca (alta/media/baixa). Se incerto, indique a melhor estimativa.",
  "orientacao_politica": {
    "posicao": "esquerda | centro-esquerda | centro | centro-direita | direita | indefinido",
    "confianca": "alta | media | baixa",
    "evidencias": "Lista detalhada dos sinais encontrados. Se nenhum, escreva 'Nenhum sinal politico identificado nos dados analisados'."
  },
  "religiao_e_crencas": "Religiao ou sistema de crencas identificado com evidencias (versiculos, hashtags religiosas, mencoes a igrejas, etc), ou 'Sem evidencia suficiente'.",
  "estilo_comunicacao": "Analise de como se comunica: usa humor? sarcasmo? e formal ou informal? usa muitos emojis? linguagem coloquial ou culta? posta com frequencia? conteudo visual ou textual?",
  "categoria": "UMA das: politico, religioso, empresario, influenciador, jornalista, ativista, celebridade, funcionario_publico, educador, saude, juridico, outro",
  "categoria_label": "Label legivel da categoria (ex: Politico, Religioso, Empresario, Influenciador, Jornalista, Ativista, Celebridade, Func. Publico, Educador, Saude, Juridico, Outro)"
}`;

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
    .slice(0, 20)
    .map((p, i) => {
      const lines = [
        `Post ${i + 1}:`,
        `- Legenda: "${p.caption}"`,
      ];
      if (p.likesCount !== undefined) lines.push(`- Curtidas: ${p.likesCount}`);
      if (p.commentsCount !== undefined) lines.push(`- Comentarios: ${p.commentsCount}`);
      if (p.type) lines.push(`- Tipo: ${p.type}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return `Analise o seguinte perfil de Instagram de forma criteriosa e detalhada:

DADOS DO PERFIL:
- Username: @${username}
- Nome completo: ${profile.fullName || 'Nao disponivel'}
- Biografia: "${profile.biography || 'Sem biografia'}"
- Seguidores: ${profile.followersCount ?? 'N/A'}
- Seguindo: ${profile.followsCount ?? 'N/A'}
- Total de posts: ${profile.postsCount ?? 'N/A'}
- Link externo: ${profile.externalUrl || 'Nenhum'}

ULTIMOS POSTS ANALISADOS (${posts.filter(p => p.caption).length} posts com legenda):
${postTexts || 'Nenhum post com legenda encontrado.'}

Com base EXCLUSIVAMENTE nesses dados, faca a analise comportamental completa conforme o formato JSON especificado. Seja criterioso, detalhado e cite evidencias concretas dos posts.`;
}

/* ─── Parse Claude JSON Response ─── */

interface AnalysisResult {
  resumo_comportamental: string;
  personalidade_e_interesses: string;
  time_esportivo: string;
  assuntos_principais: string;
  profissao_e_industria: string;
  orientacao_politica: {
    posicao: string;
    confianca: string;
    evidencias: string;
  };
  religiao_e_crencas: string;
  estilo_comunicacao: string;
  categoria: string;
  categoria_label: string;
}

function tryParseJson(text: string): AnalysisResult | null {
  // Try raw parse first
  try { return JSON.parse(text); } catch { /* continue */ }

  // Try extracting from code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }

  // Try extracting first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* continue */ }
  }

  return null;
}

function buildAiSummary(analysis: AnalysisResult): string {
  const sections: string[] = [];

  sections.push(analysis.resumo_comportamental);

  if (analysis.personalidade_e_interesses) {
    sections.push(`\n🧠 Personalidade e Interesses: ${analysis.personalidade_e_interesses}`);
  }
  if (analysis.profissao_e_industria) {
    sections.push(`\n💼 Profissao: ${analysis.profissao_e_industria}`);
  }
  if (analysis.assuntos_principais) {
    sections.push(`\n💬 Assuntos Principais: ${analysis.assuntos_principais}`);
  }
  if (analysis.time_esportivo && analysis.time_esportivo !== 'Sem evidencia suficiente') {
    sections.push(`\n⚽ Time: ${analysis.time_esportivo}`);
  }
  if (analysis.orientacao_politica) {
    const pol = analysis.orientacao_politica;
    if (pol.posicao !== 'indefinido') {
      sections.push(`\n🏛️ Orientacao Politica: ${pol.posicao} (confianca: ${pol.confianca}). ${pol.evidencias}`);
    }
  }
  if (analysis.religiao_e_crencas && analysis.religiao_e_crencas !== 'Sem evidencia suficiente') {
    sections.push(`\n🙏 Religiao: ${analysis.religiao_e_crencas}`);
  }
  if (analysis.estilo_comunicacao) {
    sections.push(`\n📱 Estilo de Comunicacao: ${analysis.estilo_comunicacao}`);
  }

  return sections.join('');
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

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { followerId, username } = body as { followerId: string; username: string };

    if (!followerId || !username) {
      return NextResponse.json({ error: 'followerId e username sao obrigatorios' }, { status: 400 });
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
      // Delete follower - private or no data
      const { error: delError } = await supabase
        .from('instagram_followers')
        .delete()
        .eq('id', followerId);

      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }

      // Update follower count on account
      const { data: followerRow } = await supabase
        .from('instagram_followers')
        .select('account_id')
        .eq('id', followerId)
        .maybeSingle();

      if (followerRow?.account_id) {
        const { count } = await supabase
          .from('instagram_followers')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', followerRow.account_id);

        if (count !== null) {
          await supabase
            .from('instagram_accounts')
            .update({ follower_count: count, updated_at: new Date().toISOString() })
            .eq('id', followerRow.account_id);
        }
      }

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
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('');

    // Step 4: Parse JSON response
    const analysis = tryParseJson(responseText);

    let aiSummary: string;
    let category = 'outro';
    let categoryLabel = 'Outro';

    if (analysis) {
      aiSummary = buildAiSummary(analysis);
      if (VALID_CATEGORIES.includes(analysis.categoria)) {
        category = analysis.categoria;
        categoryLabel = analysis.categoria_label || CATEGORY_LABELS[category] || 'Outro';
      }
    } else {
      // Fallback: use raw text as summary
      aiSummary = responseText.slice(0, 2000);
    }

    // Step 5: Update follower in database
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

    // Update avatar and display name with HD versions if available
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
