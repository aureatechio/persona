/**
 * Comment Templates Database
 * ==========================
 * 200+ templates de comentários organizados por arquétipo × sentimento × tópico.
 * Cada template possui slots regionais ({opener}, {filler}, {closer}, {intensifier})
 * e nível de intensidade para distribuição realista.
 *
 * Distribuição de intensidade (realismo total):
 *   mild:     40% — opiniões normais, educadas
 *   moderate: 30% — opiniões firmes, sem ofensa direta
 *   strong:   20% — linguagem agressiva, preconceitos implícitos
 *   extreme:  10% — preconceito explícito, sem filtro
 */

export type Intensity = 'mild' | 'moderate' | 'strong' | 'extreme';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface CommentTemplate {
  base: string;
  intensity: Intensity;
}

type ArchetypeTemplates = Record<Sentiment, Record<string, CommentTemplate[]>>;

// ── Traditionalist (Conservador & Religioso) ────────────────────────────────

const traditionalist: ArchetypeTemplates = {
  positive: {
    crime: [
      // mild (40%)
      { base: 'concordo, a gente precisa de mais segurança e respeito às leis', intensity: 'mild' },
      { base: 'é isso aí, tem que ter consequência pra quem desrespeita a lei', intensity: 'mild' },
      { base: 'apoio sim, família brasileira precisa de proteção', intensity: 'mild' },
      { base: 'com certeza, chega de impunidade nesse país', intensity: 'mild' },
      // moderate (30%)
      { base: '{opener} concordo!! bandido tem que pagar pelo que faz sim, chega de passar a mão na cabeça', intensity: 'moderate' },
      { base: 'tá certíssimo {filler} tolerância zero com vagabundo!! a lei existe pra ser cumprida', intensity: 'moderate' },
      { base: '{opener} finalmente alguém com coragem de falar!! chega de defender bandido', intensity: 'moderate' },
      // strong (20%)
      { base: '{opener} bandido bom é bandido preso!! ou melhor {intensifier}!! chega de passar pano pra marginal', intensity: 'strong' },
      { base: 'tinha q ser tudo na cadeia sem direito a nada {filler} esse país só melhora quando parar de ter dó de vagabundo', intensity: 'strong' },
      // extreme (10%)
      { base: '{opener} bandido bom é bandido morto!! acabou!! quem defende bandido é tão ruim quanto!! {closer}', intensity: 'extreme' },
    ],
    social: [
      { base: 'concordo com a iniciativa, desde que respeite os valores da família', intensity: 'mild' },
      { base: 'apoio, mas tem que ter equilíbrio com os bons costumes', intensity: 'mild' },
      { base: '{opener} tá certo!! tem que preservar nossos valores e nossa cultura', intensity: 'moderate' },
      { base: 'isso mesmo {filler} a moral e a família vêm primeiro, sempre', intensity: 'moderate' },
      { base: '{opener} a base é a família tradicional e ponto final!! quem não gosta problema de quem não gosta', intensity: 'strong' },
    ],
    economy: [
      { base: 'faz sentido, tem que ter responsabilidade com o dinheiro público', intensity: 'mild' },
      { base: 'concordo, menos impostos e mais trabalho é o caminho', intensity: 'mild' },
      { base: '{opener} certíssimo!! quem trabalha tem que ser valorizado, não quem fica parado esperando esmola', intensity: 'moderate' },
      { base: 'apoio total {filler} o Brasil precisa de gente que trabalha não de vagabundo mamando no governo', intensity: 'moderate' },
      { base: '{opener} enquanto esse povo ficar querendo tudo de graça esse país não vai pra frente nunca {closer}', intensity: 'strong' },
    ],
    politics: [
      { base: 'concordo, precisamos de mais ordem e responsabilidade na política', intensity: 'mild' },
      { base: 'é verdade, político tem que trabalhar pelo povo, não pelo próprio bolso', intensity: 'mild' },
      { base: '{opener} tá na hora de limpar esse congresso!! só tem ladrão', intensity: 'moderate' },
      { base: '{opener} político corrupto tinha q ser preso e perder tudo!! chega de roubar o povo {closer}', intensity: 'strong' },
      { base: 'esse país só vai mudar no dia que botar militar pra governar de novo {filler} democracia aqui não funciona', intensity: 'extreme' },
    ],
    environment: [
      { base: 'entendo a preocupação com o meio ambiente, mas não pode prejudicar quem trabalha', intensity: 'mild' },
      { base: '{opener} o agro sustenta esse país!! tem que ter equilíbrio', intensity: 'moderate' },
    ],
    general: [
      { base: 'concordo plenamente, é questão de bom senso', intensity: 'mild' },
      { base: 'é isso aí {filler} a maioria silenciosa concorda', intensity: 'mild' },
      { base: '{opener} finalmente alguém falando o óbvio!! era hora', intensity: 'moderate' },
      { base: 'como cidadão de bem eu apoio sim {closer}', intensity: 'moderate' },
      { base: '{opener} isso q é falar a verdade!! o povo de bem tá cansado de ficar calado {closer}', intensity: 'strong' },
    ],
  },
  negative: {
    crime: [
      { base: 'discordo, acho que não é por aí que vamos resolver', intensity: 'mild' },
      { base: 'não concordo {filler} tem que ter punição sim mas com humanidade', intensity: 'moderate' },
      { base: '{opener} isso vai contra tudo que a gente acredita como cristão {closer}', intensity: 'moderate' },
    ],
    social: [
      { base: 'não concordo, acho que isso vai contra nossos valores tradicionais', intensity: 'mild' },
      { base: '{opener} isso é exatamente o que tá destruindo a sociedade!! vai contra a natureza', intensity: 'moderate' },
      { base: '{opener} DEUS fez homem e mulher!! ponto final!! essa ideologia de gênero é do demônio', intensity: 'strong' },
      { base: 'isso é coisa do diabo {filler} na minha época ninguém precisava disso e todo mundo era normal', intensity: 'strong' },
      { base: '{opener} essa agenda LGBT quer destruir a família!! quem apoia isso tá perdido!! DEUS VAI COBRAR {closer}', intensity: 'extreme' },
      { base: 'querem enfiar goela abaixo essa palhaçada {filler} homem é homem mulher é mulher e acabou!! ngm me cala {closer}', intensity: 'extreme' },
    ],
    economy: [
      { base: 'discordo, isso não resolve o problema real da economia', intensity: 'mild' },
      { base: '{opener} mais gasto público é a última coisa que esse país precisa', intensity: 'moderate' },
    ],
    politics: [
      { base: 'discordo totalmente, isso é mais uma jogada política pra enganar o povo', intensity: 'mild' },
      { base: '{opener} esse governo tá destruindo o Brasil!! vergonha nacional {closer}', intensity: 'moderate' },
      { base: '{opener} FORA!! tira esses comunistas do poder!! tão acabando com o país {closer}', intensity: 'strong' },
    ],
    environment: [
      { base: 'discordo {filler} isso aí é agenda globalista pra prejudicar o Brasil', intensity: 'moderate' },
      { base: '{opener} esse negócio de ambientalismo é tudo mentira pra frear o progresso do Brasil {closer}', intensity: 'strong' },
    ],
    general: [
      { base: 'discordo {filler} isso vai contra nossos valores mais fundamentais', intensity: 'mild' },
      { base: '{opener} isso é exatamente o que tá destruindo a base da nossa sociedade', intensity: 'moderate' },
      { base: 'absurdo!! quem propõe isso não tem família pra proteger {closer}', intensity: 'strong' },
      { base: 'completamente contra!! precisamos voltar aos nossos princípios cristãos antes que seja tarde demais', intensity: 'moderate' },
    ],
  },
  neutral: {
    crime: [
      { base: 'entendo o ponto mas acho que precisa analisar melhor antes de decidir', intensity: 'mild' },
      { base: 'é complexo {filler} tem que ouvir os dois lados', intensity: 'mild' },
      { base: 'entendo quem defende e quem critica {filler} segurança é tema que divide todo mundo', intensity: 'mild' },
      { base: 'tem gente que sofre dos dois lados dessa questão {filler} não é preto no branco', intensity: 'moderate' },
    ],
    social: [
      { base: 'entendo os dois lados {filler} é um tema que divide famílias inteiras', intensity: 'mild' },
      { base: 'minha cabeça diz uma coisa e meu coração outra nessa questão', intensity: 'mild' },
      { base: 'preciso pensar mais sobre isso, não é tão simples como parece', intensity: 'mild' },
      { base: 'conheço gente boa dos dois lados da discussão {filler} fico dividido', intensity: 'moderate' },
    ],
    economy: [
      { base: 'tem argumentos dos dois lados {filler} difícil dizer quem tá certo', intensity: 'mild' },
      { base: 'na teoria faz sentido mas na prática ninguém sabe como vai ser {filler} é esperar pra ver', intensity: 'mild' },
      { base: 'quem entende de economia mesmo discorda entre si {filler} imagina a gente', intensity: 'moderate' },
    ],
    politics: [
      { base: 'acho que os dois lados têm razão em parte {filler} política é complicado', intensity: 'mild' },
      { base: 'já vi essa promessa de todo político e nunca dá certo {filler} fico desconfiado', intensity: 'moderate' },
      { base: 'sinceramente não confio em nenhum dos lados pra resolver isso {filler} mas torço pra dar certo', intensity: 'moderate' },
    ],
    environment: [
      { base: 'entendo os dois lados {filler} preservar é importante mas o povo precisa trabalhar também', intensity: 'mild' },
      { base: 'difícil achar o equilíbrio nessa questão {filler} quem vive da terra pensa diferente de quem mora na cidade', intensity: 'moderate' },
    ],
    general: [
      { base: 'é uma questão que merece mais debate {filler} não dá pra simplificar', intensity: 'mild' },
      { base: 'vejo argumentos bons dos dois lados {filler} fico em cima do muro nessa', intensity: 'mild' },
      { base: 'entendo quem concorda e quem discorda {filler} a realidade é mais complicada do que parece', intensity: 'mild' },
      { base: 'minha opinião muda dependendo do ângulo que eu olho {filler} é complexo mesmo', intensity: 'mild' },
      { base: 'tenho amigos que pensam diferente de mim nisso e eu entendo o ponto deles {filler} é difícil', intensity: 'moderate' },
      { base: 'consigo ver razão nos dois lados {filler} quando é assim eu prefiro pensar mais antes de falar', intensity: 'mild' },
    ],
  },
};

