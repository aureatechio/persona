/**
 * Brazilian Linguistics Database
 * ==============================
 * Base de dados linguística completa para geração de comentários
 * autênticos de redes sociais brasileiras.
 *
 * Granularidade: por estado (27 UFs) + modificadores demográficos
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StateProfile {
  uf: string;
  region: string;
  slang: string[];
  exclamations: string[];
  greetings: string[];
  intensifiers: string[];
  fillers: string[];
  insults: string[];
  closers: string[];
  culturalRefs: string[];
  typicalEmojis: string[];
}

export interface EducationModifier {
  spellingAccuracy: number;
  vocabularyTier: 'basic' | 'intermediate' | 'advanced';
  punctuationUsage: 'none' | 'minimal' | 'standard' | 'meticulous';
  commonErrors: [string, string][]; // [errado, correto] — aplicamos ao contrário
}

export interface GenerationModifier {
  abbreviationRate: number;
  emojiDensity: number;
  capsRate: number;
  sentenceLength: 'very_short' | 'short' | 'medium' | 'long';
  laughterRate: number;
  extraAbbreviations: string[];
  memeExpressions: string[];
}

export interface ClassModifier {
  formalityLevel: number;
  complainAbout: string[];
  aspirational: boolean;
}

// ── State Profiles (27 UFs) ────────────────────────────────────────────────────

export const STATE_PROFILES: Record<string, StateProfile> = {
  // ─── NORTE ────────────────────────────────────────────────────────────
  AC: {
    uf: 'AC',
    region: 'Norte',
    slang: ['maninho', 'caboco', 'rapaize', 'da peste', 'aperreado', 'arrocha'],
    exclamations: ['Eita!', 'Rapaz!', 'Ave Maria!', 'Misericórdia!'],
    greetings: ['Fala maninho', 'E aí caboco', 'Opa rapaize'],
    intensifiers: ['demais', 'da peste', 'que é uma beleza', 'massa'],
    fillers: ['maninho', 'rapaz', 'olha', 'viu'],
    insults: ['caboco doido', 'aperreado', 'sem noção', 'besta'],
    closers: ['é isso aí maninho', 'falou', 'é nóis'],
    culturalRefs: ['aqui no acre existe sim kkk', 'a gente não vive com dinossauro não'],
    typicalEmojis: ['🌿', '💪', '🙏', '😂', '🔥'],
  },
  AM: {
    uf: 'AM',
    region: 'Norte',
    slang: ['égua', 'maninho', 'mana', 'tu é doido', 'massa', 'embuado', 'maceta'],
    exclamations: ['Égua!', 'Tá te doido!', 'Papai!', 'Caramba!', 'Égua mano!'],
    greetings: ['Fala maninho', 'E aí mana', 'Opa', 'Bora'],
    intensifiers: ['égua', 'demais', 'maceta', 'massa', 'brabo'],
    fillers: ['maninho', 'mana', 'papai', 'tu sabe', 'olha'],
    insults: ['tu é doido', 'embuado', 'parasita', 'besta', 'mal caráter'],
    closers: ['é isso maninho', 'falou mana', 'bora'],
    culturalRefs: ['bom que nem açaí', 'aqui na amazônia', 'rio negro e solimões', 'manaus não é só selva'],
    typicalEmojis: ['🌿', '🐊', '🔥', '💪', '🙏'],
  },
  AP: {
    uf: 'AP',
    region: 'Norte',
    slang: ['maninho', 'mana', 'égua', 'da hora', 'massa', 'rapaize'],
    exclamations: ['Égua!', 'Rapaz!', 'Eita!', 'Nossa!'],
    greetings: ['Fala maninho', 'E aí mana', 'Opa'],
    intensifiers: ['demais', 'muito', 'massa', 'da hora'],
    fillers: ['maninho', 'mana', 'rapaz', 'olha'],
    insults: ['besta', 'sem noção', 'doido', 'folgado'],
    closers: ['é isso', 'falou', 'bora'],
    culturalRefs: ['aqui no meio do mundo', 'linha do equador'],
    typicalEmojis: ['🌿', '💪', '🙏', '😂', '🔥'],
  },
  PA: {
    uf: 'PA',
    region: 'Norte',
    slang: ['égua', 'mano', 'mana', 'pai dégua', 'tá te doido', 'maninho', 'é mermo', 'carapanã'],
    exclamations: ['Égua!', 'Tá te doido!', 'Papai!', 'Pai dégua!', 'Égua mano!'],
    greetings: ['Fala mano', 'E aí maninho', 'Égua mano', 'Bora'],
    intensifiers: ['égua', 'pai dégua', 'demais', 'muito', 'é mermo'],
    fillers: ['mano', 'maninho', 'mana', 'papai', 'égua'],
    insults: ['tá te doido', 'besta', 'sem vergonha', 'folgado', 'pilantra'],
    closers: ['é isso mano', 'falou maninho', 'bora'],
    culturalRefs: ['bom que nem tucupi', 'quente que nem Belém', 'no ver-o-peso', 'círio de Nazaré'],
    typicalEmojis: ['🌿', '🐊', '🔥', '💪', '🙏', '😂'],
  },
  RO: {
    uf: 'RO',
    region: 'Norte',
    slang: ['maninho', 'caboco', 'rapaize', 'da peste', 'massa'],
    exclamations: ['Eita!', 'Rapaz!', 'Nossa!', 'Ave Maria!'],
    greetings: ['Fala maninho', 'E aí rapaize', 'Opa'],
    intensifiers: ['demais', 'da peste', 'massa', 'muito'],
    fillers: ['maninho', 'rapaz', 'olha', 'viu'],
    insults: ['caboco doido', 'besta', 'sem noção', 'folgado'],
    closers: ['é isso aí', 'falou', 'é nóis'],
    culturalRefs: ['aqui em Rondônia', 'na BR-364'],
    typicalEmojis: ['🌿', '💪', '🙏', '😂', '🔥'],
  },
  RR: {
    uf: 'RR',
    region: 'Norte',
    slang: ['maninho', 'caboco', 'mana', 'rapaize', 'égua'],
    exclamations: ['Eita!', 'Rapaz!', 'Égua!', 'Nossa!'],
    greetings: ['Fala maninho', 'E aí caboco', 'Opa'],
    intensifiers: ['demais', 'muito', 'massa', 'brabo'],
    fillers: ['maninho', 'rapaz', 'mana', 'olha'],
    insults: ['besta', 'doido', 'sem noção', 'folgado'],
    closers: ['é isso', 'falou', 'bora'],
    culturalRefs: ['aqui em Roraima', 'monte Roraima'],
    typicalEmojis: ['🌿', '💪', '🙏', '😂', '🔥'],
  },
  TO: {
    uf: 'TO',
    region: 'Norte',
    slang: ['uai', 'trem', 'caboco', 'rapaize', 'sô', 'bão'],
    exclamations: ['Uai!', 'Eita!', 'Rapaz!', 'Nossa!'],
    greetings: ['Fala rapaize', 'E aí', 'Opa', 'Cê tá bão?'],
    intensifiers: ['demais', 'demais da conta', 'trem bão', 'muito'],
    fillers: ['uai', 'rapaz', 'sô', 'olha'],
    insults: ['besta', 'doido', 'sem noção', 'trem ruim'],
    closers: ['é isso uai', 'falou sô', 'bora'],
    culturalRefs: ['aqui no Tocantins', 'Palmas tá quente demais'],
    typicalEmojis: ['🌾', '🔥', '💪', '🙏', '😂'],
  },

  // ─── NORDESTE ─────────────────────────────────────────────────────────
  AL: {
    uf: 'AL',
    region: 'Nordeste',
    slang: ['oxe', 'vixe', 'mainha', 'painho', 'véi', 'arretado', 'massa', 'mah'],
    exclamations: ['Oxe!', 'Vixe!', 'Misericórdia!', 'Ave Maria!', 'Eita!'],
    greetings: ['E aí véi', 'Fala mah', 'Opa', 'Bora'],
    intensifiers: ['arretado', 'massa', 'demais', 'da gota'],
    fillers: ['véi', 'mah', 'rapaz', 'olha', 'oxe'],
    insults: ['abestado', 'cabra safado', 'sem vergonha', 'oxe tu é doido'],
    closers: ['é isso véi', 'falou mah', 'bora'],
    culturalRefs: ['quente que nem Maceió em janeiro', 'praia de Pajuçara', 'sururu'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦', '🏖️'],
  },
  BA: {
    uf: 'BA',
    region: 'Nordeste',
    slang: ['oxe', 'vixe', 'mah', 'véi', 'massa', 'arretado', 'bichim', 'mó parada', 'pai'],
    exclamations: ['Oxe!', 'Vixe Maria!', 'Ô xente!', 'Misericórdia!', 'Eita porra!', 'Ave!'],
    greetings: ['E aí mah', 'Fala véi', 'Opa pai', 'Bora'],
    intensifiers: ['arretado', 'massa demais', 'da gota', 'demais', 'que é bom demais'],
    fillers: ['mah', 'véi', 'rapaz', 'pai', 'ô xente'],
    insults: ['abestado', 'cabra safado', 'bicho burro', 'sem vergonha', 'pilantra'],
    closers: ['é isso mah', 'falou véi', 'bora pai', 'axé'],
    culturalRefs: ['melhor que São João', 'tá pior que ladeira do Pelourinho', 'acarajé de verdade', 'na Bahia a gente resolve'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦', '✊'],
  },
  CE: {
    uf: 'CE',
    region: 'Nordeste',
    slang: ['oxe', 'macho', 'véi', 'bicho', 'avexado', 'massa', 'arretado', 'mah', 'cabra'],
    exclamations: ['Oxe!', 'Vixe!', 'Macho!', 'Eita!', 'Ave Maria!', 'Misericórdia!'],
    greetings: ['Fala macho', 'E aí véi', 'Opa bicho', 'Bora'],
    intensifiers: ['arretado', 'massa', 'demais', 'da gota', 'avexado'],
    fillers: ['macho', 'véi', 'bicho', 'rapaz', 'olha'],
    insults: ['abestado', 'cabra da peste', 'sem vergonha', 'oxe tu é besta', 'corno'],
    closers: ['é isso macho', 'falou véi', 'bora bicho'],
    culturalRefs: ['quente que nem Fortaleza', 'isso aí é conversinha', 'cearense é brabíssimo', 'humor cearense'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦', '☀️'],
  },
  MA: {
    uf: 'MA',
    region: 'Nordeste',
    slang: ['égua', 'mah', 'véi', 'rapaz', 'massa', 'arretado', 'camarada'],
    exclamations: ['Égua!', 'Oxe!', 'Vixe!', 'Misericórdia!', 'Ave Maria!'],
    greetings: ['Fala mah', 'E aí rapaz', 'Opa camarada'],
    intensifiers: ['demais', 'massa', 'arretado', 'da gota'],
    fillers: ['mah', 'rapaz', 'véi', 'olha', 'camarada'],
    insults: ['cabra safado', 'besta', 'sem vergonha', 'parasita'],
    closers: ['é isso mah', 'falou rapaz', 'bora'],
    culturalRefs: ['lençóis maranhenses', 'bumba meu boi', 'São Luís colonial'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦'],
  },
  PB: {
    uf: 'PB',
    region: 'Nordeste',
    slang: ['oxe', 'véi', 'mah', 'bicho', 'massa', 'arretado', 'cabra', 'da peste'],
    exclamations: ['Oxe!', 'Vixe!', 'Eita!', 'Misericórdia!', 'Ave Maria!'],
    greetings: ['Fala véi', 'E aí mah', 'Opa cabra', 'Bora'],
    intensifiers: ['arretado', 'massa', 'da peste', 'demais', 'da gota'],
    fillers: ['véi', 'mah', 'cabra', 'rapaz', 'bicho'],
    insults: ['abestado', 'cabra safado', 'sem vergonha', 'oxe bicho'],
    closers: ['é isso véi', 'falou mah', 'bora cabra'],
    culturalRefs: ['pior que São João de Campina', 'frio de Campina Grande', 'paraibano é brabo'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦'],
  },
  PE: {
    uf: 'PE',
    region: 'Nordeste',
    slang: ['oxe', 'véi', 'mah', 'macho', 'cabra', 'arretado', 'massa', 'bichim', 'aff'],
    exclamations: ['Oxe!', 'Vixe!', 'Eita porra!', 'Ô xente!', 'Ave Maria!', 'Misericórdia!'],
    greetings: ['Fala véi', 'E aí macho', 'Opa mah', 'Bora cabra'],
    intensifiers: ['arretado', 'massa', 'da gota', 'demais', 'mó'],
    fillers: ['véi', 'macho', 'mah', 'cabra', 'rapaz'],
    insults: ['abestado', 'cabra safado', 'bicho burro', 'pilantra', 'sem vergonha'],
    closers: ['é isso véi', 'falou macho', 'bora mah'],
    culturalRefs: ['melhor que frevo', 'Recife antigo', 'galo da madrugada', 'isso aí é conversinha de feira'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦', '🎭'],
  },
  PI: {
    uf: 'PI',
    region: 'Nordeste',
    slang: ['oxe', 'véi', 'mah', 'rapaz', 'massa', 'arretado', 'cabra'],
    exclamations: ['Oxe!', 'Vixe!', 'Eita!', 'Misericórdia!', 'Ave Maria!'],
    greetings: ['Fala véi', 'E aí rapaz', 'Opa mah'],
    intensifiers: ['demais', 'massa', 'arretado', 'da gota'],
    fillers: ['véi', 'mah', 'rapaz', 'olha', 'cabra'],
    insults: ['cabra safado', 'besta', 'sem vergonha', 'abestado'],
    closers: ['é isso véi', 'falou mah', 'bora'],
    culturalRefs: ['quente que nem Teresina', 'aqui no Piauí', 'delta do Parnaíba'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦'],
  },
  RN: {
    uf: 'RN',
    region: 'Nordeste',
    slang: ['oxe', 'véi', 'mah', 'bicho', 'massa', 'arretado', 'macho'],
    exclamations: ['Oxe!', 'Vixe!', 'Eita!', 'Misericórdia!', 'Ave Maria!'],
    greetings: ['Fala véi', 'E aí bicho', 'Opa mah'],
    intensifiers: ['arretado', 'massa', 'demais', 'da gota'],
    fillers: ['véi', 'mah', 'bicho', 'rapaz', 'macho'],
    insults: ['abestado', 'cabra safado', 'sem vergonha', 'besta'],
    closers: ['é isso véi', 'falou mah', 'bora bicho'],
    culturalRefs: ['aqui em Natal', 'maior cajueiro do mundo', 'praia de Ponta Negra'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦', '🏖️'],
  },
  SE: {
    uf: 'SE',
    region: 'Nordeste',
    slang: ['oxe', 'véi', 'mah', 'rapaz', 'massa', 'arretado', 'cabra'],
    exclamations: ['Oxe!', 'Vixe!', 'Eita!', 'Misericórdia!', 'Ave Maria!'],
    greetings: ['Fala véi', 'E aí mah', 'Opa rapaz'],
    intensifiers: ['demais', 'massa', 'arretado', 'da gota'],
    fillers: ['véi', 'mah', 'rapaz', 'olha', 'cabra'],
    insults: ['abestado', 'cabra safado', 'besta', 'sem vergonha'],
    closers: ['é isso véi', 'falou mah', 'bora'],
    culturalRefs: ['aqui em Sergipe', 'menor estado do Brasil mas o povo é brabo'],
    typicalEmojis: ['🔥', '💪', '🙏', '😂', '🤦'],
  },

  // ─── CENTRO-OESTE ─────────────────────────────────────────────────────
  DF: {
    uf: 'DF',
    region: 'Centro-Oeste',
    slang: ['véi', 'é das ideia', 'firmeza', 'suave', 'de boa', 'mano', 'tipo'],
    exclamations: ['Nossa!', 'Caramba!', 'Eita!', 'Pô!'],
    greetings: ['Fala véi', 'E aí', 'Suave?', 'Firmeza?'],
    intensifiers: ['demais', 'muito', 'absurdo', 'mó'],
    fillers: ['véi', 'tipo', 'mano', 'cara', 'né'],
    insults: ['mano tu é doido', 'sem noção', 'pilantra', 'folgado'],
    closers: ['é isso véi', 'falou', 'firmeza'],
    culturalRefs: ['Brasília é diferente', 'tesourinha', 'aqui no plano piloto', 'funcionário público'],
    typicalEmojis: ['🏛️', '💪', '🙏', '😂', '🤷'],
  },
  GO: {
    uf: 'GO',
    region: 'Centro-Oeste',
    slang: ['uai', 'trem', 'cê', 'sô', 'nó', 'bão', 'véi', 'mó parada'],
    exclamations: ['Uai!', 'Nó!', 'Nossa!', 'Eita!', 'Misericórdia!'],
    greetings: ['Fala cê', 'E aí sô', 'Opa', 'Tá bão?'],
    intensifiers: ['demais', 'demais da conta', 'trem bão', 'nó véi'],
    fillers: ['uai', 'sô', 'cê sabe', 'trem', 'véi'],
    insults: ['cê é doido', 'trem ruim', 'sem vergonha', 'besta'],
    closers: ['é isso uai', 'falou sô', 'bora'],
    culturalRefs: ['aqui em Goiás', 'gosto de pequi', 'sertanejo raiz'],
    typicalEmojis: ['🌾', '🐂', '🔥', '💪', '🤠'],
  },
  MT: {
    uf: 'MT',
    region: 'Centro-Oeste',
    slang: ['uai', 'trem', 'cê', 'rapaize', 'massa', 'bão', 'caboco'],
    exclamations: ['Uai!', 'Eita!', 'Rapaz!', 'Nossa!'],
    greetings: ['Fala rapaize', 'E aí', 'Opa', 'Tá bão?'],
    intensifiers: ['demais', 'muito', 'massa', 'trem bão'],
    fillers: ['uai', 'rapaz', 'cê sabe', 'olha'],
    insults: ['besta', 'sem noção', 'folgado', 'caboco doido'],
    closers: ['é isso', 'falou', 'bora'],
    culturalRefs: ['aqui no Mato Grosso', 'Pantanal', 'agro é tudo'],
    typicalEmojis: ['🌾', '🐂', '🔥', '💪', '🤠'],
  },
  MS: {
    uf: 'MS',
    region: 'Centro-Oeste',
    slang: ['uai', 'trem', 'cê', 'rapaize', 'bão', 'sô', 'massa'],
    exclamations: ['Uai!', 'Eita!', 'Nossa!', 'Rapaz!'],
    greetings: ['Fala rapaize', 'E aí', 'Opa', 'Tá bão?'],
    intensifiers: ['demais', 'muito', 'massa', 'trem bão'],
    fillers: ['uai', 'rapaz', 'sô', 'olha'],
    insults: ['besta', 'sem noção', 'folgado', 'trem ruim'],
    closers: ['é isso', 'falou', 'bora'],
    culturalRefs: ['aqui no Mato Grosso do Sul', 'Bonito', 'tereré'],
    typicalEmojis: ['🌾', '🐂', '🔥', '💪', '🧉'],
  },

  // ─── SUDESTE ──────────────────────────────────────────────────────────
  ES: {
    uf: 'ES',
    region: 'Sudeste',
    slang: ['po', 'mano', 'véi', 'massa', 'firmeza', 'suave', 'de boa'],
    exclamations: ['Pô!', 'Caramba!', 'Eita!', 'Nossa!'],
    greetings: ['Fala mano', 'E aí véi', 'Suave?'],
    intensifiers: ['demais', 'muito', 'pra caramba', 'massa'],
    fillers: ['mano', 'véi', 'cara', 'tipo', 'né'],
    insults: ['mano tu é doido', 'sem noção', 'folgado', 'besta'],
    closers: ['é isso mano', 'falou', 'firmeza'],
    culturalRefs: ['aqui no ES', 'moqueca capixaba é outra coisa', 'Vitória é suave'],
    typicalEmojis: ['🏖️', '🤙', '💪', '😂', '🙏'],
  },
  MG: {
    uf: 'MG',
    region: 'Sudeste',
    slang: ['uai', 'trem', 'sô', 'nó', 'cê', 'bão', 'nó véi', 'fia', 'fi', 'tá bão'],
    exclamations: ['Uai!', 'Nó!', 'Nossa Senhora!', 'Ô trem!', 'Credo!'],
    greetings: ['Cê tá bão?', 'Fala fi', 'E aí sô', 'Opa'],
    intensifiers: ['demais da conta', 'trem bão demais', 'nó véi', 'nó que trem'],
    fillers: ['uai', 'sô', 'cê sabe', 'trem', 'fi', 'fia'],
    insults: ['cê é doido sô', 'trem ruim', 'sem vergonha', 'jumento', 'besta'],
    closers: ['é isso uai', 'falou sô', 'bora fi'],
    culturalRefs: ['bom que nem pão de queijo', 'aqui em Minas', 'mineiro é quieto mas...', 'café com biscoito'],
    typicalEmojis: ['🧀', '☕', '💪', '😂', '🙏'],
  },
  RJ: {
    uf: 'RJ',
    region: 'Sudeste',
    slang: ['mermão', 'cria', 'sinistro', 'papo reto', 'chave', 'responsa', 'sangue bom', 'parceiro', 'caralho', 'porra'],
    exclamations: ['Caralho!', 'Porra!', 'Caraca!', 'Que isso!', 'Pô!', 'Rapaz!'],
    greetings: ['Fala mermão', 'E aí cria', 'Suave parceiro?', 'Qual é'],
    intensifiers: ['sinistro', 'absurdo', 'pra caralho', 'brabo', 'mó'],
    fillers: ['mermão', 'parceiro', 'caralho', 'brother', 'cria'],
    insults: ['vai tomar no cu', 'vagabundo', 'mermão tu é doido', 'pilantra', 'canalha', 'otário'],
    closers: ['papo reto', 'é isso aí mermão', 'falou cria', 'tmj'],
    culturalRefs: ['aqui no Rio é assim', 'carioca não tem medo', 'pior que o trânsito da Linha Amarela', 'praia de Copacabana'],
    typicalEmojis: ['🏖️', '🤙', '💰', '😂', '🔥', '💪'],
  },
  SP: {
    uf: 'SP',
    region: 'Sudeste',
    slang: ['mano', 'mina', 'firmeza', 'tá ligado', 'é nóis', 'da hora', 'zica', 'suave', 'de boa', 'parada', 'mó'],
    exclamations: ['Mano!', 'Caramba!', 'Pô!', 'Que isso!', 'Caralho!', 'Puts!'],
    greetings: ['E aí mano', 'Fala aí', 'Suave?', 'Firmeza?', 'Qual é'],
    intensifiers: ['mó', 'pra caramba', 'absurdo', 'zica', 'mó parada'],
    fillers: ['mano', 'tipo', 'cara', 'tá ligado', 'sacou', 'mina'],
    insults: ['mano tu é zica', 'otário', 'vacilão', 'sem noção', 'trouxa', 'mó bosta'],
    closers: ['é nóis mano', 'falou', 'firmeza', 'tmj'],
    culturalRefs: ['aqui em SP é correria', 'paulista correndo', 'trânsito da marginal', 'metrô lotado'],
    typicalEmojis: ['🏙️', '🤙', '💰', '😂', '🔥', '💪'],
  },

  // ─── SUL ──────────────────────────────────────────────────────────────
  PR: {
    uf: 'PR',
    region: 'Sul',
    slang: ['piá', 'guri', 'guria', 'bah', 'tri', 'tchê', 'mas bah', 'de boa'],
    exclamations: ['Bah!', 'Nossa!', 'Eita!', 'Caramba!', 'Mas bah!'],
    greetings: ['Fala piá', 'E aí guri', 'Opa', 'Suave?'],
    intensifiers: ['tri', 'demais', 'muito', 'barbaridade de bom'],
    fillers: ['piá', 'guri', 'né', 'tipo', 'bah'],
    insults: ['piá doido', 'sem noção', 'folgado', 'bah tu é besta'],
    closers: ['é isso piá', 'falou guri', 'bora'],
    culturalRefs: ['aqui no Paraná', 'Curitiba tá frio demais', 'churrasco de domingo'],
    typicalEmojis: ['🧉', '🥩', '💚', '😂', '👊'],
  },
  RS: {
    uf: 'RS',
    region: 'Sul',
    slang: ['bah', 'tchê', 'guri', 'guria', 'tri', 'barbaridade', 'bagual', 'capaz', 'bá', 'mas bah'],
    exclamations: ['Bah!', 'Barbaridade!', 'Tchê!', 'Tri!', 'Mas bah!', 'Bah tchê!'],
    greetings: ['Bah tchê', 'E aí guri', 'Fala guria', 'Opa'],
    intensifiers: ['tri', 'tri legal', 'barbaridade de bom', 'bah demais'],
    fillers: ['tchê', 'bah', 'guri', 'guria', 'né'],
    insults: ['bah tu é doido tchê', 'sem vergonha', 'barbaridade de ruim', 'guri sem noção'],
    closers: ['é isso tchê', 'falou guri', 'bora guria', 'capaz'],
    culturalRefs: ['melhor que churrasco de domingo', 'chimarrão', 'aqui no sul a gente resolve', 'gaúcho é brabo'],
    typicalEmojis: ['🧉', '🥩', '💚', '😎', '👊', '🔴'],
  },
  SC: {
    uf: 'SC',
    region: 'Sul',
    slang: ['bah', 'guri', 'guria', 'piá', 'tri', 'tchê', 'de boa'],
    exclamations: ['Bah!', 'Nossa!', 'Eita!', 'Caramba!'],
    greetings: ['Fala guri', 'E aí piá', 'Opa', 'Suave?'],
    intensifiers: ['tri', 'demais', 'muito', 'massa'],
    fillers: ['guri', 'piá', 'né', 'tipo', 'bah'],
    insults: ['sem noção', 'folgado', 'bah tu é besta', 'guri doido'],
    closers: ['é isso guri', 'falou', 'bora'],
    culturalRefs: ['aqui em Santa Catarina', 'Floripa é tri', 'Oktoberfest de Blumenau', 'frio de lascar'],
    typicalEmojis: ['🧉', '🥩', '🏖️', '😂', '💪'],
  },
};

// ── Internet Brazilianisms (universal) ──────────────────────────────────────

export const INTERNET_BR = {
  /** Abreviações comuns → texto expandido (usamos ao contrário: expandido → abreviado) */
  abbreviations: {
    'você': 'vc',
    'também': 'tb',
    'porque': 'pq',
    'por que': 'pq',
    'comigo': 'cmg',
    'o que': 'oq',
    'que': 'q',
    'não': 'n',
    'muito': 'mt',
    'mesmo': 'msm',
    'ninguém': 'ngm',
    'nada': 'nd',
    'tudo': 'td',
    'beleza': 'blz',
    'falou': 'flw',
    'valeu': 'vlw',
    'para': 'pra',
    'estou': 'to',
    'estava': 'tava',
    'está': 'ta',
    'verdade': 'vdd',
    'mano': 'mn',
    'por favor': 'pfv',
    'obrigado': 'obg',
    'obrigada': 'obg',
    'depois': 'dps',
    'quando': 'qnd',
    'quem': 'qm',
    'certeza': 'ctz',
    'saudades': 'sdds',
    'demais': 'dms',
    'alguma coisa': 'alguma csa',
    'qualquer': 'qlqr',
    'ainda': 'inda',
    'agora': 'agr',
    'aqui': 'aki',
    'aí': 'ai',
    'acho': 'axo',
    'estão': 'tão',
    'então': 'entao',
    'sim': 'ss',
    'realmente': 'rlmente',
    'problema': 'prob',
    'governo': 'gov',
    'pessoa': 'pss',
    'pessoas': 'pssoas',
    'Brasil': 'BR',
    'brasileiro': 'br',
    'situação': 'situaçao',
    'político': 'politico',
    'dinheiro': 'din',
  } as Record<string, string>,

  /** Variações de risada */
  laughter: [
    'kkkk', 'kkkkk', 'kkkkkkk', 'kkkkkkkkkk', 'KKKKKKKK', 'KKKKKKKKKKK',
    'rsrsrs', 'rsrs', 'hahaha', 'hauahaua', 'ksksksk', 'ashuahsuah',
    'kkkkk morri', 'kkkk to passada',
  ],

  /** Palavras de reação */
  reactions: [
    'pse', 'foda', 'tenso', 'mds', 'vish', 'eita', 'caraca', 'puts',
    'slk', 'plmds', 'socorro', 'mds do céu', 'ai gente', 'namoral',
  ],

  /** Padrões de pontuação excessiva */
  punctuationPatterns: ['???', '!!!', '...', '?!?!', '!!!!!', '????', '?!', '...........'],
};

