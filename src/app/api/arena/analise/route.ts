import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic();

export const maxDuration = 120;

// Extract the most extreme metrics from segments for dashboard highlights
function extractHighlights(segments: Record<string, any[]>): string {
  const highlights: { label: string; category: string; type: string; pct: number; sampleSize: number }[] = [];

  const categoryNames: Record<string, string> = {
    gender: 'Genero', religion: 'Religiao', race: 'Raca/Etnia', region: 'Regiao',
    generation: 'Geracao', socialClass: 'Classe Social', education: 'Escolaridade',
    politicalLeaning: 'Posicao Politica', voto2022: 'Voto 2022', voto2026: 'Intencao 2026',
  };

  // Calculate proportional minimum sample size to avoid distorted percentages
  const allTotals: number[] = [];
  for (const items of Object.values(segments || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const t = (item.positive || 0) + (item.negative || 0) + (item.neutral || 0);
      if (t > 0) allTotals.push(t);
    }
  }
  const avgSegmentSize = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;
  const minSampleSize = Math.max(30, Math.round(avgSegmentSize * 0.02));

  for (const [category, items] of Object.entries(segments || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const total = (item.positive || 0) + (item.negative || 0) + (item.neutral || 0);
      if (total < minSampleSize) continue;

      const pctPos = (item.positive / total) * 100;
      const pctNeg = (item.negative / total) * 100;
      const pctNeu = (item.neutral / total) * 100;
      const catLabel = categoryNames[category] || category;

      if (pctPos >= 70) highlights.push({ label: item.label, category: catLabel, type: 'aprovacao', pct: Math.round(pctPos), sampleSize: total });
      if (pctNeg >= 70) highlights.push({ label: item.label, category: catLabel, type: 'rejeicao', pct: Math.round(pctNeg), sampleSize: total });
      if (pctNeu >= 70) highlights.push({ label: item.label, category: catLabel, type: 'neutralidade', pct: Math.round(pctNeu), sampleSize: total });
    }
  }

  highlights.sort((a, b) => b.pct - a.pct);
  const top = highlights.slice(0, 5);

  if (top.length === 0) return '';

  return `\nPONTOS DE DESTAQUE DO DASHBOARD (segmentos com metricas extremas):\n` +
    top.map(h => `- ${h.label} (${h.category}): ${h.pct}% ${h.type} (n=${h.sampleSize})`).join('\n');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, positive, negative, neutral, totalPersonas, segments, phase, contentMeta, specialistPanel: precomputedSpecialists } = body;

  const total = positive + negative + neutral;
  const pctPos = total > 0 ? ((positive / total) * 100).toFixed(1) : '0';
  const pctNeg = total > 0 ? ((negative / total) * 100).toFixed(1) : '0';
  const pctNeu = total > 0 ? ((neutral / total) * 100).toFixed(1) : '0';

  let segmentsSummary = '';
  if (segments) {
    const formatSeg = (items: any[]) =>
      items?.slice(0, 5).map((s: any) => {
        const t = s.positive + s.negative + s.neutral;
        return `${s.label}: ${t > 0 ? ((s.positive / t) * 100).toFixed(0) : 0}% favor, ${t > 0 ? ((s.negative / t) * 100).toFixed(0) : 0}% contra`;
      }).join('; ') || '';

    segmentsSummary = `
Genero: ${formatSeg(segments.gender)}
Religiao: ${formatSeg(segments.religion)}
Raca/Etnia: ${formatSeg(segments.race)}
Regiao: ${formatSeg(segments.region)}
Geracao: ${formatSeg(segments.generation)}
Classe Social: ${formatSeg(segments.socialClass)}
Escolaridade: ${formatSeg(segments.education)}
Posicao Politica: ${formatSeg(segments.politicalLeaning)}
Voto 2022: ${formatSeg(segments.voto2022)}
Intencao 2026: ${formatSeg(segments.voto2026)}`;
  }

  // Support both single string and array of platforms
  const rawMediaType = contentMeta?.mediaType;
  const mediaTypes: string[] = Array.isArray(rawMediaType)
    ? rawMediaType
    : rawMediaType ? rawMediaType.split(',').map((s: string) => s.trim()).filter(Boolean) : ['nao especificado'];
  const mediaLabel = mediaTypes.join(', ');
  const ideologyLabel = contentMeta?.candidateIdeology || 'nao especificado';
  const regionLabel = contentMeta?.region === 'brasil' ? 'Brasil (Nacional)' :
    (contentMeta?.city ? `${contentMeta.city} - ${contentMeta.region}` : contentMeta?.region || 'Brasil');

  // Attachment type (image/video/audio/text)
  const attachmentType = contentMeta?.attachmentType || 'text';
  const attachmentLabels: Record<string, string> = {
    image: 'IMAGEM', video: 'VIDEO', audio: 'AUDIO', text: 'TEXTO',
  };
  const attachmentLabel = attachmentLabels[attachmentType] || 'CONTEUDO';

  const platformKnowledge: Record<string, string> = {
    instagram: `REGRAS ESPECIFICAS DA PLATAFORMA — INSTAGRAM:
- Formatos disponiveis: Reels (maior alcance organico), Carrossel (maior salvamento e compartilhamento), Stories (engajamento direto e enquetes), Feed estatico (autoridade e branding)
- Algoritmo: prioriza tempo de visualizacao, compartilhamentos e salvamentos — curtidas tem peso menor
- Reels: primeiros 3 segundos sao criticos — exige hook visual/verbal imediato ou o algoritmo enterra o conteudo
- Reels: duracao ideal entre 30-90 segundos para conteudo politico; acima de 90s perde retencao drasticamente
- Carrosseis: 7-10 slides performam melhor — slide 1 deve ser gancho irresistivel, ultimo slide deve ter CTA claro
- Carrosseis tem 2x mais alcance que posts estaticos e sao o formato com maior taxa de salvamento
- Legendas longas (>200 caracteres) com storytelling aumentam tempo de permanencia no post
- Hashtags: maximo 3-5 relevantes, mix de nicho + volume medio — excesso de hashtags reduz alcance
- Stories com enquetes, caixas de perguntas e sliders geram 2-3x mais interacao que stories estaticos
- Horarios de pico: 11h-13h e 18h-21h (ajustar conforme regiao alvo)
- CTA verbal no final de Reels ("compartilhe", "salve") aumenta compartilhamento em ate 30%
- Consistencia visual do feed (paleta, tipografia) aumenta taxa de follow apos visita ao perfil
- Collab posts (publicacao conjunta) dobram o alcance ao unir audiencias
- Conteudo nativo (sem marca d'agua de TikTok ou outros apps) e priorizado pelo algoritmo
- Legendas devem comecar com frase de impacto — Instagram trunca apos 125 caracteres no feed`,

    tiktok: `REGRAS ESPECIFICAS DA PLATAFORMA — TIKTOK:
- Algoritmo: 100% baseado em retencao e rewatch — nao depende de seguidores para viralizar
- Primeiros 1-2 segundos definem se o usuario continua ou passa — hook IMEDIATO e obrigatorio
- Duracao ideal: 15-60 segundos para maximo alcance; videos longos so funcionam com retencao altissima
- Formato vertical (9:16) obrigatorio — conteudo horizontal perde alcance drasticamente
- Trends e sons em alta multiplicam alcance — usar audios trending quando possivel
- Linguagem informal e direta performa melhor que tom institucional
- Texto na tela (captions/legendas queimadas) aumenta retencao em ate 40%
- Storytelling com "gancho + desenvolvimento + punchline" e o formato que mais viraliza
- Stitches e Duets com conteudo viral ampliam alcance organico
- Frequencia ideal: 1-3 posts por dia — consistencia e mais importante que producao alta
- Conteudo "bastidores" e "real" performa melhor que conteudo muito produzido
- CTA deve ser natural e conversacional, nao institucional`,

    youtube: `REGRAS ESPECIFICAS DA PLATAFORMA — YOUTUBE:
- Algoritmo: prioriza CTR da thumbnail + tempo de visualizacao (watch time) + taxa de retencao
- Thumbnail e titulo sao 80% da decisao de clique — investir em design e copywriting
- Primeiros 30 segundos devem conter hook + promessa clara do que o video entrega
- Shorts (vertical, <60s): alcance explosivo mas baixa conversao para inscritos
- Videos longos (8-20min): melhor para autoridade, monetizacao e retencao de audiencia
- Descricao deve ter palavras-chave nos primeiros 200 caracteres (SEO)
- Cards e end screens aumentam tempo de sessao — usar em todo video
- Frequencia ideal: 1-2 videos longos por semana + Shorts diarios
- Comunidade (aba Community): enquetes e posts mantem engajamento entre uploads
- Legendas/closed captions aumentam alcance internacional e acessibilidade
- Capitulos (timestamps) melhoram retencao e SEO
- Lives geram notificacoes push para inscritos — usar para eventos e pronunciamentos`,

    tv: `REGRAS ESPECIFICAS DA PLATAFORMA — TV:
- Audiencia passiva — mensagem deve ser absorvida sem interacao do espectador
- Primeiros 5 segundos definem se o espectador presta atencao ou troca de canal
- Formato ideal: 30s ou 60s — cada segundo conta, zero desperdicio
- Mensagem unica e clara — TV nao permite complexidade, uma ideia por peca
- Tom emocional forte (esperanca, indignacao, orgulho) gera mais memorabilidade
- Repeticao do nome/numero do candidato no minimo 3 vezes na peca
- Jingle ou slogan memoravel aumenta recall em ate 40%
- Imagens de pessoas reais (nao stock) geram mais conexao
- Legendas/texto na tela reforçam a mensagem para audiencia com volume baixo
- Horario nobre (20h-22h) tem audiencia maior mas custo proporcional
- Insercoes no horario eleitoral gratuito seguem regras especificas de duracao`,

    radio: `REGRAS ESPECIFICAS DA PLATAFORMA — RADIO:
- 100% audio — toda mensagem deve funcionar SEM elemento visual
- Primeiros 3 segundos: identificacao clara de quem fala e por que o ouvinte deve prestar atencao
- Duracao ideal: 30s ou 60s — mensagem deve ser completa e repetivel
- Repeticao e essencial: nome, numero e slogan devem aparecer no minimo 3 vezes
- Tom conversacional e proximo performa melhor que tom institucional/formal
- Jingles memoraveis aumentam recall drasticamente — considerar investimento em jingle
- Voz do proprio candidato gera mais autenticidade que locutor profissional
- Horarios de pico: manha (6h-9h) e fim de tarde (17h-19h) — audiencia no transito
- Segmentacao por emissora: AM para publico mais velho/rural, FM para urbano/jovem
- Musica de fundo sutil ajuda retencao mas nao deve competir com a voz`,

    outdoor: `REGRAS ESPECIFICAS DA PLATAFORMA — OUTDOOR/OOH:
- Tempo de leitura maximo: 3-5 segundos (motoristas e pedestres em movimento)
- Texto: maximo 7 palavras — frases longas nao sao lidas
- Fonte grande, alto contraste, legivel a 50+ metros de distancia
- Uma unica mensagem por peca — zero complexidade
- Foto do candidato deve ocupar no minimo 30% da area
- Numero do candidato em destaque (grande e visivel)
- Cores fortes e contrastantes — evitar tons pasteis que se perdem na paisagem urbana
- Localizacao estrategica: semaforos, avenidas de alto fluxo, entradas de bairros-alvo
- Outdoor digital permite rotacao de mensagens e atualizacao em tempo real
- Repeticao geografica (varios pontos na mesma rota) reforça memorabilidade`,

    impresso: `REGRAS ESPECIFICAS DA PLATAFORMA — MATERIAL IMPRESSO:
- Hierarquia visual clara: titulo > foto > corpo > CTA
- Titulo deve funcionar sozinho — muitos leitores so leem o titulo
- Jornal/revista: respeitar o tom editorial do veiculo para nao parecer "corpo estranho"
- Panfleto/santinho: uma face = gancho emocional, outra face = propostas objetivas
- QR code para redirecionar ao digital (Instagram, site, WhatsApp)
- Papel e acabamento comunicam: material barato pode prejudicar a percepcao de seriedade
- Distribuicao segmentada por bairro/regiao maximiza relevancia
- Texto deve ser escaneavel: bullets, negritos, numeros — nao blocos de texto
- Foto profissional do candidato e obrigatoria — evitar fotos amadoras
- Cores do partido/campanha devem ser consistentes com o restante da comunicacao`,

    x: `REGRAS ESPECIFICAS DA PLATAFORMA — X (TWITTER):
- Limite de 280 caracteres por tweet — cada palavra conta, zero desperdicio
- Threads (fio) permitem narrativa longa: tweet 1 = gancho irresistivel, demais = desenvolvimento
- Algoritmo prioriza: engajamento rapido (likes, retweets, replies nos primeiros 30 minutos)
- Tom opinativo e provocativo performa melhor que tom institucional — X e arena de debate
- Hashtags: maximo 1-2 por tweet — excesso parece spam e reduz alcance
- Quote tweets com opiniao propria geram mais alcance que retweets simples
- Horarios de pico: 8h-10h (manha) e 18h-22h (noite) — quando publico politico esta ativo
- IMAGEM no X: imagens aumentam engajamento em 2-3x vs texto puro. Formatos ideais: 16:9 (horizontal) ou 1:1. Infograficos, prints de dados e memes politicos viralizam forte. Texto sobreposto na imagem deve ser legivel em miniatura (mobile)
- VIDEO no X: videos curtos (30-60s) performam melhor. Autoplay sem som — legendas queimadas sao OBRIGATORIAS. Primeiros 3 segundos definem retencao. Videos nativos (upload direto) tem 6x mais alcance que links do YouTube
- Enquetes geram engajamento massivo — usar para temas polemicos
- Respostas rapidas a trending topics multiplicam visibilidade
- Linguagem direta e assertiva — X nao perdoa rodeios
- Evitar apagar tweets (gera print e efeito Streisand)
- Comunidades e Espacos (audio ao vivo) ampliam autoridade
- Fixar tweet principal com mensagem-chave da campanha`
  };

  // Include platform knowledge for ALL selected platforms
  const platformBlock = mediaTypes
    .map((p) => platformKnowledge[p.trim()])
    .filter(Boolean)
    .join('\n\n');

  // Extract dashboard highlights from segments
  const highlightsBlock = segments ? extractHighlights(segments) : '';

  const contentTypeLabel = contentMeta?.contentType || 'conteudo';

  // Build the platformSummaries example for the JSON schema
  const platformSummariesExample = mediaTypes.map(p => {
    const pName = p.trim();
    return `    { "platform": "${pName}", "summary": "2 frases curtas e diretas para ${pName.toUpperCase()}. Sem palavras tecnicas. Max 150 chars." }`;
  }).join(',\n');

  const systemPrompt = `Voce e a DUDA, estrategista de marketing politico com 20 anos de experiencia em campanhas eleitorais brasileiras. Voce trabalhou em campanhas municipais, estaduais e federais — ja fez candidato sem chance virar prefeito, ja salvou campanha de governador no segundo turno, ja montou estrategia digital pra senador que nao sabia usar celular.

Voce fala DIRETAMENTE com o politico/candidato, como consultora de confianca. Voce e PRESCRITIVA — nao descreve o que aconteceu, voce COMANDA o que precisa ser feito. Usa dados reais dos segmentos para embasar cada recomendacao.

PERSONALIDADE DA DUDA:
- Direta e sem rodeios: "Olha, vou ser sincera contigo..."
- Confiante: usa dados, porcentagens e segmentos para embasar TUDO
- Brasileira, informal mas profissional — tuteia o candidato
- Prescritiva: diz EXATAMENTE o que fazer, quando e por que
- Experiente: "Em 2018 eu vi um candidato perder 8 pontos por causa disso..."
- Estrategica: pensa em segmentos, timing, plataforma
- Expressoes tipicas: "Olha so", "Te digo uma coisa", "Pra virar esse jogo", "O que eu faria no seu lugar", "Confia em mim nessa"

TOM DA DUDA:
- "Voce precisa entender que os evangelicos sao 35% da sua base e voce ta ignorando eles..."
- "Esquece esse publico por agora, foca no que da resultado imediato..."
- "Se voce postar isso no TikTok sem mudar o gancho, vai queimar dinheiro a toa..."
- "Eu ja vi candidato recuperar 12 pontos em 3 semanas fazendo exatamente isso..."
- "Confia: esse segmento ta pedindo atencao e ninguem ta dando..."

REGRA DE LINGUAGEM — MAIS IMPORTANTE QUE TUDO:
- Fale como se estivesse num bar com o candidato, NAO numa reuniao de diretoria
- ZERO palavras tecnicas: nada de "CTR", "engajamento organico", "algoritmo", "metricas", "KPI", "conversao", "performance", "retencao"
- Em vez de "CTR da thumbnail": diga "a capa do video nao chama atencao"
- Em vez de "engajamento organico": diga "as pessoas vao compartilhar mais"
- Em vez de "hook visual": diga "a primeira coisa que a pessoa ve"
- Em vez de "retencao de audiencia": diga "o pessoal vai assistir ate o final"
- Headline: MAXIMO 12 palavras, como uma mensagem de WhatsApp
- platformSummary: MAXIMO 2 frases curtas e diretas
- Foque no que TEM, nao no que FALTA

REGRA ABSOLUTA DE MIDIA — NUNCA VIOLE:
- Se enviou IMAGEM: fale APENAS sobre ESSA imagem. NUNCA sugira video, carrossel, reels, stories
- Se enviou VIDEO: fale APENAS sobre ESSE video. NUNCA sugira imagem ou carrossel
- Se enviou AUDIO: fale APENAS sobre ESSE audio
- Se enviou TEXTO: fale APENAS sobre ESSE texto
- O candidato quer saber como MELHORAR o que ele ja fez

REGRA DE SUGESTOES PRATICAS — O DIFERENCIAL DA DUDA:
- NAO diga "melhore a legenda". Diga "Troca a legenda por: 'texto sugerido aqui'"
- NAO diga "use um CTA melhor". Diga "No final, escreve: 'texto sugerido aqui'"
- NAO diga "melhore o gancho". Diga "Comeca com: 'frase sugerida aqui'"
- SEMPRE que possivel, DE O TEXTO PRONTO entre aspas simples para o candidato copiar e colar
- Se for imagem: sugira legenda alternativa COMPLETA, nao so "melhore"
- Se for video: sugira frase de abertura alternativa, texto de legenda
- Se for texto: sugira versao reescrita do texto
- Cada platformSummary DEVE ter pelo menos 1 sugestao copiavel entre aspas simples
- Cada recommendation DEVE ter no campo "detail" uma sugestao de texto pronto

REGRAS DA DUDA:
- SEMPRE fale na 2a pessoa do singular (voce)
- Headline: fala direta curta ("Muda essa legenda que voce ganha o Nordeste")
- nextSteps: acoes simples como lista de WhatsApp
- NAO analise opiniao politica — analise RESULTADO do conteudo
- Crie urgencia mas sem ser alarmista

EQUIPE DE ESPECIALISTAS:
Voce tem uma equipe de 5 especialistas que analisou o material ANTES de voce. Os pareceres deles serao fornecidos na mensagem do usuario, na secao "PARECERES DA EQUIPE DE ESPECIALISTAS". Use esses pareceres para:
- INCORPORAR as perspectivas na sua analise principal (headline, platformSummaries, recommendations, nextSteps) de forma natural, sem citar os especialistas pelo nome
- Incluir os pareceres ORIGINAIS no campo "specialistPanel" do JSON de resposta
- Se algum especialista identificou risco ALTO ou CRITICO, priorize essa informacao nas recomendacoes
- Se houver DIVERGENCIA entre especialistas, mencione-a de forma sutil na analise

CONTEXTO DO MATERIAL:
- Plataformas selecionadas: ${mediaLabel.toUpperCase()}
- Tipo de midia enviada: ${attachmentLabel}
- Posicionamento ideologico do candidato: ${ideologyLabel}
- Regiao alvo: ${regionLabel}

TIPO DE MIDIA — COMO REFERENCIAR:
O usuario enviou: ${attachmentLabel}. Em CADA platformSummary, SEMPRE referencie diretamente o que foi enviado:
- Se IMAGEM: comece com "Olha, essa imagem...", fale sobre composicao, legenda, CTA visual
- Se VIDEO: comece com "Esse video...", fale sobre hook, roteiro, retencao, cortes, CTA
- Se AUDIO: comece com "Esse audio...", fale sobre abertura, tom de voz, ritmo, CTA
- Se TEXTO: comece com "Esse conteudo...", fale sobre copy, estrutura, gancho, chamada

${platformBlock}

FORMATO OBRIGATORIO — responda EXCLUSIVAMENTE com um JSON valido, sem markdown, sem texto antes ou depois. O JSON deve seguir EXATAMENTE esta estrutura:

{
  "headline": "Fala direta da Duda, curta como WhatsApp. Ex: 'Muda essa legenda que voce ganha o Nordeste'. MAXIMO 12 palavras.",
  "platformSummaries": [
${platformSummariesExample}
  ],
  "summary": "Resumo direto em 1 frase. Max 120 chars. Linguagem simples.",
  "dashboardHighlights": [
    {
      "segmentName": "Nome do segmento (ex: Evangelicos)",
      "type": "high_approval|high_rejection|high_neutrality",
      "percentage": 90,
      "description": "Frase impactante e direta (ex: '92% dos evangelicos aprovaram — este e seu publico-chave')"
    }
  ],
  "score": 6.5,
  "tags": ["${mediaLabel} · ${contentMeta?.region?.toUpperCase() || 'BR'}", "${contentTypeLabel} · Tema do conteudo"],
  "stats": [
    { "value": "+XX%", "label": "descricao curta da oportunidade" },
    { "value": "+XX%", "label": "descricao curta da oportunidade" },
    { "value": "XX%", "label": "descricao curta da oportunidade" }
  ],
  "recommendations": [
    {
      "icon": "video|message|map|sparkles|globe|target|trending|mic|image|layout",
      "text": "Recomendacao curta e direta, imperativa (o que fazer)",
      "gain": "+XX% alcance|engajamento|conversao (o que voce GANHA fazendo isso)",
      "priority": "prioridade|importante|oportunidade",
      "detail": "Sugestao de texto pronto entre aspas simples que o candidato pode copiar e usar. 1 frase."
    }
  ],
  "projectedScore": 8.5,
  "insight": {
    "title": "Dado surpreendente ou oportunidade oculta nos dados",
    "description": "Contexto com numeros: X% aprova, Y% compartilha Z vezes mais que a media.",
    "action": "Acao concreta e imediata que explora esse insight"
  },
  "nextSteps": [
    {
      "title": "Acao concreta no imperativo",
      "benefit": "Resultado esperado com metrica",
      "deadline": "hoje|amanha|3 dias|essa semana|proximo ciclo"
    }
  ],
  "radar": {
    "alcance": 7.5,
    "engajamento": 6.0,
    "retencao": 5.5,
    "conversao": 4.0,
    "adequacao": 8.0,
    "emocional": 6.5
  },
  "specialistPanel": {
    "consensus": "O que o time todo concorda, em 1 frase simples. Ex: 'A imagem ta boa mas a legenda precisa melhorar'. Max 100 chars.",
    "divergences": "Se alguem discorda, 1 frase simples. Ex: 'O juridico acha que precisa cuidado com essa frase'. Pode ser null.",
    "specialists": [
      {
        "id": "comunicacao_politica",
        "name": "Comunicacao Politica",
        "emoji": "bullseye",
        "verdict": "Opiniao direta em linguagem simples. Max 60 chars. Ex: 'Essa imagem ta boa mas a legenda ta fraca'",
        "riskLevel": "baixo|medio|alto|critico",
        "keyPoints": ["Frase curta sem jargao. Ex: 'O publico evangelico amou'", "Outra frase simples"],
        "recommendations": [
          { "text": "Acao simples. Ex: 'Muda a legenda pra algo mais direto'", "priority": "urgente|importante|oportunidade", "segment": "Publico alvo (opcional)" }
        ],
        "dataHighlight": "Dado curioso em linguagem simples (opcional)"
      }
    ]
  }
}

REGRAS DO JSON:
- "platformSummaries": EXATAMENTE ${mediaTypes.length} item(ns). CADA summary:
  1. 2 frases curtas e diretas, linguagem simples (ZERO jargao)
  2. Fale sobre O MATERIAL ENVIADO, nunca sugira outro formato
  3. Maximo 150 caracteres por summary
- Foco por canal: Instagram = hook visual, legenda, formato (Reels/Carrossel); YouTube = thumbnail, titulo, retencao, SEO; TikTok = hook imediato, trend, linguagem informal; TV = mensagem unica, emocao, repeticao; Radio = audio puro, jingle, tom; Outdoor = brevidade (7 palavras), contraste; Impresso = hierarquia visual, titulo
- "summary": fallback geral caso o frontend nao suporte platformSummaries. Max 250 chars com frase copiavel
- "dashboardHighlights": os 3-5 dados mais EXTREMOS e surpreendentes do dashboard. Use os PONTOS DE DESTAQUE fornecidos no contexto. Cada item deve ter segmentName, type (high_approval/high_rejection/high_neutrality), percentage (inteiro), description (frase impactante). Se nenhum ponto extremo foi fornecido, identifique os segmentos com MAIOR variacao no breakdown demografico
- "score": nota de 0.0 a 10.0 avaliando a performance geral do conteudo (considere aprovacao, engajamento potencial e adequacao a plataforma)
- "tags": EXATAMENTE 2 tags — primeira: plataforma + regiao, segunda: tipo de conteudo + tema principal
- "stats": EXATAMENTE 3 metricas de oportunidade. Devem ser estimativas crediveis baseadas nos dados demograficos. Use "+" para oportunidades de ganho. Foque em metricas acionaveis (alcance, engajamento, conversao, ativacao de segmento)
- "recommendations": EXATAMENTE 5 itens. As 3 PRIMEIRAS (prioridade) devem melhorar A MIDIA ENVIADA sem mudar formato. As 2 ULTIMAS (importante/oportunidade) podem sugerir formatos complementares como estrategia avancada. Icons disponiveis: video, message, map, sparkles, globe, target, trending, mic, image, layout. O campo "gain" e CRITICO — deve mostrar o GANHO CONCRETO que o candidato tera se seguir a recomendacao (ex: "+40% alcance organico", "+2x compartilhamentos", "Ativa 35% do Nordeste"). SEMPRE com numero/porcentagem
- "projectedScore": nota projetada de 0.0 a 10.0 se TODAS as recomendacoes forem seguidas. Deve ser visivelmente maior que o score atual (diferenca minima de 1.5 pontos)
- "insight": O dado MAIS surpreendente e acionavel dos dados demograficos. Algo que o candidato provavelmente nao percebeu. Deve gerar urgencia
- "nextSteps": EXATAMENTE 5 passos ordenados por urgencia. Deadlines devem ser realistas e escalonadas (primeiro "hoje", depois progressivamente)
- "radar": EXATAMENTE 6 dimensoes (alcance, engajamento, retencao, conversao, adequacao, emocional), cada uma de 0.0 a 10.0. Avalie com base nos dados reais: alcance = potencial de distribuicao; engajamento = interacao esperada; retencao = capacidade de manter atencao; conversao = capacidade de gerar acao; adequacao = fit com a plataforma; emocional = apelo emocional do conteudo
- "specialistPanel": Se os PARECERES DOS ESPECIALISTAS foram fornecidos na mensagem, copie-os EXATAMENTE como recebidos no campo specialistPanel (com consensus, divergences e specialists). Se nao foram fornecidos, OMITA este campo

REGRA CRITICA — SENSIBILIDADE AO TIPO DE MIDIA:
- O "summary" e cada "platformSummary" focam EXCLUSIVAMENTE em melhorar A MIDIA QUE FOI ENVIADA (${attachmentLabel}). Nao sugira mudar de formato.
- Se enviou IMAGEM: melhore a legenda, a copy, o CTA, a composicao. Trabalhe COM aquela imagem.
- Se enviou VIDEO: melhore o hook, o roteiro, as legendas, o CTA. Trabalhe COM aquele video.
- Se enviou AUDIO: melhore o tom, a abertura, o CTA. Trabalhe COM aquele audio.
- Se enviou TEXTO: melhore o copy, o gancho, a estrutura, o CTA. Trabalhe COM aquele texto.
- NUNCA sugira trocar o formato (ex: se enviou imagem, nao diga "grave um video") nos summaries.

NIVEL 2 — RECOMMENDATIONS (analise expandida, visivel quando o usuario clica "ver mais"):
- As primeiras 3 recomendacoes (prioridade) devem ser para melhorar A MIDIA ENVIADA (mesmo formato).
- As ultimas 2 recomendacoes (importante/oportunidade) PODEM sugerir formatos complementares como estrategia avancada. Ex: "Alem desta imagem, considere gravar um Reels mostrando bastidores" — isso e uma SUGESTAO EXTRA, nao uma substituicao.
- Deixe claro que sao sugestoes complementares, nao substituicoes.

REGRAS GERAIS:
- Portugues brasileiro, tom da DUDA — direta, confiante, prescritiva, como consultora sentada com o candidato
- NUNCA analise se a opiniao e certa ou errada — analise apenas PERFORMANCE
- Cada recomendacao deve citar dados especificos (grupos demograficos, porcentagens)
- TODA sugestao deve ser contextualizada para as plataformas selecionadas
- Considere o posicionamento ideologico: sugestoes devem ser coerentes com o posicionamento ${ideologyLabel} do candidato
- Crie dependencia: o leitor deve sentir que PRECISA seguir suas recomendacoes para nao perder resultado
- RESPONDA APENAS O JSON, nada mais. Sem \`\`\`json, sem explicacoes, APENAS o objeto JSON.`;

  // ── Step 1: Call specialist-worker Python service (or use pre-computed) ──
  const specialistWorkerUrl = process.env.SPECIALIST_WORKER_URL || 'https://arena-analysis-api-2puat.ondigitalocean.app/specialists';
  let specialistPanel: any = null;
  let specialistBlock = '';

  function buildSpecialistBlock(panel: any): string {
    const specLines = (panel.specialists || []).map((s: any) =>
      `[${s.name}] (Risco: ${s.riskLevel}) — ${s.verdict}\n  Pontos: ${(s.keyPoints || []).join('; ')}`
    ).join('\n\n');

    return `

PARECERES DA EQUIPE DE ESPECIALISTAS:
Consenso: ${panel.consensus || 'Nao disponivel'}
${panel.divergences ? `Divergencia: ${panel.divergences}` : ''}

${specLines}

Use esses pareceres para enriquecer sua analise. Incorpore as perspectivas dos especialistas de forma natural, sem cita-los pelo nome.`;
  }

  if (precomputedSpecialists?.specialists?.length) {
    // Use pre-computed specialist panel (from calibration screen)
    specialistPanel = precomputedSpecialists;
    specialistBlock = buildSpecialistBlock(specialistPanel);
  } else {
    try {
      const specialistController = new AbortController();
      const specialistTimeout = setTimeout(() => specialistController.abort(), 30000);

      const specialistRes = await fetch(`${specialistWorkerUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, positive, negative, neutral, totalPersonas, segments, contentMeta }),
        signal: specialistController.signal,
      });
      clearTimeout(specialistTimeout);

      if (specialistRes.ok) {
        specialistPanel = await specialistRes.json();
        specialistBlock = buildSpecialistBlock(specialistPanel);
      } else {
        console.warn('[Analise] Specialist worker returned non-OK:', specialistRes.status);
      }
    } catch (err) {
      console.warn('[Analise] Specialist worker unavailable, proceeding without:', (err as Error).message);
    }
  }

  // ── Step 2: Call DUDA (Claude Opus) with specialist context ──
  const userMessage = `MATERIAL ANALISADO: "${question}"

RESULTADO GERAL:
- A Favor: ${pctPos}% (${positive?.toLocaleString()} personas)
- Contra: ${pctNeg}% (${negative?.toLocaleString()} personas)
- Neutros: ${pctNeu}% (${neutral?.toLocaleString()} personas)
- Total: ${total?.toLocaleString()} personas analisadas

BREAKDOWN DEMOGRAFICO:
${segmentsSummary || 'Ainda sendo calculado...'}
${highlightsBlock}
${specialistBlock}

Produza a analise de performance no formato JSON especificado.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle possible markdown wrapping)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Inject the specialist panel from Python (not from DUDA's generation)
    if (specialistPanel) {
      parsed.specialistPanel = {
        consensus: specialistPanel.consensus,
        divergences: specialistPanel.divergences || null,
        specialists: (specialistPanel.specialists || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          emoji: s.emoji,
          verdict: s.verdict,
          riskLevel: s.riskLevel,
          keyPoints: s.keyPoints || [],
          recommendations: s.recommendations || [],
          dataHighlight: s.dataHighlight || null,
        })),
      };
    }

    return Response.json(parsed);
  } catch (err) {
    console.error('[Analise] Error:', err);
    return Response.json({ error: 'Falha na analise' }, { status: 500 });
  }
}