// ── Activist (Engajado Social / Justiça & Direitos) ─────────────────────────

const activist: ArchetypeTemplates = {
  positive: {
    crime: [
      { base: 'concordo mas lembrando que o sistema carcerário precisa de reforma urgente', intensity: 'mild' },
      { base: 'apoio desde que não criminalize a pobreza como sempre fazem nesse país', intensity: 'mild' },
      { base: '{opener} tem que atacar as causas!! pobreza e desigualdade são a raiz da violência', intensity: 'moderate' },
    ],
    social: [
      { base: 'sim!! isso é um passo importante pra justiça social', intensity: 'mild' },
      { base: 'concordo {filler} precisamos pensar nas pessoas mais vulneráveis sempre', intensity: 'mild' },
      { base: 'apoio total!! igualdade e dignidade pra todos sem exceção', intensity: 'mild' },
      { base: '{opener} finalmente uma discussão séria sobre direitos!! era hora desse país acordar', intensity: 'moderate' },
      { base: 'isso é sobre direitos humanos {filler} não existe meio termo quando se trata de dignidade', intensity: 'moderate' },
      { base: '{opener} REPRESENTATIVIDADE IMPORTA SIM!! quem discorda tá do lado errado da história {closer}', intensity: 'strong' },
      { base: 'quem é contra isso é pq nunca sofreu preconceito na pele {filler} fácil falar quando vc é privilegiado', intensity: 'strong' },
    ],
    economy: [
      { base: 'concordo mas tem que garantir que os mais pobres não paguem a conta como sempre', intensity: 'mild' },
      { base: '{opener} o problema é que sempre quem paga é o trabalhador!! rico nunca perde nada nesse país', intensity: 'moderate' },
      { base: 'enquanto bilionário pagar menos imposto que trabalhador esse país não muda {closer}', intensity: 'strong' },
    ],
    politics: [
      { base: 'apoio, mas com participação popular real, não democracia de fachada', intensity: 'mild' },
      { base: '{opener} o povo precisa ter voz!! chega de elite decidindo tudo por nós', intensity: 'moderate' },
    ],
    environment: [
      { base: 'concordo totalmente!! o meio ambiente é prioridade urgente', intensity: 'mild' },
      { base: '{opener} a Amazônia é patrimônio de todos!! temos que proteger com unhas e dentes', intensity: 'moderate' },
      { base: '{opener} capitalismo tá destruindo o planeta!! se não mudar agora não vai ter futuro pra ninguém {closer}', intensity: 'strong' },
    ],
    general: [
      { base: 'apoio!! é sobre empatia e respeito ao próximo', intensity: 'mild' },
      { base: '{opener} finalmente!! era hora de alguém levantar essa discussão', intensity: 'moderate' },
      { base: 'quem é contra isso não entende o que é viver à margem da sociedade', intensity: 'moderate' },
    ],
  },
  negative: {
    crime: [
      { base: 'discordo {filler} a solução não é punir mais, é investir em educação e oportunidade', intensity: 'mild' },
      { base: '{opener} isso só reforça a desigualdade!! pobre vai preso e rico paga fiança e vai pra casa', intensity: 'moderate' },
      { base: 'mais uma vez querem criminalizar a pobreza {filler} vergonhoso esse pensamento punitivista', intensity: 'moderate' },
      { base: '{opener} ISSO É GENOCÍDIO DA POPULAÇÃO NEGRA!! sistema prisional é continuação da escravidão {closer}', intensity: 'strong' },
      { base: 'povo fascista querendo prender pobre e preto enquanto político corrupto tá solto!! hipócritas {closer}', intensity: 'extreme' },
    ],
    social: [
      { base: 'discordo, acho que precisamos ser mais inclusivos não menos', intensity: 'mild' },
      { base: '{opener} que retrocesso!! isso é coisa de gente que nunca sofreu discriminação', intensity: 'moderate' },
      { base: '{opener} isso é fascismo puro!! querem nos calar mas não vão conseguir {closer}', intensity: 'strong' },
    ],
    economy: [
      { base: 'discordo {filler} isso só beneficia quem já é rico', intensity: 'mild' },
      { base: '{opener} mais uma medida pra ferrar o pobre e enriquecer elite!! sempre a mesma história', intensity: 'moderate' },
      { base: '{opener} enquanto povo passa fome bilionário tá comprando iate!! esse sistema é podre {closer}', intensity: 'strong' },
    ],
    politics: [
      { base: 'discordo totalmente, é mais um ataque à democracia', intensity: 'mild' },
      { base: '{opener} isso é golpe!! querem destruir a democracia que o povo conquistou com sangue', intensity: 'strong' },
    ],
    environment: [
      { base: 'discordo {filler} não dá pra desenvolver destruindo o meio ambiente', intensity: 'mild' },
      { base: '{opener} estão destruindo a Amazônia pelo lucro!! genocídio ambiental {closer}', intensity: 'strong' },
    ],
    general: [
      { base: 'discordo, isso reflete um pensamento retrógrado que não ajuda ninguém', intensity: 'mild' },
      { base: '{opener} completamente contra!! precisamos de empatia não de punição cega', intensity: 'moderate' },
      { base: 'isso é mais uma forma de opressão contra os mais vulneráveis {closer}', intensity: 'moderate' },
      { base: '{opener} precisamos atacar as causas não os sintomas!! isso é retrocesso puro', intensity: 'strong' },
    ],
  },
  neutral: {
    crime: [
      { base: 'o tema é complexo {filler} tem que olhar as causas estruturais antes de decidir', intensity: 'mild' },
    ],
    social: [
      { base: 'é importante ouvir todos os lados, especialmente os mais afetados', intensity: 'mild' },
      { base: 'o tema merece uma análise mais profunda das causas estruturais', intensity: 'mild' },
    ],
    economy: [
      { base: 'precisa ver quem realmente se beneficia e quem paga a conta', intensity: 'mild' },
    ],
    politics: [
      { base: 'é uma questão que precisa de mais diálogo e participação popular', intensity: 'mild' },
    ],
    environment: [
      { base: 'concordo que precisa discutir mas ouvindo as comunidades tradicionais', intensity: 'mild' },
    ],
    general: [
      { base: 'preciso entender melhor os impactos sociais antes de opinar', intensity: 'mild' },
      { base: 'não é tão simples quanto parece {filler} a questão é sistêmica', intensity: 'mild' },
      { base: 'precisamos de mais dados e pesquisas sociais antes de decidir', intensity: 'mild' },
    ],
  },
};

