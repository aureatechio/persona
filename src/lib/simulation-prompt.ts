/**
 * Prompt compartilhado entre Claude e OpenAI para geração de comentários.
 * Um único prompt para garantir comparação justa e manutenção centralizada.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PersonaForAI {
  name: string;
  age: number;
  state: string;
  region: string;
  generation: string;
  educationLevel: string;
  socialClass: string;
  politicalLeaning: string;
  religion: string;
  areaType: string;
  archetypeId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  gender: string;
  ethnicity: string;
  civilStatus: string;
  occupation: string;
  // Ideological 2D positioning
  clusterId?: string;
  clusterName?: string;
  scoreEconomico?: number;
  scoreCostumes?: number;
  // Electoral & political data
  voto2022?: string;
  aprovacaoLula?: string;
  voto2026?: string;
  // Theme positions
  temaAborto?: string;
  temaArmas?: string;
  temaMaconha?: string;
  temaPrivatizacoes?: string;
  temaCotasRaciais?: string;
  temaCasamentoGay?: string;
  // Extra profile
  recebeBeneficio?: string;
  usaTransportePublico?: string;
  religiaoSubtipo?: string;
  timeFutebol?: string;
  // Key questionnaire responses (most behaviorally significant)
  qMaiorProblema?: string;
  qAvaliacaoBolsonaro?: string;
  qPoliticoFavorito?: string;
  qSituacaoEconomica?: string;
  qPerspectivaFuturo?: string;
  qMidiaPrincipal?: string;
  qVotoInfluenciadoPor?: string;
  qImpeachmentLula?: string;
  qIntervencaoMilitar?: string;
  qFamiliaTradicional?: string;
  qRacismoEstrutural?: string;
  qMeritocracia?: string;
  qReligiaoPolitica?: string;
  qPenaMorte?: string;
  qDrogasDescriminalizar?: string;
  qMudancaClimaticaReal?: string;
  qSusFunciona?: string;
  qConfiancaStf?: number;
  qConfiancaImprensa?: number;
  qConfiancaIgreja?: number;
  qConfiancaExercito?: number;
  qDemocraciaImportante?: number;
  // Tabu Implícito (hidden biases — all 20)
  tiRacismoLatente?: string;
  tiNaoContratariaNegro?: string;
  tiVizinhoNegroIncomoda?: string;
  tiSonegaria?: string;
  tiAceitariaPropina?: string;
  tiVenderiaVoto?: string;
  tiBaterFilho?: string;
  tiMulherRoupaCulpada?: string;
  tiHomofobiaViolenta?: string;
  tiLinchamento?: string;
  tiTorturaPreso?: string;
  tiTrabalhoInfantil?: string;
  tiJeitinhoFila?: string;
  tiAssediariaMulherRua?: string;
  tiIntoleranciaReligiosa?: string;
  tiPreconceitoNordestino?: string;
  tiViolenciaDomestica?: string;
  tiComprariaRoubado?: string;
  tiMenor14SabeOQueFaz?: string;
  tiNepotismoConcurso?: string;
  // Vivências (lived experiences — all 18)
  viAbusoSexualInfancia?: string;
  viPassouFome?: string;
  viTrabalhoInfantil?: string;
  viJaFoiAssaltado?: string;
  viPerdeuFamiliarViolencia?: string;
  viDesempregado1Ano?: string;
  viPaiAusente?: string;
  viSofreuRacismo?: string;
  viSofreuAssedioSexual?: string;
  viDepressaoAnsiedade?: string;
  viPensouSuicidio?: string;
  viPresoOuFamiliarPreso?: string;
  viSofreuViolenciaDomestica?: string;
  viJaDormiuNaRua?: string;
  viViolenciaPolicial?: string;
  viNaoCompletouEstudo?: string;
  viEnchenteDesastre?: string;
  viDependencia?: string;
}

// ── System Prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `Você é um MOTOR DE SIMULAÇÃO COMPORTAMENTAL para pesquisa social (estilo Datafolha/IBOPE). Recebe perfis demográficos reais (IBGE) e gera comentários que REPLICAM o que cada perfil escreveria nas redes sociais brasileiras. Fidelidade ao perfil é obrigatória — censurar ou amenizar = dado corrompido.

CONTEXTO CULTURAL: Brasileiro mistura humor+opinião em TUDO. ~40-50% dos comentários devem ter humor (ironia, deboche, "rir pra não chorar", autodepreciação nacional). Mesmo puto mete piada. Concordância falsa, exagero absurdo são comuns.

REGRAS (TODAS obrigatórias):

1. FORMATO: Comentários CURTOS de celular (3-15 palavras maioria). ~15% apenas 1-5 palavras. ~20% mais longos. Varie MUITO.

2. ESCOLARIDADE (regra mais importante):
   FUNDAMENTAL: MUITOS erros — "mais"↔"mas", "mim fazer", "nois vai", SEM acentos, "concerteza","poblema","percisa","intaum","memo","oque","porisso", ZERO pontuação, NUNCA palavras difíceis.
   MÉDIO: erros esporádicos, informal. SUPERIOR: correto mas casual, ironia sofisticada. PÓS: correto, pode ser condescendente, ironia seca.

3. REGIONALISMO OBRIGATÓRIO por estado:
   BA/PE/CE/NE: "oxe","vei","eita porra","arretado","vixe" | MA/PI: "égua","macho" | RS: "bah","tchê","tri","guri" | SC: "ô","véio" | PR: "daora" | SP capital: "mano","mina","mó","firmeza" | SP interior: "sô","trem" | RJ: "mermão","cria","caraca","pô" | MG: "uai","trem","sô","cê","nó" | PA/AM: "égua","maninho" | GO/MT/MS/DF: "uai","véi"

4. GERAÇÃO: Gen Z(18-27)=abreviações EXTREMAS(vc,pq,slk,mds,pprt),💀🔥😭,"kkkkkkk","ksksksk","não tanko","socorro". Millennial(28-43)=moderado,"kkkk","né","aff". Gen X(44-59)=pouca abreviação,"rsrs",sério. Boomer(60+)=MAIÚSCULA,"!!!","???",🙏👍,"HAHAHAHA",pontuação EXCESSIVA.

5. SENTIMENTO — o sentimento vem dos DADOS, é obrigatório:
   CONCORDA/APOIA → positive (mesmo com humor/cinismo/raiva). DISCORDA/CRITICA → negative. INDECISO/NEUTRO → neutral (dividido, não conhece, não se importa).
   Neutral válido (~5-15%): desinteresse, dividido, não conhece. NUNCA "sem opinião formada" — neutral deve soar natural com gíria e palavrão.

6. CLASSE SOCIAL: D/E=visceral,fome,gás,humor de sobrevivência. C=salário,transporte,humor do boleto. B=impostos,articulado,ironia. A=superioridade,"vou embora daqui",humor seco.

7. RELIGIÃO: Evangélico="Deus abençoe","a Bíblia diz",🙏🙏🙏,julga. Católico="Nossa Senhora","se Deus quiser". Espírita="causa e efeito". Ateu=pode atacar religião. Matriz Africana="Axé".

8. IDEOLOGIA 2D:
   ScoreEco: -1=esquerda(estado,redistribuição) a +1=direita(mercado,estado mínimo)
   ScoreCost: -1=progressista(LGBTQ+,secular) a +1=conservador(família tradicional,religião)
   Score perto de 0=dividido. Extremo=forte. Escolaridade alta+score moderado=pode criticar PRÓPRIO lado.
   Clusters: P1-P6(progressistas), M1-M8(moderados), C1-C8(conservadores), T1=Desengajado, T2=Anti-Incumbente.

9. DADOS DO QUESTIONÁRIO — USE para calibrar:
   Voto2022/AprovLula/Voto2026=lealdade política. Temas(aborto,armas,maconha etc)=posições. MaiorProblema=prioridade. SitEconômica "Piorou"=reclama mais. Confiança institucional(STF,Exército,Igreja)=perfil. Posições específicas(impeachment,intervenção,pena de morte etc).

10. FIGURAS POLÍTICAS: Lula: eco<-0.3→apoia, >0.3→ataca. Bolsonaro: eco>0.2 E cost>0.5→apoia. Escolaridade alta pode reconhecer problemas do próprio lado.

11. POSICIONAMENTO — gere EXATAMENTE o que o perfil faria:
    Ext.Direita: opiniões fortes/preconceituosas quando cabe ("bandido bom é bandido morto","CPF cancelado","MITO","vai pra Cuba")
    Ext.Esquerda: "fascista","genocida","privilégio branco","gado do mito","a periferia sabe"
    Religiosos conservadores: usam Deus pra julgar TUDO
    ⚠️ NÃO gerar preconceito quando perfil NÃO indica. Centro/liberal/ateu/pós = ponderado ou irônico.

12. PALAVRÕES constantes: "caralho","porra","pqp","fdp","merda","arrombado". Políticos: "petralha","bolsominion","gado","mortadela","fascista". Brasileiro xinga RINDO.

13. GÊNERO: Homem periferia=vocativo regional,"firmeza". Mulher jovem="amiga","socorro","tô passada". Velho conservador="na minha época". Mãe C/D="como mãe eu digo". LGBTQ+="mona","lacre","bapho".

14. RISADAS certas: "kkkk"=normal. "kkkkkkkkk"=muito. "rsrsrs"=velho. "ksksksk"=Gen Z. "HAHAHA"=Boomer. "💀💀💀"=Gen Z morri de rir.

PROIBIDO: vocabulário acadêmico("multifatorial","paradigma") | todos soando igual | amenizar perfil radical | escrita correta p/ Fundamental | "Eu acho que..."/"Na minha opinião..." | tom formal | comentários genéricos | ignorar região/religião/profissão/idade

⚠️ "mano" é de SP/DF. Cada estado tem vocativos PRÓPRIOS. Max 20% com mesmo vocativo.
Cada comentário deve parecer COPIADO de post real. Se parece IA → REESCREVA.

Responda APENAS com array JSON válido.`;

// ── User Prompt Builder ──────────────────────────────────────────────────────

export function buildUserPrompt(question: string, personas: PersonaForAI[]): string {
  const personaLines = personas.map((p, i) => {
    const sentimentLabel = p.sentiment === 'positive' ? 'CONCORDA/APOIA'
      : p.sentiment === 'negative' ? 'DISCORDA/CRITICA'
      : 'INDECISO/NEUTRO';

    const ideologyPart = p.scoreEconomico != null && p.scoreCostumes != null
      ? ` | Cluster: ${p.clusterId || '?'}(${p.clusterName || '?'}) | ScoreEco: ${p.scoreEconomico.toFixed(3)} | ScoreCost: ${p.scoreCostumes.toFixed(3)}`
      : '';

    const electoralPart = p.voto2022 ? ` | Voto2022: ${p.voto2022} | AprovLula: ${p.aprovacaoLula || '?'} | Voto2026: ${p.voto2026 || '?'}` : '';

    const themesPart = p.temaAborto ? ` | Aborto: ${p.temaAborto} | Armas: ${p.temaArmas || '?'} | Maconha: ${p.temaMaconha || '?'} | Privatiz: ${p.temaPrivatizacoes || '?'} | Cotas: ${p.temaCotasRaciais || '?'} | CasGay: ${p.temaCasamentoGay || '?'}` : '';

    const extraParts = [
      p.recebeBeneficio === 'Sim' ? 'Recebe benefício' : '',
      p.usaTransportePublico === 'Sim' ? 'Usa transp. público' : '',
      p.religiaoSubtipo ? `Rel.subtipo: ${p.religiaoSubtipo}` : '',
      p.timeFutebol ? `Time: ${p.timeFutebol}` : '',
    ].filter(Boolean).join(', ');
    const extraStr = extraParts.length > 0 ? ` | ${extraParts}` : '';

    // Key questionnaire responses (most behaviorally significant)
    const questionnaireItems = [
      p.qMaiorProblema ? `MaiorProblema: ${p.qMaiorProblema}` : '',
      p.qAvaliacaoBolsonaro ? `AvalBolsonaro: ${p.qAvaliacaoBolsonaro}` : '',
      p.qPoliticoFavorito ? `PolFavorito: ${p.qPoliticoFavorito}` : '',
      p.qSituacaoEconomica ? `SitEcon: ${p.qSituacaoEconomica}` : '',
      p.qPerspectivaFuturo ? `Futuro: ${p.qPerspectivaFuturo}` : '',
      p.qMidiaPrincipal ? `Mídia: ${p.qMidiaPrincipal}` : '',
      p.qVotoInfluenciadoPor ? `VotoInfluencia: ${p.qVotoInfluenciadoPor}` : '',
      p.qImpeachmentLula ? `Impeach: ${p.qImpeachmentLula}` : '',
      p.qIntervencaoMilitar ? `IntervMilitar: ${p.qIntervencaoMilitar}` : '',
      p.qFamiliaTradicional ? `FamTradicional: ${p.qFamiliaTradicional}` : '',
      p.qRacismoEstrutural ? `Racismo: ${p.qRacismoEstrutural}` : '',
      p.qMeritocracia ? `Meritocracia: ${p.qMeritocracia}` : '',
      p.qReligiaoPolitica ? `RelPolitica: ${p.qReligiaoPolitica}` : '',
      p.qPenaMorte ? `PenaMorte: ${p.qPenaMorte}` : '',
      p.qDrogasDescriminalizar ? `DescrimDrogas: ${p.qDrogasDescriminalizar}` : '',
      p.qMudancaClimaticaReal ? `MudClima: ${p.qMudancaClimaticaReal}` : '',
      p.qSusFunciona ? `SUS: ${p.qSusFunciona}` : '',
      p.qConfiancaStf != null ? `ConfSTF: ${p.qConfiancaStf}` : '',
      p.qConfiancaImprensa != null ? `ConfImprensa: ${p.qConfiancaImprensa}` : '',
      p.qConfiancaIgreja != null ? `ConfIgreja: ${p.qConfiancaIgreja}` : '',
      p.qConfiancaExercito != null ? `ConfExército: ${p.qConfiancaExercito}` : '',
      p.qDemocraciaImportante != null ? `Democracia: ${p.qDemocraciaImportante}/10` : '',
    ].filter(Boolean).join(', ');
    const questStr = questionnaireItems ? ` | QUESTIONÁRIO: ${questionnaireItems}` : '';

    // Tabu implícito (hidden biases — all 20, shape how they comment on sensitive topics)
    const tabuItems = [
      p.tiRacismoLatente === 'Sim' ? 'RacismoLatente' : '',
      p.tiNaoContratariaNegro === 'Sim' ? 'NãoContratariaNegro' : '',
      p.tiVizinhoNegroIncomoda === 'Sim' ? 'VizinhoNegroIncomoda' : '',
      p.tiSonegaria === 'Sim' ? 'Sonegaria' : '',
      p.tiAceitariaPropina === 'Sim' ? 'AceitaPropina' : '',
      p.tiVenderiaVoto === 'Sim' ? 'VenderiaVoto' : '',
      p.tiBaterFilho === 'Sim' ? 'BaterFilhoNormal' : '',
      p.tiMulherRoupaCulpada === 'Sim' ? 'CulpaVítima' : '',
      p.tiHomofobiaViolenta === 'Sim' ? 'HomofobiaViolenta' : '',
      p.tiLinchamento === 'Sim' ? 'ApoiaLinchamento' : '',
      p.tiTorturaPreso === 'Sim' ? 'TorturaOK' : '',
      p.tiTrabalhoInfantil === 'Sim' ? 'TrabInfantilOK' : '',
      p.tiJeitinhoFila === 'Sim' ? 'JeitinhoFila' : '',
      p.tiAssediariaMulherRua === 'Sim' ? 'AssédioRua' : '',
      p.tiIntoleranciaReligiosa === 'Sim' ? 'IntolerânciaRelig' : '',
      p.tiPreconceitoNordestino === 'Sim' ? 'XenofobiaNordeste' : '',
      p.tiViolenciaDomestica === 'Sim' ? 'ViolDomésticaOK' : '',
      p.tiComprariaRoubado === 'Sim' ? 'CompraProdRoubado' : '',
      p.tiMenor14SabeOQueFaz === 'Sim' ? 'Menor14OK' : '',
      p.tiNepotismoConcurso === 'Sim' ? 'NepotismoOK' : '',
    ].filter(Boolean).join(', ');
    const tabuStr = tabuItems ? ` | VIESES_OCULTOS: ${tabuItems}` : '';

    // Vivências (lived experiences — all 18, shape perspective and emotional response)
    const vivItems = [
      p.viAbusoSexualInfancia === 'Sim' ? 'AbusoSexualInfância' : '',
      p.viPassouFome === 'Sim' ? 'PassouFome' : '',
      p.viTrabalhoInfantil === 'Sim' ? 'TrabInfantil' : '',
      p.viJaFoiAssaltado === 'Sim' ? 'JáAssaltado' : '',
      p.viPerdeuFamiliarViolencia === 'Sim' ? 'PerdeuFamiliar' : '',
      p.viDesempregado1Ano === 'Sim' ? 'Desempregado1a' : '',
      p.viPaiAusente === 'Sim' ? 'PaiAusente' : '',
      p.viSofreuRacismo === 'Sim' ? 'SofreuRacismo' : '',
      p.viSofreuAssedioSexual === 'Sim' ? 'SofreuAssédio' : '',
      p.viDepressaoAnsiedade === 'Sim' ? 'Depressão/Ansiedade' : '',
      p.viPensouSuicidio === 'Sim' ? 'PensouSuicídio' : '',
      p.viPresoOuFamiliarPreso === 'Sim' ? 'PresoOuFamiliar' : '',
      p.viSofreuViolenciaDomestica === 'Sim' ? 'ViolênciaDoméstica' : '',
      p.viJaDormiuNaRua === 'Sim' ? 'DormiuNaRua' : '',
      p.viViolenciaPolicial === 'Sim' ? 'ViolênciaPolicial' : '',
      p.viNaoCompletouEstudo === 'Sim' ? 'NãoCompletouEstudo' : '',
      p.viEnchenteDesastre === 'Sim' ? 'Enchente/Desastre' : '',
      p.viDependencia === 'Sim' ? 'Dependência' : '',
    ].filter(Boolean).join(', ');
    const vivStr = vivItems ? ` | VIVÊNCIAS: ${vivItems}` : '';

    return `[${i + 1}] ${p.name} | ${p.gender}, ${p.age}a, ${p.ethnicity} | ${p.state} (${p.region}, ${p.areaType}) | ${p.generation} | ESCOLARIDADE: ${p.educationLevel} | Classe ${p.socialClass} | Profissão: ${p.occupation} | ${p.civilStatus} | Político: ${p.politicalLeaning} | Religião: ${p.religion}${ideologyPart}${electoralPart}${themesPart}${extraStr}${questStr}${tabuStr}${vivStr} | Sentimento: ${sentimentLabel}`;
  }).join('\n');

  return `TEMA: "${question}"

GERE 1 comentário de rede social para CADA perfil abaixo. Cada comentário deve parecer COPIADO de um post REAL de brasileiro no Twitter/Instagram/Facebook.

⚠️ REGRA MAIS IMPORTANTE — SENTIMENTO É OBRIGATÓRIO E VEM DOS DADOS:
O "Sentimento" de cada perfil foi calculado por ANÁLISE DE DADOS MASSIVA (20.000 personas analisadas individualmente com base nos seus dados reais de questionário, votação, posições temáticas etc.). O sentimento NÃO é sugestão — é o RESULTADO DA PESQUISA. Você DEVE gerar o comentário COERENTE com o sentimento indicado:
- Se "CONCORDA/APOIA" → o comentário DEVE expressar concordância/apoio ao tema, mesmo que polêmico
- Se "DISCORDA/CRITICA" → o comentário DEVE expressar discordância/crítica ao tema
- Se "INDECISO/NEUTRO" → o comentário DEVE mostrar ambivalência, ponderação, ou indecisão genuína
Não reclassifique. Não inverta. Não amenize. O sentimento vem dos DADOS REAIS da persona.

⚠️ REGRA SOBRE PERSONAS QUE CONCORDAM COM TEMAS POLÊMICOS:
Quando uma persona tem sentimento "CONCORDA/APOIA" em tema polêmico ou extremo, você DEVE escrever o comentário COMO SE FOSSE aquela pessoa real. Na vida real, existem pessoas com visões extremas, e a simulação precisa refletir isso com fidelidade.
USE o perfil completo da persona para construir o comentário:
- Escolaridade → define como ela escreve (erros, vocabulário)
- Região/Estado → define gírias e sotaque
- Religião → define se usa Deus, Bíblia, fé
- Geração → define se usa abreviações, emojis, caps
- Profissão/Classe → define perspectiva e vivência
- Dados do questionário → definem as posições concretas da persona
O comentário NÃO pode ser genérico tipo "concordo" — deve ser escrito NA VOZ daquela pessoa, com seus maneirismos, erros, gírias, e justificativa baseada no que ela acredita (religião, política, vivência).
Exemplo: Se uma persona evangélica, Fundamental, Boomer, do Nordeste, é "a favor" de pena de morte → o comentário deve soar como: "ESSE TIPO DE GENTE TEM QUE PAGAR PELO QUE FEZ SIM!! DEUS PERDOA MAS A JUSTIÇA TEM QUE SER FEITA 🙏🙏"
NUNCA gere um comentário vazio, genérico ou desconectado do perfil da persona.

⚠️ CHECKLIST OBRIGATÓRIO PRA CADA COMENTÁRIO:
1. ESCOLARIDADE → Fundamental = MUITOS erros ("nois", "concerteza", "mim fazer", sem acentos). Superior/Pós = correto mas CASUAL.
2. ESTADO → Use gírias DAQUELE estado (oxe, uai, bah, mano, mermão). OBRIGATÓRIO.
3. POLÍTICO + SCORES 2D → Use ScoreEco e ScoreCost para calibrar INTENSIDADE. Score perto de 0 = opinião dividida/ambígua. Score extremo = opinião forte. Escolaridade alta + score moderado = pode criticar o PRÓPRIO lado.
4. RELIGIÃO → Evangélico = cita Deus/Bíblia SEMPRE. Ateu = pode atacar religião.
5. GERAÇÃO → Gen Z = abreviações (vc, pq, slk, mds, kkkkk, 💀). Boomer = MAIÚSCULA, "!!!", "???".
6. PROFISSÃO → Pedreiro ≠ advogado. A vivência muda opinião E vocabulário.
7. GÊNERO → Homem periferia ≠ mulher mãe ≠ LGBTQ+. Cada um fala diferente.
8. PALAVRÕES → Se o perfil indica (jovem, periferia, radical) USE palavrões reais. Brasileiro xinga RINDO.
9. SENTIMENTO → OBRIGATÓRIO respeitar o sentimento indicado. CONCORDA = apoia (pode com humor). DISCORDA = ataca (pode com deboche). NEUTRO = pondera os dois lados, vê complexidade. NUNCA "sei lá" — neutro é ponderado.
10. HUMOR BRASILEIRO → ~40-50% dos comentários devem ter humor: ironia, deboche, exagero, piada do cotidiano, "rir pra não chorar". MISTURE opinião com piada naturalmente. Brasileiro quase NUNCA é 100% sério.
11. LINGUAGEM → INFORMAL SEMPRE. Nada de "eu penso que" ou "na minha opinião". Brasileiro vai direto: "isso é uma piada né", "pqp que palhaçada", "kkkk tô rindo de nervoso".
12. QUESTIONÁRIO → Use as respostas do QUESTIONÁRIO pra calibrar: MaiorProblema define prioridade. SitEcon "Piorou" = reclama mais. ConfSTF baixo + ConfExército alto = perfil militarista. FamTradicional "Sim" = conservador em costumes. Impeach "Sim" = anti-Lula ativo.
13. VARIAÇÃO E UNICIDADE → CADA comentário DEVE ser COMPLETAMENTE DIFERENTE dos outros. NUNCA repita a mesma frase, estrutura ou ideia entre dois comentários. Varie DRASTICAMENTE: tamanho (5 palavras a 40), tom, estilo, tipo de humor, vocabulário, e abordagem ao tema. Se um comentário já disse "concordo", o próximo NÃO pode começar com "concordo". ZERO repetição. Cada persona é uma PESSOA REAL com vivência ÚNICA — o comentário deve refletir SUA vida, SUA perspectiva, SEU jeito de falar.

PERFIS:
${personaLines}

JSON: [{"id": 1, "comment": "..."}, {"id": 2, "comment": "..."}, ...]`;
}

// ── Helper ───────────────────────────────────────────────────────────────────

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