// ── Education Modifiers ─────────────────────────────────────────────────────

export const EDUCATION_MODIFIERS: Record<string, EducationModifier> = {
  'Fundamental': {
    spellingAccuracy: 0.4,
    vocabularyTier: 'basic',
    punctuationUsage: 'none',
    commonErrors: [
      ['mais', 'mas'],
      ['agente', 'a gente'],
      ['concerteza', 'com certeza'],
      ['derrepente', 'de repente'],
      ['mim fazer', 'eu fazer'],
      ['mim ir', 'eu ir'],
      ['nóis', 'nós'],
      ['nóis vai', 'nós vamos'],
      ['ele foi e falo', 'ele foi e falou'],
      ['porisso', 'por isso'],
      ['aonde', 'onde'],
      ['perca', 'perda'],
      ['tiver', 'estiver'],
      ['menas', 'menos'],
      ['poblema', 'problema'],
      ['cunzinha', 'cozinha'],
      ['percisa', 'precisa'],
      ['indiota', 'idiota'],
      ['nao', 'não'],
      ['tambem', 'também'],
      ['voce', 'você'],
      ['eh', 'é'],
      ['ta', 'está'],
      ['to', 'estou'],
      ['pro', 'para o'],
      ['num', 'não'],
    ],
  },
  'Médio': {
    spellingAccuracy: 0.65,
    vocabularyTier: 'basic',
    punctuationUsage: 'minimal',
    commonErrors: [
      ['mais', 'mas'],
      ['agente', 'a gente'],
      ['concerteza', 'com certeza'],
      ['mim fazer', 'eu fazer'],
      ['nao', 'não'],
      ['tambem', 'também'],
      ['voce', 'você'],
      ['poblema', 'problema'],
      ['ta', 'está'],
    ],
  },
  'Superior Incompleto': {
    spellingAccuracy: 0.8,
    vocabularyTier: 'intermediate',
    punctuationUsage: 'standard',
    commonErrors: [
      ['mais', 'mas'],
      ['nao', 'não'],
      ['voce', 'você'],
    ],
  },
  'Superior Completo': {
    spellingAccuracy: 0.92,
    vocabularyTier: 'advanced',
    punctuationUsage: 'standard',
    commonErrors: [],
  },
  'Pós-Graduação/MBA': {
    spellingAccuracy: 0.95,
    vocabularyTier: 'advanced',
    punctuationUsage: 'meticulous',
    commonErrors: [],
  },
  'Mestrado/Doutorado': {
    spellingAccuracy: 0.98,
    vocabularyTier: 'advanced',
    punctuationUsage: 'meticulous',
    commonErrors: [],
  },
};