// ── Analyst (Analítico Racional / Dados & Evidências) ───────────────────────

const analyst: ArchetypeTemplates = {
  positive: {
    crime: [
      { base: 'as evidências mostram que essa abordagem tem eficácia comprovada em outros países', intensity: 'mild' },
      { base: 'analisando os dados disponíveis a proposta faz sentido do ponto de vista técnico', intensity: 'mild' },
      { base: 'estatisticamente é uma tendência positiva {filler} os indicadores sustentam essa posição', intensity: 'moderate' },
    ],
    social: [
      { base: 'os estudos mostram impacto positivo em sociedades que adotaram medidas similares', intensity: 'mild' },
      { base: 'do ponto de vista dos dados as evidências são favoráveis', intensity: 'mild' },
    ],
    economy: [
      { base: 'os indicadores econômicos apontam na mesma direção, concordo com a análise', intensity: 'mild' },
      { base: 'olhando PIB e indicadores sociais a tendência é clara {filler} faz sentido', intensity: 'moderate' },
      { base: 'do ponto de vista macroeconômico os números sustentam essa posição', intensity: 'mild' },
    ],
    politics: [
      { base: 'a ciência política mostra que reformas nessa linha tendem a funcionar', intensity: 'mild' },
      { base: 'comparando com outros sistemas políticos a evidência aponta nessa direção', intensity: 'mild' },
    ],
    environment: [
      { base: 'os relatórios do IPCC são claros sobre a urgência dessa questão', intensity: 'mild' },
      { base: 'as métricas ambientais confirmam a necessidade dessa abordagem', intensity: 'mild' },
    ],
    general: [
      { base: 'os dados sugerem que essa abordagem pode ser efetiva segundo estudos recentes', intensity: 'mild' },
      { base: 'analisando as evidências disponíveis concordo com essa perspectiva', intensity: 'mild' },
      { base: 'do ponto de vista técnico os indicadores corroboram essa análise', intensity: 'mild' },
      { base: 'estatisticamente faz sentido {filler} os números apoiam essa posição', intensity: 'moderate' },
    ],
  },
  negative: {
    crime: [
      { base: 'os dados de países que tentaram isso mostram que não funciona a longo prazo', intensity: 'mild' },
      { base: 'as evidências empíricas não sustentam essa conclusão {filler} os dados dizem o contrário', intensity: 'moderate' },
      { base: 'estudos comparativos mostram que essa medida não produz os resultados esperados', intensity: 'moderate' },
    ],
    social: [
      { base: 'do ponto de vista sociológico os dados mostram que o caminho é outro', intensity: 'mild' },
      { base: 'as pesquisas não sustentam esse argumento {filler} é falácia estatística', intensity: 'moderate' },
    ],
    economy: [
      { base: 'os indicadores econômicos não sustentam essa projeção otimista', intensity: 'mild' },
      { base: 'analisando a curva de Laffer e os dados tributários essa proposta é ineficiente', intensity: 'moderate' },
    ],
    politics: [
      { base: 'a experiência histórica mostra que esse tipo de medida gera efeitos colaterais piores', intensity: 'mild' },
    ],
    environment: [
      { base: 'os dados ambientais contradizem essa abordagem {filler} insustentável', intensity: 'moderate' },
    ],
    general: [
      { base: 'discordo {filler} a correlação não implica causalidade e o raciocínio está errado', intensity: 'mild' },
      { base: 'do ponto de vista lógico há falhas sérias nessa argumentação', intensity: 'moderate' },
      { base: 'analisando os dados disponíveis essa abordagem se mostra ineficaz', intensity: 'mild' },
    ],
  },
  neutral: {
    crime: [
      { base: 'precisamos de mais dados antes de uma conclusão definitiva', intensity: 'mild' },
    ],
    social: [
      { base: 'a questão é multifatorial e não admite respostas simplistas', intensity: 'mild' },
    ],
    economy: [
      { base: 'os estudos são inconclusivos {filler} necessário aprofundar a análise', intensity: 'mild' },
    ],
    politics: [
      { base: 'há argumentos válidos em ambos os lados {filler} difícil definir com os dados atuais', intensity: 'mild' },
    ],
    environment: [
      { base: 'a metodologia importa {filler} sem rigor científico qualquer conclusão é prematura', intensity: 'mild' },
    ],
    general: [
      { base: 'preciso ver mais dados e pesquisas antes de me posicionar', intensity: 'mild' },
      { base: 'a questão é multifatorial {filler} não admite respostas simplistas', intensity: 'mild' },
      { base: 'os estudos são inconclusivos, necessário aprofundar a análise com mais rigor', intensity: 'mild' },
      { base: 'sem um estudo metodologicamente sólido qualquer conclusão é prematura', intensity: 'mild' },
      { base: 'há argumentos válidos em ambos os lados {filler} difícil definir com os dados atuais', intensity: 'mild' },
    ],
  },
};

