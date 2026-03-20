import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, positive, negative, neutral, totalPersonas, segments, phase, contentMeta } = body;

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

  const mediaLabel = contentMeta?.mediaType || 'nao especificado';
  const ideologyLabel = contentMeta?.candidateIdeology || 'nao especificado';
  const regionLabel = contentMeta?.region === 'brasil' ? 'Brasil (Nacional)' :
    (contentMeta?.city ? `${contentMeta.city} - ${contentMeta.region}` : contentMeta?.region || 'Brasil');

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
- Cores do partido/campanha devem ser consistentes com o restante da comunicacao`
  };

  const platformBlock = platformKnowledge[mediaLabel] || '';

  const contentTypeLabel = contentMeta?.contentType || 'conteudo';

  const systemPrompt = `Voce e um CMO (Chief Marketing Officer) de altissimo nivel, especialista em performance de conteudo politico. Voce NAO analisa opiniao politica — voce analisa PERFORMANCE DE CONTEUDO. Seu trabalho e dizer ao candidato exatamente o que fazer para que o material performe melhor.

Voce e PRESCRITIVO, nao descritivo. Voce COMANDA o caminho, nao descreve o que aconteceu. Use verbos no imperativo: "Faca X", "Ajuste Y", "Elimine Z".

CONTEXTO DO MATERIAL:
- Plataforma: ${mediaLabel.toUpperCase()}
- Posicionamento ideologico do candidato: ${ideologyLabel}
- Regiao alvo: ${regionLabel}

${platformBlock}

FORMATO OBRIGATORIO — responda EXCLUSIVAMENTE com um JSON valido, sem markdown, sem texto antes ou depois. O JSON deve seguir EXATAMENTE esta estrutura:

{
  "headline": "Frase curta e direta de impacto, orientada a acao. Maximo 20 palavras. Estilo McKinsey.",
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
      "text": "Recomendacao curta e direta, imperativa",
      "priority": "prioridade|importante|oportunidade",
      "detail": "Explicacao expandida com dados demograficos e porcentagens especificas. 1-2 frases."
    }
  ],
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
  ]
}

REGRAS DO JSON:
- "score": nota de 0.0 a 10.0 avaliando a performance geral do conteudo (considere aprovacao, engajamento potencial e adequacao a plataforma)
- "tags": EXATAMENTE 2 tags — primeira: plataforma + regiao, segunda: tipo de conteudo + tema principal
- "stats": EXATAMENTE 3 metricas de oportunidade. Devem ser estimativas credIveis baseadas nos dados demograficos. Use "+" para oportunidades de ganho. Foque em metricas acionaveis (alcance, engajamento, conversao, ativacao de segmento)
- "recommendations": EXATAMENTE 5 itens. Mix de prioridades: 2-3 "prioridade", 1-2 "importante", 1 "oportunidade". Icons disponiveis: video, message, map, sparkles, globe, target, trending, mic, image, layout
- "insight": O dado MAIS surpreendente e acionavel dos dados demograficos. Algo que o candidato provavelmente nao percebeu. Deve gerar urgencia
- "nextSteps": EXATAMENTE 5 passos ordenados por urgencia. Deadlines devem ser realistas e escalonadas (primeiro "hoje", depois progressivamente)

REGRAS GERAIS:
- Portugues brasileiro, tom de CMO senior — direto, assertivo, sem rodeios
- NUNCA analise se a opiniao e certa ou errada — analise apenas PERFORMANCE
- Cada recomendacao deve citar dados especificos (grupos demograficos, porcentagens)
- TODA sugestao deve ser contextualizada para ${mediaLabel.toUpperCase()}
- Considere o posicionamento ideologico: sugestoes devem ser coerentes com o posicionamento ${ideologyLabel} do candidato
- Crie dependencia: o leitor deve sentir que PRECISA seguir suas recomendacoes para nao perder resultado
- RESPONDA APENAS O JSON, nada mais. Sem \`\`\`json, sem explicacoes, APENAS o objeto JSON.`;

  const userMessage = `MATERIAL ANALISADO: "${question}"

RESULTADO GERAL:
- A Favor: ${pctPos}% (${positive?.toLocaleString()} personas)
- Contra: ${pctNeg}% (${negative?.toLocaleString()} personas)
- Neutros: ${pctNeu}% (${neutral?.toLocaleString()} personas)
- Total: ${total?.toLocaleString()} personas analisadas

BREAKDOWN DEMOGRAFICO:
${segmentsSummary || 'Ainda sendo calculado...'}

Produza a analise de performance no formato JSON especificado.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2500,
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

    return Response.json(parsed);
  } catch (err) {
    console.error('[Analise] Error:', err);
    return Response.json({ error: 'Falha na analise' }, { status: 500 });
  }
}