// ── Generation Modifiers ────────────────────────────────────────────────────

export const GENERATION_MODIFIERS: Record<string, GenerationModifier> = {
  'Gen Z': {
    abbreviationRate: 0.75,
    emojiDensity: 0.7,
    capsRate: 0.3,
    sentenceLength: 'very_short',
    laughterRate: 0.5,
    extraAbbreviations: ['mn', 'slk', 'pfv', 'pprt', 'sdds', 'pdc', 'mlk', 'plmds', 'mds', 'nd', 'ngm'],
    memeExpressions: ['to passada', 'lacrou', 'surtei', 'cancelado', 'vibes', 'red flag', 'brisa', 'cringe', 'based', 'real', 'ain gente', 'socorro', 'gente'],
  },
  'Millennial': {
    abbreviationRate: 0.5,
    emojiDensity: 0.35,
    capsRate: 0.15,
    sentenceLength: 'short',
    laughterRate: 0.35,
    extraAbbreviations: ['vc', 'tb', 'pq', 'blz', 'vlw', 'flw'],
    memeExpressions: ['sqn', 'partiu', 'senta lá', 'chateado', 'nem', 'haha'],
  },
  'Gen X': {
    abbreviationRate: 0.2,
    emojiDensity: 0.15,
    capsRate: 0.1,
    sentenceLength: 'medium',
    laughterRate: 0.15,
    extraAbbreviations: ['vc', 'tb'],
    memeExpressions: [],
  },
  'Boomer': {
    abbreviationRate: 0.05,
    emojiDensity: 0.1,
    capsRate: 0.45,
    sentenceLength: 'long',
    laughterRate: 0.05,
    extraAbbreviations: [],
    memeExpressions: [],
  },
};