// ── Moderate (Equilíbrio & Consenso) ────────────────────────────────────────

const moderate: ArchetypeTemplates = {
  positive: {
    crime: [
      { base: 'acho uma posição razoável {filler} desde que com os devidos ajustes', intensity: 'mild' },
      { base: 'concordo em parte, o caminho do meio parece mais sensato', intensity: 'mild' },
      { base: 'com diálogo e equilíbrio acho que pode funcionar', intensity: 'mild' },
    ],
    social: [
      { base: 'apoio com ressalvas {filler} precisamos ouvir todos os envolvidos', intensity: 'mild' },
      { base: 'concordo desde que não radicalize pra nenhum lado', intensity: 'mild' },
    ],
    economy: [
      { base: 'faz sentido se implementado com equilíbrio e gradualidade', intensity: 'mild' },
      { base: 'concordo {filler} mas tem que pensar nos dois lados da moeda', intensity: 'mild' },
    ],
    politics: [
      { base: 'apoio desde que seja construído com diálogo entre todas as partes', intensity: 'mild' },
    ],
    environment: [
      { base: 'concordo {filler} mas precisa equilibrar preservação com desenvolvimento', intensity: 'mild' },
    ],
    general: [
      { base: 'acho uma posição razoável desde que com os devidos ajustes e diálogo', intensity: 'mild' },
      { base: 'concordo em parte {filler} o caminho do meio parece mais sensato', intensity: 'mild' },
      { base: 'com diálogo e equilíbrio entre as partes acho que pode funcionar', intensity: 'mild' },
      { base: 'apoio com ressalvas {filler} tem que ouvir todo mundo antes', intensity: 'mild' },
    ],
  },
  negative: {
    crime: [
      { base: 'acho que essa posição é um pouco extrema {filler} precisamos de equilíbrio', intensity: 'mild' },
      { base: 'discordo da radicalidade {filler} o diálogo é sempre o melhor caminho', intensity: 'mild' },
    ],
    social: [
      { base: 'entendo a intenção mas a forma tá errada {filler} muito radical', intensity: 'mild' },
      { base: '{opener} qualquer extremo é ruim {filler} tanto pra um lado quanto pro outro', intensity: 'moderate' },
    ],
    economy: [
      { base: 'discordo {filler} parece uma solução muito radical sem pensar nas consequências', intensity: 'mild' },
    ],
    politics: [
      { base: 'não consigo apoiar algo tão polarizado {filler} precisamos de moderação', intensity: 'mild' },
    ],
    environment: [
      { base: 'discordo da abordagem {filler} tem que achar o equilíbrio', intensity: 'mild' },
    ],
    general: [
      { base: 'acho que essa posição é um pouco extrema {filler} precisamos de equilíbrio', intensity: 'mild' },
      { base: 'discordo da radicalidade {filler} o diálogo é sempre melhor caminho', intensity: 'mild' },
      { base: 'não consigo apoiar algo tão polarizado {filler} precisamos de moderação', intensity: 'mild' },
      { base: 'entendo a intenção mas a forma tá errada {filler} excessivamente radical', intensity: 'moderate' },
    ],
  },
  neutral: {
    crime: [
      { base: 'vejo pontos válidos nos dois lados {filler} muito difícil escolher', intensity: 'mild' },
      { base: 'entendo quem pede mais rigor e quem pede mais humanidade {filler} é complicado', intensity: 'mild' },
    ],
    social: [
      { base: 'acho que a resposta tá no meio termo como sempre', intensity: 'mild' },
      { base: 'consigo entender os dois lados {filler} cada um tem seus argumentos válidos', intensity: 'mild' },
      { base: 'nessa eu fico dividido {filler} conheço gente boa que pensa diferente de mim', intensity: 'mild' },
    ],
    economy: [
      { base: 'preciso pensar mais {filler} tem prós e contras que pesam igual', intensity: 'mild' },
      { base: 'na teoria parece bom mas na prática tem riscos {filler} fico no meio', intensity: 'mild' },
    ],
    politics: [
      { base: 'a polarização não ajuda ninguém {filler} vamos buscar diálogo construtivo', intensity: 'mild' },
      { base: 'cansei de político que só quer dividir {filler} queria ver alguém que juntasse os dois lados', intensity: 'moderate' },
    ],
    environment: [
      { base: 'é uma questão que pede ponderação não posições radicais', intensity: 'mild' },
      { base: 'concordo que precisa cuidar do meio ambiente mas o trabalhador rural tb precisa sobreviver', intensity: 'mild' },
    ],
    general: [
      { base: 'vejo pontos válidos nos dois lados {filler} muito difícil escolher', intensity: 'mild' },
      { base: 'fico em cima do muro nessa {filler} tem argumento bom dos dois lados', intensity: 'mild' },
      { base: 'acho que a resposta tá no meio termo como sempre', intensity: 'mild' },
      { base: 'a polarização não ajuda ninguém {filler} vamos buscar diálogo', intensity: 'mild' },
      { base: 'é uma questão que pede ponderação e não posições radicais', intensity: 'mild' },
      { base: 'nessa eu entendo os dois lados {filler} a realidade é mais complexa do que parece', intensity: 'mild' },
      { base: 'depende de como for feito {filler} pode ser bom ou ruim, é uma faca de dois gumes', intensity: 'moderate' },
    ],
  },
};

