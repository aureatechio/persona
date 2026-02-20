/**
 * Data-Driven Persona Sentiment Engine
 *
 * Instead of mapping ideology → agree/disagree with a formula,
 * this module uses the persona's ACTUAL questionnaire responses
 * (80+ fields) to determine how they'd feel about a question.
 *
 * Flow:
 * 1. Detect keywords in the question
 * 2. Map keywords → specific persona data fields (tema_*, q_*)
 * 3. Read the persona's ACTUAL answer to that field
 * 4. Convert response → sentiment
 * 5. When no direct match: build holistic profile from all responses
 */

import type { Sentiment } from './types';

// ── Normalize (same as engine.ts) ─────────────────────────────────────────────

function norm(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Question → Persona Field Mapping ──────────────────────────────────────────

interface FieldMapping {
  keywords: string[];
  fields: string[];
}

/**
 * Maps question keywords to the persona's actual data fields.
 * When the question mentions "aborto", we check the persona's `tema_aborto`.
 * When it mentions "pena de morte", we check `q_pena_morte`.
 * This uses the REAL data instead of a formula.
 */
const QUESTION_FIELD_MAP: FieldMapping[] = [
  // ── Temas Polêmicos (tema_*) ──
  { keywords: ['aborto', 'abortar', 'aborção'], fields: ['tema_aborto', 'q_aborto_estupro'] },
  { keywords: ['arma', 'desarm', 'porte de arma', 'posse de arma', 'armament'], fields: ['tema_armas'] },
  { keywords: ['maconha', 'cannabis', 'legaliz droga', 'descriminaliz'], fields: ['tema_maconha', 'q_drogas_descriminalizar'] },
  { keywords: ['privatiz', 'estatal', 'petrobras', 'empresa publica'], fields: ['tema_privatizacoes'] },
  { keywords: ['cota racial', 'cota', 'acao afirmativa', 'cotas'], fields: ['tema_cotas_raciais'] },
  { keywords: ['casamento gay', 'casamento homoafetiv', 'casamento igualit', 'uniao homoafetiv', 'casamento entre'], fields: ['tema_casamento_gay'] },

  // ── Segurança e Justiça ──
  { keywords: ['pena de morte', 'pena capital'], fields: ['q_pena_morte'] },
  { keywords: ['prisao perpetua'], fields: ['q_prisao_perpetua'] },
  { keywords: ['maioridade penal', 'menor infrator', 'reduzir maioridade', 'menores'], fields: ['q_maioridade_penal_16'] },
  { keywords: ['policia violent', 'violencia policial', 'abuso policial', 'truculencia'], fields: ['q_policia_violenta'] },
  { keywords: ['crack', 'internacao compulsoria', 'internar forcado', 'internacao forcada'], fields: ['q_crack_internar_forcado'] },
  { keywords: ['seguranca publica', 'seguranca', 'criminalidade'], fields: ['q_seguranca_prioridade'] },
  { keywords: ['camera facial', 'reconhecimento facial', 'vigilancia'], fields: ['q_camera_facial_aceita'] },
  { keywords: ['justica funciona', 'judiciario', 'sistema judicial'], fields: ['q_justica_funciona'] },
  { keywords: ['droga', 'descriminaliz', 'liberacao droga'], fields: ['q_drogas_descriminalizar'] },

  // ── Família e Costumes ──
  { keywords: ['familia tradicional', 'valores familiares', 'familia'], fields: ['q_familia_tradicional'] },
  { keywords: ['feminism', 'machism', 'igualdade genero', 'patriarcado'], fields: ['q_feminismo_bom'] },
  { keywords: ['racismo estrutural', 'racismo sistemic', 'racismo'], fields: ['q_racismo_estrutural'] },
  { keywords: ['meritocracia', 'meritocracia existe'], fields: ['q_meritocracia'] },
  { keywords: ['genero biologic', 'sexo biologic', 'identidade genero', 'transgenero', 'transexual'], fields: ['q_genero_biologico'] },
  { keywords: ['linguagem neutra', 'pronome neutro', 'linguagem inclusiva'], fields: ['q_linguagem_neutra'] },
  { keywords: ['ideologia genero', 'genero escola', 'educacao sexual escola'], fields: ['q_ideologia_genero_escola'] },
  { keywords: ['adocao homoafetiv', 'adocao gay', 'adocao casal gay', 'adocao lgbt'], fields: ['q_adocao_homoafetiva'] },
  { keywords: ['direitos lgbt', 'direitos gay', 'lgbtq', 'comunidade lgbt'], fields: ['q_direitos_lgbt'] },
  { keywords: ['mulher presidente', 'presidente mulher', 'mulher na presidencia'], fields: ['q_mulher_presidente'] },
  { keywords: ['divorcio', 'separacao'], fields: ['q_divorcio_facilitar'] },
  { keywords: ['religiao politica', 'estado laico', 'laicidade', 'teocracia'], fields: ['q_religiao_politica'] },
  { keywords: ['prostituicao', 'profissional do sexo', 'regulamentar prostitu'], fields: ['q_prostituicao_legalizar'] },
  { keywords: ['poligamia', 'poliamor'], fields: ['q_poligamia'] },
  { keywords: ['aborto estupro', 'aborto em caso'], fields: ['q_aborto_estupro'] },

  // ── Economia ──
  { keywords: ['salario minimo', 'piso salarial', 'aumento salarial'], fields: ['q_salario_minimo_aumentar'] },
  { keywords: ['reforma tributaria', 'imposto grande', 'taxar rico', 'imposto ricos'], fields: ['q_reforma_tributaria', 'q_imposto_ricos'] },
  { keywords: ['estado minimo', 'estado maximo', 'tamanho estado', 'intervencao estado', 'estado grande'], fields: ['q_estado_tamanho'] },
  { keywords: ['bolsa familia', 'beneficio social', 'programa social', 'transferencia renda'], fields: ['q_bolsa_familia_bom'] },
  { keywords: ['auxilio emergencial', 'auxilio'], fields: ['q_auxilio_emergencial_voltar'] },
  { keywords: ['desemprego', 'emprego'], fields: ['q_desemprego_principal'] },
  { keywords: ['inflacao', 'preco', 'carestia'], fields: ['q_inflacao_controle'] },
  { keywords: ['bitcoin', 'criptomoeda', 'cripto'], fields: ['q_bitcoin_confiar'] },
  { keywords: ['banco central', 'bc independente', 'autonomia bc'], fields: ['q_banco_central_independente'] },
  { keywords: ['teto de gastos', 'teto gastos', 'responsabilidade fiscal'], fields: ['q_teto_gastos'] },
  { keywords: ['previdencia', 'aposentadoria', 'reforma previdencia', 'inss'], fields: ['q_previdencia_reforma'] },
  { keywords: ['13 salario', 'decimo terceiro'], fields: ['q_13_salario_manter'] },

  // ── Política ──
  { keywords: ['lula', ' pt ', 'petista', 'governo lula', 'pt ', 'partido dos trabalhadores'], fields: ['aprovacao_lula'] },
  { keywords: ['bolsonaro', 'jair', 'bolsonarismo'], fields: ['q_avaliacao_bolsonaro'] },
  { keywords: ['impeachment', 'impichment'], fields: ['q_impeachment_lula'] },
  { keywords: ['intervencao militar', 'golpe militar', 'militar no poder'], fields: ['q_intervencao_militar'] },
  { keywords: ['corrupcao', 'corrupto', 'propina', 'desvio'], fields: ['q_corrupcao_problema'] },
  { keywords: ['democracia', 'regime democratico', 'ditadura'], fields: ['q_democracia_importante'] },
  { keywords: ['reeleicao', 'reeleger'], fields: ['q_reeleicao'] },
  { keywords: ['voto obrigatorio', 'voto facultativo', 'obrigar votar'], fields: ['q_voto_obrigatorio'] },
  { keywords: ['fake news', 'noticia falsa', 'desinformacao'], fields: ['q_fake_news_problema'] },
  { keywords: ['censura', 'censurar', 'regular rede', 'controle redes sociais'], fields: ['q_redes_sociais_censuradas'] },
  { keywords: ['sistema eleitoral', 'urna', 'fraude eleitoral', 'urna eletronica'], fields: ['q_sistema_eleitoral_confiavel'] },
  { keywords: ['pt comunista', 'comunismo'], fields: ['q_pt_comunista'] },
  { keywords: ['bolsonaro ditador', 'autoritario'], fields: ['q_bolsonaro_ditador'] },

  // ── Meio Ambiente ──
  { keywords: ['mudanca climatica', 'aquecimento global', 'clima', 'mudancas climaticas'], fields: ['q_mudanca_climatica_real'] },
  { keywords: ['amazonia', 'floresta', 'preservar amazonia'], fields: ['q_amazonia_preservar'] },
  { keywords: ['agronegocio', 'desmatamento', 'desmata'], fields: ['q_agronegocio_desmata'] },
  { keywords: ['energia renovavel', 'energia limpa', 'energia solar', 'eolica'], fields: ['q_energia_renovavel'] },
  { keywords: ['queimada', 'fogo floresta', 'incendio'], fields: ['q_queimadas_criminosas'] },

  // ── Ciência e Saúde ──
  { keywords: ['vacina', 'vacinacao', 'antivax'], fields: ['q_vacinas_confiar'] },
  { keywords: ['ciencia', 'cientista', 'pesquisa cientifica'], fields: ['q_ciencia_importante'] },
  { keywords: ['terra plana', 'terraplanista'], fields: ['q_terra_plana'] },
  { keywords: ['sus', 'saude publica', 'sistema unico'], fields: ['q_sus_funciona'] },
  { keywords: ['medicina publica', 'hospital publico', 'posto de saude'], fields: ['q_medicina_publica_boa'] },
  { keywords: ['plano de saude', 'saude privada', 'convenio'], fields: ['q_plano_saude_tem'] },

  // ── Educação ──
  { keywords: ['universidade publica', 'faculdade publica', 'ensino superior publico', 'universidade gratuita'], fields: ['q_universidade_publica_gratuita'] },
  { keywords: ['homeschooling', 'educacao domiciliar', 'escola em casa'], fields: ['q_homeschooling'] },
  { keywords: ['ensino distancia', 'ead', 'aula online'], fields: ['q_ensino_distancia'] },
  { keywords: ['escola particular', 'ensino privado'], fields: ['q_escola_particular_melhor'] },
  { keywords: ['enem', 'vestibular'], fields: ['q_enem_justo'] },

  // ── Confiança Institucional ──
  { keywords: ['stf', 'supremo'], fields: ['q_confianca_stf'] },
  { keywords: ['congresso', 'senado', 'camara', 'deputado'], fields: ['q_confianca_congresso'] },
  { keywords: ['imprensa', 'midia', 'jornalismo', 'globo'], fields: ['q_confianca_imprensa'] },
  { keywords: ['policia', 'pm', 'policial'], fields: ['q_confianca_policia'] },
  { keywords: ['exercito', 'forcas armadas', 'militares'], fields: ['q_confianca_exercito'] },
  { keywords: ['igreja', 'religiao', 'pastor', 'padre'], fields: ['q_confianca_igreja'] },

  // ── Internacional ──
  { keywords: ['china', 'chines'], fields: ['q_china_ameaca'] },
  { keywords: ['eua', 'estados unidos', 'american'], fields: ['q_eua_aliado'] },
  { keywords: ['imigracao', 'imigrante', 'refugiado', 'estrangeiro'], fields: ['q_imigracao'] },

  // ── Mídia e Tecnologia ──
  { keywords: ['whatsapp', 'zap'], fields: ['q_whatsapp_noticias'] },

  // ── Tabu Implícito (hidden biases) ──
  { keywords: ['racismo', 'negro', 'preto', 'preconceito racial'], fields: ['q_ti_racismo_latente', 'q_ti_nao_contrataria_negro_chefia', 'q_ti_vizinho_negro_incomoda'] },
  { keywords: ['sonegar', 'sonegacao', 'imposto', 'evasao fiscal'], fields: ['q_ti_sonegaria_imposto'] },
  { keywords: ['propina', 'suborno', 'corrupcao'], fields: ['q_ti_aceitaria_propina'] },
  { keywords: ['comprar voto', 'vender voto', 'voto comprado'], fields: ['q_ti_venderia_voto'] },
  { keywords: ['bater filho', 'palmada', 'educacao crianca', 'castigo fisico'], fields: ['q_ti_bater_filho_normal'] },
  { keywords: ['estupro', 'assedio', 'culpa vitima', 'roupa provocante'], fields: ['q_ti_mulher_roupa_culpada'] },
  { keywords: ['homofobia', 'violencia contra gay', 'lgbtfobia'], fields: ['q_ti_homofobia_violenta'] },
  { keywords: ['linchamento', 'justica propria', 'justiceiro'], fields: ['q_ti_linchamento_apoiaria'] },
  { keywords: ['tortura', 'torturar preso'], fields: ['q_ti_tortura_preso_ok'] },
  { keywords: ['trabalho infantil', 'crianca trabalhar'], fields: ['q_ti_trabalho_infantil_ok'] },
  { keywords: ['jeitinho', 'furar fila', 'jeitinho brasileiro'], fields: ['q_ti_jeitinho_furar_fila'] },
  { keywords: ['assedio rua', 'cantada', 'assedio sexual rua'], fields: ['q_ti_assediaria_mulher_rua'] },
  { keywords: ['intolerancia religiosa', 'perseguicao religiosa'], fields: ['q_ti_intolerancia_religiosa'] },
  { keywords: ['preconceito nordestino', 'xenofobia', 'nordestino'], fields: ['q_ti_preconceito_nordestino'] },
  { keywords: ['violencia domestica', 'bater mulher', 'agressor'], fields: ['q_ti_violencia_domestica'] },
  { keywords: ['produto roubado', 'receptacao', 'contrabando'], fields: ['q_ti_compraria_produto_roubado'] },
  { keywords: ['menor de idade', 'adolescente infrator', 'menor14'], fields: ['q_ti_menor14_sabe_o_que_faz'] },
  { keywords: ['nepotismo', 'indicacao politica', 'concurso publico'], fields: ['q_ti_nepotismo_concurso'] },

  // ── Vivências e Vulnerabilidades ──
  { keywords: ['abuso sexual', 'pedofilia', 'abuso infantil'], fields: ['q_vi_abuso_sexual_infancia'] },
  { keywords: ['fome', 'inseguranca alimentar', 'passar fome'], fields: ['q_vi_passou_fome'] },
  { keywords: ['assalto', 'roubo', 'furto', 'assaltado'], fields: ['q_vi_ja_foi_assaltado'] },
  { keywords: ['desemprego', 'desempregado'], fields: ['q_vi_desempregado_1ano'] },
  { keywords: ['depressao', 'ansiedade', 'saude mental', 'panico'], fields: ['q_vi_depressao_ansiedade'] },
  { keywords: ['suicidio', 'suicida', 'autolesao'], fields: ['q_vi_pensou_suicidio'] },
  { keywords: ['preso', 'prisao', 'encarcerado', 'sistema penitenciario'], fields: ['q_vi_preso_ou_familiar_preso'] },
  { keywords: ['morador de rua', 'sem teto', 'situacao de rua'], fields: ['q_vi_ja_dormiu_na_rua'] },
  { keywords: ['enchente', 'inundacao', 'desastre natural', 'deslizamento'], fields: ['q_vi_enchente_desastre'] },
  { keywords: ['dependencia quimica', 'alcoolismo', 'vicio', 'dependente'], fields: ['q_vi_dependencia'] },
];

// ── Response Classification ───────────────────────────────────────────────────

/**
 * Converts a persona's actual questionnaire response to a numeric score.
 * Returns: +1 (positive/agree), -1 (negative/disagree), 0 (neutral/no data)
 */
function classifyResponse(value: unknown): number {
  if (value == null || value === '') return 0;

  // Numeric fields (q_confianca_* are smallint 1-10, q_democracia_importante etc.)
  if (typeof value === 'number') {
    if (value >= 7) return 1;
    if (value <= 4) return -1;
    return 0;
  }

  const v = norm(String(value));

  // Strong agreement / support
  const positivePatterns = [
    'a favor', 'sim', 'concordo', 'apoio', 'deveria',
    'importante', 'funciona', 'bom', 'muito bom', 'positiv',
    'confiavel', 'real', 'correto', 'justo', 'necessario',
    'essencial', 'melhor', 'aprova', 'otimo', 'excelente',
  ];
  if (positivePatterns.some(p => v.includes(p))) return 1;

  // Strong disagreement / opposition
  const negativePatterns = [
    'contra', 'discordo', 'nao deveria', 'ruim', 'pessim',
    'nao funciona', 'nao confio', 'falso', 'injusto', 'desnecessario',
    'errado', 'nao apoia', 'desaprova', 'horrivel', 'perigoso',
    'nao acredita', 'negativ', 'reprov',
  ];
  if (negativePatterns.some(p => v.includes(p))) return -1;

  // Plain "Não" in isolation
  if (v === 'nao' || v.startsWith('nao,') || v.endsWith(' nao')) return -1;

  // Neutral / undecided
  const neutralPatterns = [
    'neutro', 'indeciso', 'tanto faz', 'depende', 'talvez',
    'nao sei', 'ns/nr', 'regular', 'medio', 'mais ou menos',
  ];
  if (neutralPatterns.some(p => v.includes(p))) return 0;

  return 0;
}

// ── Question Polarity Detection ───────────────────────────────────────────────

/**
 * Detects if the question is framed AGAINST the topic.
 * "A maconha deveria ser legalizada?" → normal (agree with field = agree with question)
 * "A maconha deveria ser proibida?" → inverted (agree with field = disagree with question)
 */
const INVERSION_KEYWORDS = [
  'proibir', 'proibid', 'banir', 'acabar com', 'eliminar',
  'impedir', 'errado', 'problema', 'prejudic', 'devast',
  'destrui', 'ruim', 'pessim', 'fracass', 'nao deveria existir',
];

const NORMAL_DIRECTION_KEYWORDS = [
  'liberar', 'legalizar', 'permitir', 'a favor', 'deveria',
  'concordar', 'apoiar', 'bom', 'positiv', 'benefici',
];

function isQuestionInverted(normQuestion: string): boolean {
  let inv = 0;
  let normal = 0;
  for (const k of INVERSION_KEYWORDS) { if (normQuestion.includes(k)) inv++; }
  for (const k of NORMAL_DIRECTION_KEYWORDS) { if (normQuestion.includes(k)) normal++; }
  return inv > normal && inv > 0;
}

// ── Extreme / Universal Consensus Detection ───────────────────────────────────

/**
 * Detects questions that express extreme, universally rejected propositions.
 * "Todos idosos devem morrer" → virtually 100% disagree, regardless of ideology.
 * These are NOT political questions — they're moral ones.
 */
const VIOLENCE_WORDS = [
  'morrer', 'morram', 'morte', 'matar', 'matando', 'matem',
  'exterminar', 'extermin', 'eliminar', 'assassinar', 'torturar',
  'estuprar', 'espancar', 'linchar', 'queimar vivo', 'enforcar',
  'escravizar', 'apedrejar', 'crucificar', 'fuzilar',
];

const EXTREME_PATTERNS = [
  'devem morrer', 'devem ser mort', 'devem ser eliminad', 'devem ser exterminad',
  'devem ser torturad', 'devem ser escravizad', 'devem apanhar',
  'nao merecem viver', 'nao sao humanos', 'nao sao gente',
  'tem que morrer', 'tem que acabar com', 'tem que exterminar',
  'matar todos', 'eliminar todos', 'exterminar todos',
  'todos devem morrer', 'deveriam morrer', 'merece morrer',
  'merece a morte', 'deviam ser morto', 'devem ser fuzilad',
];

const TARGET_GROUPS = [
  'idosos', 'velhos', 'criancas', 'bebes', 'mulheres', 'homens',
  'negros', 'brancos', 'indigenas', 'indios', 'pobres', 'ricos',
  'gays', 'lgbts', 'trans', 'deficientes', 'nordestinos', 'imigrantes',
  'refugiados', 'judeus', 'muculmanos', 'evangelicos', 'catolicos',
  'ateus', 'jovens', 'adolescentes', 'pessoas',
];

interface ConsensusResult {
  detected: boolean;
  /** 'negative' = virtually everyone disagrees with the statement */
  direction: 'negative' | 'positive';
  /** 0..1 — how unanimous. 0.97 = 97% go in that direction */
  strength: number;
}

function detectMoralConsensus(normQuestion: string): ConsensusResult | null {
  // Check for extreme patterns
  const hasExtremePattern = EXTREME_PATTERNS.some(p => normQuestion.includes(p));

  if (hasExtremePattern) {
    return { detected: true, direction: 'negative', strength: 0.97 };
  }

  // Check for violence + targeting a group
  const hasViolence = VIOLENCE_WORDS.some(w => normQuestion.includes(w));
  const targetsGroup = TARGET_GROUPS.some(g => normQuestion.includes(g));

  // Check for "devem" / "deveriam" / "tem que" near violence
  const hasImperative = ['devem', 'deveriam', 'tem que', 'precisa'].some(w => normQuestion.includes(w));

  if (hasViolence && targetsGroup && hasImperative) {
    return { detected: true, direction: 'negative', strength: 0.95 };
  }

  if (hasViolence && targetsGroup) {
    return { detected: true, direction: 'negative', strength: 0.90 };
  }

  return null;
}

// ── Holistic Profile Analysis ─────────────────────────────────────────────────

/**
 * When no specific data field matches the question, build a holistic
 * profile from ALL of the persona's responses.
 * This is NOT a simple ideology formula — it considers the totality
 * of the persona's recorded values, attitudes, and beliefs.
 */
function computeHolisticSentiment(
  persona: Record<string, any>,
  normQuestion: string,
): Sentiment {
  // Collect ALL available response signals from the persona
  const allSignals: number[] = [];

  // Humanitarian / empathy dimension
  const humanFields = [
    'q_democracia_importante', 'q_direitos_lgbt', 'q_racismo_estrutural',
    'q_feminismo_bom', 'q_adocao_homoafetiva', 'q_vacinas_confiar',
    'q_ciencia_importante', 'q_amazonia_preservar', 'q_sus_funciona',
    'q_universidade_publica_gratuita', 'q_bolsa_familia_bom',
    'q_mudanca_climatica_real', 'q_energia_renovavel',
  ];

  // Authoritarian / order dimension
  const authFields = [
    'q_pena_morte', 'q_prisao_perpetua', 'q_maioridade_penal_16',
    'q_intervencao_militar', 'q_crack_internar_forcado',
    'q_camera_facial_aceita', 'q_seguranca_prioridade',
    'q_ti_linchamento_apoiaria', 'q_ti_tortura_preso_ok',
  ];

  // Tradition / conservatism dimension
  const tradFields = [
    'q_familia_tradicional', 'q_religiao_politica', 'q_genero_biologico',
    'tema_casamento_gay', 'q_ideologia_genero_escola', 'q_linguagem_neutra',
    'q_ti_homofobia_violenta', 'q_ti_bater_filho_normal',
  ];

  // Economic liberalism dimension
  const ecoLibFields = [
    'tema_privatizacoes', 'q_estado_tamanho', 'q_teto_gastos',
    'q_previdencia_reforma', 'q_bitcoin_confiar',
  ];

  let humanScore = 0, humanCount = 0;
  let authScore = 0, authCount = 0;
  let tradScore = 0, tradCount = 0;
  let ecoLibScore = 0, ecoLibCount = 0;

  for (const f of humanFields) {
    const s = classifyResponse(persona[f]);
    if (s !== 0 || persona[f] != null) { humanScore += s; humanCount++; }
  }
  for (const f of authFields) {
    const s = classifyResponse(persona[f]);
    if (s !== 0 || persona[f] != null) { authScore += s; authCount++; }
  }
  for (const f of tradFields) {
    const s = classifyResponse(persona[f]);
    if (s !== 0 || persona[f] != null) { tradScore += s; tradCount++; }
  }
  for (const f of ecoLibFields) {
    const s = classifyResponse(persona[f]);
    if (s !== 0 || persona[f] != null) { ecoLibScore += s; ecoLibCount++; }
  }

  const avgHuman = humanCount > 0 ? humanScore / humanCount : 0;
  const avgAuth = authCount > 0 ? authScore / authCount : 0;
  const avgTrad = tradCount > 0 ? tradScore / tradCount : 0;
  const avgEcoLib = ecoLibCount > 0 ? ecoLibScore / ecoLibCount : 0;

  // Detect question topic tendencies from keywords
  const isProgressiveTopic = [
    'direito', 'igualdade', 'inclusao', 'diversidade', 'sustentab',
    'social', 'protecao', 'liberdade', 'educacao', 'saude',
  ].some(w => normQuestion.includes(w));

  const isConservativeTopic = [
    'ordem', 'disciplina', 'tradicao', 'moral', 'seguranca',
    'punicao', 'autoridade', 'familia', 'patria',
  ].some(w => normQuestion.includes(w));

  const isEconomicTopic = [
    'econom', 'mercado', 'emprego', 'imposto', 'empresa',
    'cresciment', 'investiment', 'lucro', 'dinheiro',
  ].some(w => normQuestion.includes(w));

  // Build a composite signal based on which dimensions match the question
  let signal = 0;
  let signalCount = 0;

  if (isProgressiveTopic) {
    signal += avgHuman * 0.6 - avgTrad * 0.4;
    signalCount++;
  }
  if (isConservativeTopic) {
    signal += avgTrad * 0.5 + avgAuth * 0.3;
    signalCount++;
  }
  if (isEconomicTopic) {
    signal += avgEcoLib * 0.6;
    signalCount++;
  }

  // If no topic detected, use a very weak composite
  if (signalCount === 0) {
    signal = (avgHuman * 0.2 + avgAuth * 0.1 + avgTrad * 0.1 + avgEcoLib * 0.1);
    signalCount = 1;
  }

  const compositeSignal = signal / signalCount;

  // Add significant noise since we don't have a direct data match
  const noise = (Math.random() - 0.5) * 0.6;
  const finalScore = compositeSignal * 0.4 + noise;

  if (finalScore > 0.15) return 'positive';
  if (finalScore < -0.15) return 'negative';
  return 'neutral';
}

// ── Voting History Analysis ───────────────────────────────────────────────────

/**
 * For political figure questions, use the persona's actual voting data
 * and approval ratings instead of ideology formulas.
 */
function analyzeVotingData(
  persona: Record<string, any>,
  normQuestion: string,
): Sentiment | null {
  const hasLula = ['lula', 'petista', ' pt ', 'pt ', 'governo lula', 'partido dos trabalhadores'].some(k => normQuestion.includes(k));
  const hasBolsonaro = ['bolsonaro', 'bolsonarism', 'capitao', 'mito '].some(k => normQuestion.includes(k));

  if (!hasLula && !hasBolsonaro) return null;

  // Detect adversarial framing
  const advWords = ['preso', 'prender', 'condenar', 'corrupto', 'cadeia', 'criminoso', 'impeach', 'cassado', 'demitir', 'expulsar'];
  const supWords = ['bom', 'melhor', 'excelente', 'competente', 'inocente', 'apoiar', 'defende', 'heroi', 'benefici'];
  let adv = 0, sup = 0;
  for (const k of advWords) { if (normQuestion.includes(k)) adv++; }
  for (const k of supWords) { if (normQuestion.includes(k)) sup++; }
  const isAdversarial = adv > sup && adv > 0;

  if (hasLula) {
    // Use ACTUAL data: aprovacao_lula, voto_2022, voto_2026
    const aprovacao = persona.aprovacao_lula;
    const voto22 = norm(String(persona.voto_2022 || ''));
    const voto26 = norm(String(persona.voto_2026 || ''));

    let stance: Sentiment = 'neutral';

    // Check approval
    const aprov = aprovacao ? norm(String(aprovacao)) : '';
    if (aprov.includes('aprova') || aprov.includes('bom') || aprov.includes('otimo')) {
      stance = 'positive';
    } else if (aprov.includes('desaprova') || aprov.includes('ruim') || aprov.includes('pessim')) {
      stance = 'negative';
    }

    // Check voting history for stronger signal
    if (stance === 'neutral') {
      if (voto22.includes('lula') || voto22.includes('pt') || voto26.includes('lula') || voto26.includes('pt')) {
        stance = 'positive';
      } else if (voto22.includes('bolsonaro') || voto26.includes('bolsonaro')) {
        stance = 'negative';
      }
    }

    // Invert for adversarial questions ("Lula deveria estar preso?")
    if (isAdversarial && stance !== 'neutral') {
      stance = stance === 'positive' ? 'negative' : 'positive';
    }

    // 85% follow their data, 15% noise for variance
    if (Math.random() > 0.15) return stance;
    return null; // Fall through to topic analysis
  }

  if (hasBolsonaro) {
    const avaliacao = persona.q_avaliacao_bolsonaro;
    const voto22 = norm(String(persona.voto_2022 || ''));
    const voto26 = norm(String(persona.voto_2026 || ''));

    let stance: Sentiment = 'neutral';

    const aval = avaliacao ? norm(String(avaliacao)) : '';
    if (aval.includes('bom') || aval.includes('otimo') || aval.includes('excelente') || aval.includes('aprova')) {
      stance = 'positive';
    } else if (aval.includes('ruim') || aval.includes('pessim') || aval.includes('horrivel') || aval.includes('desaprova')) {
      stance = 'negative';
    }

    if (stance === 'neutral') {
      if (voto22.includes('bolsonaro') || voto26.includes('bolsonaro')) {
        stance = 'positive';
      } else if (voto22.includes('lula') || voto22.includes('pt') || voto26.includes('lula')) {
        stance = 'negative';
      }
    }

    if (isAdversarial && stance !== 'neutral') {
      stance = stance === 'positive' ? 'negative' : 'positive';
    }

    if (Math.random() > 0.15) return stance;
    return null;
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Computes sentiment for a persona by analyzing their ACTUAL data.
 *
 * Priority:
 * 1. Moral consensus (extreme questions like "idosos devem morrer")
 * 2. Political figure analysis (using voting data, not formulas)
 * 3. Direct field matching (question keywords → persona's questionnaire answers)
 * 4. Holistic profile analysis (all responses → composite values profile)
 */
export function computePersonaSentiment(
  persona: Record<string, any>,
  question: string,
): Sentiment {
  const normQuestion = norm(question);

  // 1. Check for moral consensus (extreme/universally-rejected propositions)
  const consensus = detectMoralConsensus(normQuestion);
  if (consensus) {
    const roll = Math.random();
    if (consensus.direction === 'negative') {
      if (roll < consensus.strength) return 'negative';
      if (roll < consensus.strength + 0.02) return 'neutral';
      return 'positive';
    } else {
      if (roll < consensus.strength) return 'positive';
      if (roll < consensus.strength + 0.02) return 'neutral';
      return 'negative';
    }
  }

  // 2. Political figure analysis (Lula, Bolsonaro) using ACTUAL voting data
  const votingResult = analyzeVotingData(persona, normQuestion);
  if (votingResult) return votingResult;

  // 3. Direct field matching — find persona's actual answer to the question topic
  const inverted = isQuestionInverted(normQuestion);
  const directMatches: number[] = [];

  for (const mapping of QUESTION_FIELD_MAP) {
    const kwMatch = mapping.keywords.some(kw => normQuestion.includes(norm(kw)));
    if (!kwMatch) continue;

    for (const field of mapping.fields) {
      const value = persona[field];
      if (value == null || value === '') continue;

      let score = classifyResponse(value);
      if (inverted) score = -score;

      directMatches.push(score);
    }
  }

  if (directMatches.length > 0) {
    const avgScore = directMatches.reduce((a, b) => a + b, 0) / directMatches.length;

    // Small noise for natural variance (people don't always respond consistently)
    const noise = (Math.random() - 0.5) * 0.3;
    const finalScore = avgScore + noise;

    if (finalScore > 0.2) return 'positive';
    if (finalScore < -0.2) return 'negative';
    return 'neutral';
  }

  // 4. No direct match → holistic analysis of persona's complete profile
  return computeHolisticSentiment(persona, normQuestion);
}