// ── Class Modifiers ─────────────────────────────────────────────────────────

export const CLASS_MODIFIERS: Record<string, ClassModifier> = {
  'A': {
    formalityLevel: 0.7,
    complainAbout: ['impostos absurdos', 'burocracia', 'segurança', 'esse governo'],
    aspirational: false,
  },
  'B1': {
    formalityLevel: 0.6,
    complainAbout: ['custo de vida', 'qualidade dos serviços', 'impostos', 'educação'],
    aspirational: true,
  },
  'B2': {
    formalityLevel: 0.5,
    complainAbout: ['preço das coisas', 'falta de oportunidade', 'saúde pública'],
    aspirational: true,
  },
  'C1': {
    formalityLevel: 0.4,
    complainAbout: ['salário', 'transporte', 'saúde pública', 'preço do mercado'],
    aspirational: true,
  },
  'C2': {
    formalityLevel: 0.3,
    complainAbout: ['emprego', 'preço da comida', 'violência', 'falta de tudo'],
    aspirational: false,
  },
  'D': {
    formalityLevel: 0.2,
    complainAbout: ['fome', 'emprego', 'moradia', 'violência', 'abandono'],
    aspirational: false,
  },
  'E': {
    formalityLevel: 0.15,
    complainAbout: ['sobrevivência', 'fome', 'abandono do estado', 'violência'],
    aspirational: false,
  },
};