// ── Entrepreneur (Empreendedor / Pragmático & Econômico) ────────────────────

const entrepreneur: ArchetypeTemplates = {
  positive: {
    crime: [
      { base: 'concordo {filler} segurança jurídica é fundamental pra qualquer negócio funcionar', intensity: 'mild' },
      { base: 'apoio, o empresário precisa de segurança pra investir nesse país', intensity: 'mild' },
      { base: '{opener} sem segurança não tem investimento!! isso é básico pra economia funcionar', intensity: 'moderate' },
    ],
    social: [
      { base: 'do ponto de vista de mercado diversidade traz resultados comprovados', intensity: 'mild' },
      { base: 'concordo {filler} inclusão é bom pra economia também', intensity: 'mild' },
    ],
    economy: [
      { base: 'faz total sentido do ponto de vista prático e econômico', intensity: 'mild' },
      { base: 'concordo {filler} isso pode trazer resultados positivos e mensuráveis', intensity: 'mild' },
      { base: '{opener} o mercado já mostra que essa direção é a mais eficiente', intensity: 'moderate' },
      { base: 'quem entende de gestão sabe que essa é a abordagem correta {closer}', intensity: 'moderate' },
      { base: '{opener} menos burocracia e mais liberdade econômica!! é isso que o Brasil precisa {closer}', intensity: 'strong' },
    ],
    politics: [
      { base: 'apoio se realmente reduzir a burocracia e facilitar a vida do empreendedor', intensity: 'mild' },
      { base: '{opener} reforma tributária já!! não dá mais pra trabalhar nesse país com tanta burocracia', intensity: 'moderate' },
    ],
    environment: [
      { base: 'concordo desde que não inviabilize o agronegócio que sustenta o país', intensity: 'mild' },
    ],
    general: [
      { base: 'faz sentido do ponto de vista prático e econômico', intensity: 'mild' },
      { base: 'concordo {filler} precisamos de soluções práticas não de mais ideologia', intensity: 'mild' },
      { base: '{opener} isso tem potencial de resultado real!! apoio', intensity: 'moderate' },
      { base: '{opener} quem trabalha e empreende sabe que esse é o caminho {closer}', intensity: 'moderate' },
    ],
  },
  negative: {
    crime: [
      { base: 'discordo {filler} isso não resolve a insegurança que o empresário vive todo dia', intensity: 'mild' },
    ],
    social: [
      { base: 'discordo {filler} o foco tem que ser geração de emprego e renda não ideologia', intensity: 'moderate' },
      { base: '{opener} enquanto ficam discutindo essas bobagens o país tá perdendo competitividade {closer}', intensity: 'strong' },
    ],
    economy: [
      { base: 'não vejo viabilidade econômica nessa proposta {filler} os custos são altos demais', intensity: 'mild' },
      { base: 'discordo {filler} o custo-benefício simplesmente não justifica', intensity: 'mild' },
      { base: '{opener} inviável!! quem propõe isso nunca administrou nada na vida {closer}', intensity: 'strong' },
      { base: '{opener} mais imposto pra sustentar vagabundo?? enquanto empresário se mata de trabalhar?? revoltante {closer}', intensity: 'extreme' },
    ],
    politics: [
      { base: 'discordo {filler} mais regulação é o que menos precisamos agora', intensity: 'mild' },
      { base: '{opener} mais burocracia pra atrapalhar quem trabalha?? esse país não tem jeito enquanto político só pensar em roubar {closer}', intensity: 'strong' },
    ],
    environment: [
      { base: 'discordo {filler} não pode travar o desenvolvimento do país por ambientalismo radical', intensity: 'moderate' },
    ],
    general: [
      { base: 'não vejo viabilidade prática nisso {filler} bonito no papel mas não funciona', intensity: 'mild' },
      { base: 'discordo {filler} o custo-benefício não justifica de jeito nenhum', intensity: 'mild' },
      { base: 'isso vai na contramão do crescimento e da eficiência necessária {closer}', intensity: 'moderate' },
      { base: '{opener} inviável!! quem propõe isso nunca trabalhou de verdade na vida', intensity: 'strong' },
    ],
  },
  neutral: {
    crime: [
      { base: 'preciso ver os impactos no ambiente de negócios antes de opinar', intensity: 'mild' },
    ],
    social: [
      { base: 'depende do impacto econômico {filler} preciso ver os números', intensity: 'mild' },
    ],
    economy: [
      { base: 'preciso ver os números concretos antes de me posicionar', intensity: 'mild' },
      { base: 'depende da implementação {filler} na teoria pode funcionar na prática...', intensity: 'mild' },
      { base: 'o impacto econômico precisa ser melhor avaliado com dados reais', intensity: 'mild' },
    ],
    politics: [
      { base: 'sem um estudo de viabilidade sério não dá pra opinar', intensity: 'mild' },
    ],
    environment: [
      { base: 'precisa de uma análise custo-benefício séria antes de decidir', intensity: 'mild' },
    ],
    general: [
      { base: 'preciso ver os números concretos antes de me posicionar', intensity: 'mild' },
      { base: 'depende da implementação {filler} na teoria funciona na prática é outra coisa', intensity: 'mild' },
      { base: 'sem um estudo de viabilidade sério não dá pra opinar', intensity: 'mild' },
      { base: 'o impacto real precisa ser melhor avaliado com dados concretos', intensity: 'mild' },
    ],
  },
};

// ── Export consolidated database ────────────────────────────────────────────

export const COMMENT_TEMPLATES: Record<string, ArchetypeTemplates> = {
  traditionalist,
  activist,
  analyst,
  moderate,
  entrepreneur,
};

/** All valid topic keys */
export const TOPIC_KEYS = ['crime', 'social', 'economy', 'politics', 'environment', 'general'] as const;

/** Intensity distribution weights (must sum to 1) */
export const INTENSITY_WEIGHTS: Record<Intensity, number> = {
  mild: 0.40,
  moderate: 0.30,
  strong: 0.20,
  extreme: 0.10,
};