// ── Area Type Modifiers ─────────────────────────────────────────────────────

export const AREA_MODIFIERS: Record<string, { regionalBoost: number; religiousRate: number; formalityShift: number }> = {
  'Capital/Metrópole': { regionalBoost: -0.1, religiousRate: 0.2, formalityShift: 0.1 },
  'Urbana/Interior': { regionalBoost: 0.15, religiousRate: 0.35, formalityShift: -0.05 },
  'Rural': { regionalBoost: 0.3, religiousRate: 0.5, formalityShift: -0.15 },
  'Litoral': { regionalBoost: 0.05, religiousRate: 0.2, formalityShift: 0 },
};

// ── Emojis by sentiment and context ─────────────────────────────────────────

export const SENTIMENT_EMOJIS: Record<string, string[]> = {
  positive: ['👍', '👏', '💪', '✅', '🔥', '❤️', '🙌', '💯', '👊', '🎯'],
  negative: ['👎', '😡', '🤬', '💀', '🤦', '😤', '🙄', '😒', '⚠️', '🚫'],
  neutral: ['🤔', '🤷', '😐', '💭', '📊', '⚖️', '👀', '💬'],
  religious: ['🙏', '✝️', '⛪', '🕊️', '📖'],
};

// ── Helper: get state profile or fallback to generic ────────────────────────

export function getStateProfile(uf: string): StateProfile {
  return STATE_PROFILES[uf] || STATE_PROFILES['SP']; // fallback SP
}

export function getRegionFromUF(uf: string): string {
  return STATE_PROFILES[uf]?.region || 'Sudeste';
}
