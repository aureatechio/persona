"""
Brazilian Linguistics Database
==============================
Base de dados linguistica completa para geracao de comentarios
autenticos de redes sociais brasileiras.

Granularidade: por estado (27 UFs) + modificadores demograficos

Python port of src/lib/brazilian-linguistics.ts
"""

from typing import TypedDict

# -- Types ------------------------------------------------------------------


class StateProfile(TypedDict):
    uf: str
    region: str
    slang: list[str]
    exclamations: list[str]
    greetings: list[str]
    intensifiers: list[str]
    fillers: list[str]
    insults: list[str]
    closers: list[str]
    culturalRefs: list[str]
    typicalEmojis: list[str]


class EducationModifier(TypedDict):
    spellingAccuracy: float
    vocabularyTier: str  # 'basic' | 'intermediate' | 'advanced'
    punctuationUsage: str  # 'none' | 'minimal' | 'standard' | 'meticulous'
    commonErrors: list[tuple[str, str]]  # (errado, correto)


class GenerationModifier(TypedDict):
    abbreviationRate: float
    emojiDensity: float
    capsRate: float
    sentenceLength: str  # 'very_short' | 'short' | 'medium' | 'long'
    laughterRate: float
    extraAbbreviations: list[str]
    memeExpressions: list[str]


class ClassModifier(TypedDict):
    formalityLevel: float
    complainAbout: list[str]
    aspirational: bool


class AreaModifier(TypedDict):
    regionalBoost: float
    religiousRate: float
    formalityShift: float


# -- State Profiles (27 UFs) -----------------------------------------------

STATE_PROFILES: dict[str, StateProfile] = {
    # --- NORTE --------------------------------------------------------------
    "AC": {
        "uf": "AC",
        "region": "Norte",
        "slang": ["maninho", "caboco", "rapaize", "da peste", "aperreado", "arrocha"],
        "exclamations": ["Eita!", "Rapaz!", "Ave Maria!", "Misericordia!"],
        "greetings": ["Fala maninho", "E ai caboco", "Opa rapaize"],
        "intensifiers": ["demais", "da peste", "que e uma beleza", "massa"],
        "fillers": ["maninho", "rapaz", "olha", "viu"],
        "insults": ["caboco doido", "aperreado", "sem nocao", "besta"],
        "closers": ["e isso ai maninho", "falou", "e nois"],
        "culturalRefs": ["aqui no acre existe sim kkk", "a gente nao vive com dinossauro nao"],
        "typicalEmojis": ["\U0001f33f", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f525"],
    },
    "AM": {
        "uf": "AM",
        "region": "Norte",
        "slang": ["egua", "maninho", "mana", "tu e doido", "massa", "embuado", "maceta"],
        "exclamations": ["Egua!", "Ta te doido!", "Papai!", "Caramba!", "Egua mano!"],
        "greetings": ["Fala maninho", "E ai mana", "Opa", "Bora"],
        "intensifiers": ["egua", "demais", "maceta", "massa", "brabo"],
        "fillers": ["maninho", "mana", "papai", "tu sabe", "olha"],
        "insults": ["tu e doido", "embuado", "parasita", "besta", "mal carater"],
        "closers": ["e isso maninho", "falou mana", "bora"],
        "culturalRefs": ["bom que nem acai", "aqui na amazonia", "rio negro e solimoes", "manaus nao e so selva"],
        "typicalEmojis": ["\U0001f33f", "\U0001f40a", "\U0001f525", "\U0001f4aa", "\U0001f64f"],
    },
    "AP": {
        "uf": "AP",
        "region": "Norte",
        "slang": ["maninho", "mana", "egua", "da hora", "massa", "rapaize"],
        "exclamations": ["Egua!", "Rapaz!", "Eita!", "Nossa!"],
        "greetings": ["Fala maninho", "E ai mana", "Opa"],
        "intensifiers": ["demais", "muito", "massa", "da hora"],
        "fillers": ["maninho", "mana", "rapaz", "olha"],
        "insults": ["besta", "sem nocao", "doido", "folgado"],
        "closers": ["e isso", "falou", "bora"],
        "culturalRefs": ["aqui no meio do mundo", "linha do equador"],
        "typicalEmojis": ["\U0001f33f", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f525"],
    },
    "PA": {
        "uf": "PA",
        "region": "Norte",
        "slang": ["egua", "mano", "mana", "pai degua", "ta te doido", "maninho", "e mermo", "carapana"],
        "exclamations": ["Egua!", "Ta te doido!", "Papai!", "Pai degua!", "Egua mano!"],
        "greetings": ["Fala mano", "E ai maninho", "Egua mano", "Bora"],
        "intensifiers": ["egua", "pai degua", "demais", "muito", "e mermo"],
        "fillers": ["mano", "maninho", "mana", "papai", "egua"],
        "insults": ["ta te doido", "besta", "sem vergonha", "folgado", "pilantra"],
        "closers": ["e isso mano", "falou maninho", "bora"],
        "culturalRefs": ["bom que nem tucupi", "quente que nem Belem", "no ver-o-peso", "cirio de Nazare"],
        "typicalEmojis": ["\U0001f33f", "\U0001f40a", "\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602"],
    },
    "RO": {
        "uf": "RO",
        "region": "Norte",
        "slang": ["maninho", "caboco", "rapaize", "da peste", "massa"],
        "exclamations": ["Eita!", "Rapaz!", "Nossa!", "Ave Maria!"],
        "greetings": ["Fala maninho", "E ai rapaize", "Opa"],
        "intensifiers": ["demais", "da peste", "massa", "muito"],
        "fillers": ["maninho", "rapaz", "olha", "viu"],
        "insults": ["caboco doido", "besta", "sem nocao", "folgado"],
        "closers": ["e isso ai", "falou", "e nois"],
        "culturalRefs": ["aqui em Rondonia", "na BR-364"],
        "typicalEmojis": ["\U0001f33f", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f525"],
    },
    "RR": {
        "uf": "RR",
        "region": "Norte",
        "slang": ["maninho", "caboco", "mana", "rapaize", "egua"],
        "exclamations": ["Eita!", "Rapaz!", "Egua!", "Nossa!"],
        "greetings": ["Fala maninho", "E ai caboco", "Opa"],
        "intensifiers": ["demais", "muito", "massa", "brabo"],
        "fillers": ["maninho", "rapaz", "mana", "olha"],
        "insults": ["besta", "doido", "sem nocao", "folgado"],
        "closers": ["e isso", "falou", "bora"],
        "culturalRefs": ["aqui em Roraima", "monte Roraima"],
        "typicalEmojis": ["\U0001f33f", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f525"],
    },
    "TO": {
        "uf": "TO",
        "region": "Norte",
        "slang": ["uai", "trem", "caboco", "rapaize", "so", "bao"],
        "exclamations": ["Uai!", "Eita!", "Rapaz!", "Nossa!"],
        "greetings": ["Fala rapaize", "E ai", "Opa", "Ce ta bao?"],
        "intensifiers": ["demais", "demais da conta", "trem bao", "muito"],
        "fillers": ["uai", "rapaz", "so", "olha"],
        "insults": ["besta", "doido", "sem nocao", "trem ruim"],
        "closers": ["e isso uai", "falou so", "bora"],
        "culturalRefs": ["aqui no Tocantins", "Palmas ta quente demais"],
        "typicalEmojis": ["\U0001f33e", "\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602"],
    },

    # --- NORDESTE -----------------------------------------------------------
    "AL": {
        "uf": "AL",
        "region": "Nordeste",
        "slang": ["oxe", "vixe", "mainha", "painho", "vei", "arretado", "massa", "mah"],
        "exclamations": ["Oxe!", "Vixe!", "Misericordia!", "Ave Maria!", "Eita!"],
        "greetings": ["E ai vei", "Fala mah", "Opa", "Bora"],
        "intensifiers": ["arretado", "massa", "demais", "da gota"],
        "fillers": ["vei", "mah", "rapaz", "olha", "oxe"],
        "insults": ["abestado", "cabra safado", "sem vergonha", "oxe tu e doido"],
        "closers": ["e isso vei", "falou mah", "bora"],
        "culturalRefs": ["quente que nem Maceio em janeiro", "praia de Pajucara", "sururu"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926", "\U0001f3d6\ufe0f"],
    },
    "BA": {
        "uf": "BA",
        "region": "Nordeste",
        "slang": ["oxe", "vixe", "mah", "vei", "massa", "arretado", "bichim", "mo parada", "pai"],
        "exclamations": ["Oxe!", "Vixe Maria!", "O xente!", "Misericordia!", "Eita porra!", "Ave!"],
        "greetings": ["E ai mah", "Fala vei", "Opa pai", "Bora"],
        "intensifiers": ["arretado", "massa demais", "da gota", "demais", "que e bom demais"],
        "fillers": ["mah", "vei", "rapaz", "pai", "o xente"],
        "insults": ["abestado", "cabra safado", "bicho burro", "sem vergonha", "pilantra"],
        "closers": ["e isso mah", "falou vei", "bora pai", "axe"],
        "culturalRefs": ["melhor que Sao Joao", "ta pior que ladeira do Pelourinho", "acaraje de verdade", "na Bahia a gente resolve"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926", "\u270a"],
    },
    "CE": {
        "uf": "CE",
        "region": "Nordeste",
        "slang": ["oxe", "macho", "vei", "bicho", "avexado", "massa", "arretado", "mah", "cabra"],
        "exclamations": ["Oxe!", "Vixe!", "Macho!", "Eita!", "Ave Maria!", "Misericordia!"],
        "greetings": ["Fala macho", "E ai vei", "Opa bicho", "Bora"],
        "intensifiers": ["arretado", "massa", "demais", "da gota", "avexado"],
        "fillers": ["macho", "vei", "bicho", "rapaz", "olha"],
        "insults": ["abestado", "cabra da peste", "sem vergonha", "oxe tu e besta", "corno"],
        "closers": ["e isso macho", "falou vei", "bora bicho"],
        "culturalRefs": ["quente que nem Fortaleza", "isso ai e conversinha", "cearense e brabissimo", "humor cearense"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926", "\u2600\ufe0f"],
    },
    "MA": {
        "uf": "MA",
        "region": "Nordeste",
        "slang": ["egua", "mah", "vei", "rapaz", "massa", "arretado", "camarada"],
        "exclamations": ["Egua!", "Oxe!", "Vixe!", "Misericordia!", "Ave Maria!"],
        "greetings": ["Fala mah", "E ai rapaz", "Opa camarada"],
        "intensifiers": ["demais", "massa", "arretado", "da gota"],
        "fillers": ["mah", "rapaz", "vei", "olha", "camarada"],
        "insults": ["cabra safado", "besta", "sem vergonha", "parasita"],
        "closers": ["e isso mah", "falou rapaz", "bora"],
        "culturalRefs": ["lencois maranhenses", "bumba meu boi", "Sao Luis colonial"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926"],
    },
    "PB": {
        "uf": "PB",
        "region": "Nordeste",
        "slang": ["oxe", "vei", "mah", "bicho", "massa", "arretado", "cabra", "da peste"],
        "exclamations": ["Oxe!", "Vixe!", "Eita!", "Misericordia!", "Ave Maria!"],
        "greetings": ["Fala vei", "E ai mah", "Opa cabra", "Bora"],
        "intensifiers": ["arretado", "massa", "da peste", "demais", "da gota"],
        "fillers": ["vei", "mah", "cabra", "rapaz", "bicho"],
        "insults": ["abestado", "cabra safado", "sem vergonha", "oxe bicho"],
        "closers": ["e isso vei", "falou mah", "bora cabra"],
        "culturalRefs": ["pior que Sao Joao de Campina", "frio de Campina Grande", "paraibano e brabo"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926"],
    },
    "PE": {
        "uf": "PE",
        "region": "Nordeste",
        "slang": ["oxe", "vei", "mah", "macho", "cabra", "arretado", "massa", "bichim", "aff"],
        "exclamations": ["Oxe!", "Vixe!", "Eita porra!", "O xente!", "Ave Maria!", "Misericordia!"],
        "greetings": ["Fala vei", "E ai macho", "Opa mah", "Bora cabra"],
        "intensifiers": ["arretado", "massa", "da gota", "demais", "mo"],
        "fillers": ["vei", "macho", "mah", "cabra", "rapaz"],
        "insults": ["abestado", "cabra safado", "bicho burro", "pilantra", "sem vergonha"],
        "closers": ["e isso vei", "falou macho", "bora mah"],
        "culturalRefs": ["melhor que frevo", "Recife antigo", "galo da madrugada", "isso ai e conversinha de feira"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926", "\U0001f3ad"],
    },
    "PI": {
        "uf": "PI",
        "region": "Nordeste",
        "slang": ["oxe", "vei", "mah", "rapaz", "massa", "arretado", "cabra"],
        "exclamations": ["Oxe!", "Vixe!", "Eita!", "Misericordia!", "Ave Maria!"],
        "greetings": ["Fala vei", "E ai rapaz", "Opa mah"],
        "intensifiers": ["demais", "massa", "arretado", "da gota"],
        "fillers": ["vei", "mah", "rapaz", "olha", "cabra"],
        "insults": ["cabra safado", "besta", "sem vergonha", "abestado"],
        "closers": ["e isso vei", "falou mah", "bora"],
        "culturalRefs": ["quente que nem Teresina", "aqui no Piaui", "delta do Parnaiba"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926"],
    },
    "RN": {
        "uf": "RN",
        "region": "Nordeste",
        "slang": ["oxe", "vei", "mah", "bicho", "massa", "arretado", "macho"],
        "exclamations": ["Oxe!", "Vixe!", "Eita!", "Misericordia!", "Ave Maria!"],
        "greetings": ["Fala vei", "E ai bicho", "Opa mah"],
        "intensifiers": ["arretado", "massa", "demais", "da gota"],
        "fillers": ["vei", "mah", "bicho", "rapaz", "macho"],
        "insults": ["abestado", "cabra safado", "sem vergonha", "besta"],
        "closers": ["e isso vei", "falou mah", "bora bicho"],
        "culturalRefs": ["aqui em Natal", "maior cajueiro do mundo", "praia de Ponta Negra"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926", "\U0001f3d6\ufe0f"],
    },
    "SE": {
        "uf": "SE",
        "region": "Nordeste",
        "slang": ["oxe", "vei", "mah", "rapaz", "massa", "arretado", "cabra"],
        "exclamations": ["Oxe!", "Vixe!", "Eita!", "Misericordia!", "Ave Maria!"],
        "greetings": ["Fala vei", "E ai mah", "Opa rapaz"],
        "intensifiers": ["demais", "massa", "arretado", "da gota"],
        "fillers": ["vei", "mah", "rapaz", "olha", "cabra"],
        "insults": ["abestado", "cabra safado", "besta", "sem vergonha"],
        "closers": ["e isso vei", "falou mah", "bora"],
        "culturalRefs": ["aqui em Sergipe", "menor estado do Brasil mas o povo e brabo"],
        "typicalEmojis": ["\U0001f525", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f926"],
    },

    # --- CENTRO-OESTE -------------------------------------------------------
    "DF": {
        "uf": "DF",
        "region": "Centro-Oeste",
        "slang": ["vei", "e das ideia", "firmeza", "suave", "de boa", "mano", "tipo"],
        "exclamations": ["Nossa!", "Caramba!", "Eita!", "Po!"],
        "greetings": ["Fala vei", "E ai", "Suave?", "Firmeza?"],
        "intensifiers": ["demais", "muito", "absurdo", "mo"],
        "fillers": ["vei", "tipo", "mano", "cara", "ne"],
        "insults": ["mano tu e doido", "sem nocao", "pilantra", "folgado"],
        "closers": ["e isso vei", "falou", "firmeza"],
        "culturalRefs": ["Brasilia e diferente", "tesourinha", "aqui no plano piloto", "funcionario publico"],
        "typicalEmojis": ["\U0001f3db\ufe0f", "\U0001f4aa", "\U0001f64f", "\U0001f602", "\U0001f937"],
    },
    "GO": {
        "uf": "GO",
        "region": "Centro-Oeste",
        "slang": ["uai", "trem", "ce", "so", "no", "bao", "vei", "mo parada"],
        "exclamations": ["Uai!", "No!", "Nossa!", "Eita!", "Misericordia!"],
        "greetings": ["Fala ce", "E ai so", "Opa", "Ta bao?"],
        "intensifiers": ["demais", "demais da conta", "trem bao", "no vei"],
        "fillers": ["uai", "so", "ce sabe", "trem", "vei"],
        "insults": ["ce e doido", "trem ruim", "sem vergonha", "besta"],
        "closers": ["e isso uai", "falou so", "bora"],
        "culturalRefs": ["aqui em Goias", "gosto de pequi", "sertanejo raiz"],
        "typicalEmojis": ["\U0001f33e", "\U0001f402", "\U0001f525", "\U0001f4aa", "\U0001f920"],
    },
    "MT": {
        "uf": "MT",
        "region": "Centro-Oeste",
        "slang": ["uai", "trem", "ce", "rapaize", "massa", "bao", "caboco"],
        "exclamations": ["Uai!", "Eita!", "Rapaz!", "Nossa!"],
        "greetings": ["Fala rapaize", "E ai", "Opa", "Ta bao?"],
        "intensifiers": ["demais", "muito", "massa", "trem bao"],
        "fillers": ["uai", "rapaz", "ce sabe", "olha"],
        "insults": ["besta", "sem nocao", "folgado", "caboco doido"],
        "closers": ["e isso", "falou", "bora"],
        "culturalRefs": ["aqui no Mato Grosso", "Pantanal", "agro e tudo"],
        "typicalEmojis": ["\U0001f33e", "\U0001f402", "\U0001f525", "\U0001f4aa", "\U0001f920"],
    },
    "MS": {
        "uf": "MS",
        "region": "Centro-Oeste",
        "slang": ["uai", "trem", "ce", "rapaize", "bao", "so", "massa"],
        "exclamations": ["Uai!", "Eita!", "Nossa!", "Rapaz!"],
        "greetings": ["Fala rapaize", "E ai", "Opa", "Ta bao?"],
        "intensifiers": ["demais", "muito", "massa", "trem bao"],
        "fillers": ["uai", "rapaz", "so", "olha"],
        "insults": ["besta", "sem nocao", "folgado", "trem ruim"],
        "closers": ["e isso", "falou", "bora"],
        "culturalRefs": ["aqui no Mato Grosso do Sul", "Bonito", "terere"],
        "typicalEmojis": ["\U0001f33e", "\U0001f402", "\U0001f525", "\U0001f4aa", "\U0001f9c9"],
    },

    # --- SUDESTE ------------------------------------------------------------
    "ES": {
        "uf": "ES",
        "region": "Sudeste",
        "slang": ["po", "mano", "vei", "massa", "firmeza", "suave", "de boa"],
        "exclamations": ["Po!", "Caramba!", "Eita!", "Nossa!"],
        "greetings": ["Fala mano", "E ai vei", "Suave?"],
        "intensifiers": ["demais", "muito", "pra caramba", "massa"],
        "fillers": ["mano", "vei", "cara", "tipo", "ne"],
        "insults": ["mano tu e doido", "sem nocao", "folgado", "besta"],
        "closers": ["e isso mano", "falou", "firmeza"],
        "culturalRefs": ["aqui no ES", "moqueca capixaba e outra coisa", "Vitoria e suave"],
        "typicalEmojis": ["\U0001f3d6\ufe0f", "\U0001f919", "\U0001f4aa", "\U0001f602", "\U0001f64f"],
    },
    "MG": {
        "uf": "MG",
        "region": "Sudeste",
        "slang": ["uai", "trem", "so", "no", "ce", "bao", "no vei", "fia", "fi", "ta bao"],
        "exclamations": ["Uai!", "No!", "Nossa Senhora!", "O trem!", "Credo!"],
        "greetings": ["Ce ta bao?", "Fala fi", "E ai so", "Opa"],
        "intensifiers": ["demais da conta", "trem bao demais", "no vei", "no que trem"],
        "fillers": ["uai", "so", "ce sabe", "trem", "fi", "fia"],
        "insults": ["ce e doido so", "trem ruim", "sem vergonha", "jumento", "besta"],
        "closers": ["e isso uai", "falou so", "bora fi"],
        "culturalRefs": ["bom que nem pao de queijo", "aqui em Minas", "mineiro e quieto mas...", "cafe com biscoito"],
        "typicalEmojis": ["\U0001f9c0", "\u2615", "\U0001f4aa", "\U0001f602", "\U0001f64f"],
    },
    "RJ": {
        "uf": "RJ",
        "region": "Sudeste",
        "slang": ["mermao", "cria", "sinistro", "papo reto", "chave", "responsa", "sangue bom", "parceiro", "caralho", "porra"],
        "exclamations": ["Caralho!", "Porra!", "Caraca!", "Que isso!", "Po!", "Rapaz!"],
        "greetings": ["Fala mermao", "E ai cria", "Suave parceiro?", "Qual e"],
        "intensifiers": ["sinistro", "absurdo", "pra caralho", "brabo", "mo"],
        "fillers": ["mermao", "parceiro", "caralho", "brother", "cria"],
        "insults": ["vai tomar no cu", "vagabundo", "mermao tu e doido", "pilantra", "canalha", "otario"],
        "closers": ["papo reto", "e isso ai mermao", "falou cria", "tmj"],
        "culturalRefs": ["aqui no Rio e assim", "carioca nao tem medo", "pior que o transito da Linha Amarela", "praia de Copacabana"],
        "typicalEmojis": ["\U0001f3d6\ufe0f", "\U0001f919", "\U0001f4b0", "\U0001f602", "\U0001f525", "\U0001f4aa"],
    },
    "SP": {
        "uf": "SP",
        "region": "Sudeste",
        "slang": ["mano", "mina", "firmeza", "ta ligado", "e nois", "da hora", "zica", "suave", "de boa", "parada", "mo"],
        "exclamations": ["Mano!", "Caramba!", "Po!", "Que isso!", "Caralho!", "Puts!"],
        "greetings": ["E ai mano", "Fala ai", "Suave?", "Firmeza?", "Qual e"],
        "intensifiers": ["mo", "pra caramba", "absurdo", "zica", "mo parada"],
        "fillers": ["mano", "tipo", "cara", "ta ligado", "sacou", "mina"],
        "insults": ["mano tu e zica", "otario", "vacilao", "sem nocao", "trouxa", "mo bosta"],
        "closers": ["e nois mano", "falou", "firmeza", "tmj"],
        "culturalRefs": ["aqui em SP e correria", "paulista correndo", "transito da marginal", "metro lotado"],
        "typicalEmojis": ["\U0001f3d9\ufe0f", "\U0001f919", "\U0001f4b0", "\U0001f602", "\U0001f525", "\U0001f4aa"],
    },

    # --- SUL ----------------------------------------------------------------
    "PR": {
        "uf": "PR",
        "region": "Sul",
        "slang": ["pia", "guri", "guria", "bah", "tri", "tche", "mas bah", "de boa"],
        "exclamations": ["Bah!", "Nossa!", "Eita!", "Caramba!", "Mas bah!"],
        "greetings": ["Fala pia", "E ai guri", "Opa", "Suave?"],
        "intensifiers": ["tri", "demais", "muito", "barbaridade de bom"],
        "fillers": ["pia", "guri", "ne", "tipo", "bah"],
        "insults": ["pia doido", "sem nocao", "folgado", "bah tu e besta"],
        "closers": ["e isso pia", "falou guri", "bora"],
        "culturalRefs": ["aqui no Parana", "Curitiba ta frio demais", "churrasco de domingo"],
        "typicalEmojis": ["\U0001f9c9", "\U0001f969", "\U0001f49a", "\U0001f602", "\U0001f44a"],
    },
    "RS": {
        "uf": "RS",
        "region": "Sul",
        "slang": ["bah", "tche", "guri", "guria", "tri", "barbaridade", "bagual", "capaz", "ba", "mas bah"],
        "exclamations": ["Bah!", "Barbaridade!", "Tche!", "Tri!", "Mas bah!", "Bah tche!"],
        "greetings": ["Bah tche", "E ai guri", "Fala guria", "Opa"],
        "intensifiers": ["tri", "tri legal", "barbaridade de bom", "bah demais"],
        "fillers": ["tche", "bah", "guri", "guria", "ne"],
        "insults": ["bah tu e doido tche", "sem vergonha", "barbaridade de ruim", "guri sem nocao"],
        "closers": ["e isso tche", "falou guri", "bora guria", "capaz"],
        "culturalRefs": ["melhor que churrasco de domingo", "chimarrao", "aqui no sul a gente resolve", "gaucho e brabo"],
        "typicalEmojis": ["\U0001f9c9", "\U0001f969", "\U0001f49a", "\U0001f60e", "\U0001f44a", "\U0001f534"],
    },
    "SC": {
        "uf": "SC",
        "region": "Sul",
        "slang": ["bah", "guri", "guria", "pia", "tri", "tche", "de boa"],
        "exclamations": ["Bah!", "Nossa!", "Eita!", "Caramba!"],
        "greetings": ["Fala guri", "E ai pia", "Opa", "Suave?"],
        "intensifiers": ["tri", "demais", "muito", "massa"],
        "fillers": ["guri", "pia", "ne", "tipo", "bah"],
        "insults": ["sem nocao", "folgado", "bah tu e besta", "guri doido"],
        "closers": ["e isso guri", "falou", "bora"],
        "culturalRefs": ["aqui em Santa Catarina", "Floripa e tri", "Oktoberfest de Blumenau", "frio de lascar"],
        "typicalEmojis": ["\U0001f9c9", "\U0001f969", "\U0001f3d6\ufe0f", "\U0001f602", "\U0001f4aa"],
    },
}

# -- Internet Brazilianisms (universal) -------------------------------------

INTERNET_BR: dict = {
    # Abreviacoes comuns -> texto expandido (usamos ao contrario: expandido -> abreviado)
    "abbreviations": {
        "voce": "vc",
        "tambem": "tb",
        "porque": "pq",
        "por que": "pq",
        "comigo": "cmg",
        "o que": "oq",
        "que": "q",
        "nao": "n",
        "muito": "mt",
        "mesmo": "msm",
        "ninguem": "ngm",
        "nada": "nd",
        "tudo": "td",
        "beleza": "blz",
        "falou": "flw",
        "valeu": "vlw",
        "para": "pra",
        "estou": "to",
        "estava": "tava",
        "esta": "ta",
        "verdade": "vdd",
        "mano": "mn",
        "por favor": "pfv",
        "obrigado": "obg",
        "obrigada": "obg",
        "depois": "dps",
        "quando": "qnd",
        "quem": "qm",
        "certeza": "ctz",
        "saudades": "sdds",
        "demais": "dms",
        "alguma coisa": "alguma csa",
        "qualquer": "qlqr",
        "ainda": "inda",
        "agora": "agr",
        "aqui": "aki",
        "ai": "ai",
        "acho": "axo",
        "estao": "tao",
        "entao": "entao",
        "sim": "ss",
        "realmente": "rlmente",
        "problema": "prob",
        "governo": "gov",
        "pessoa": "pss",
        "pessoas": "pssoas",
        "Brasil": "BR",
        "brasileiro": "br",
        "situacao": "situacao",
        "politico": "politico",
        "dinheiro": "din",
    },

    # Variacoes de risada
    "laughter": [
        "kkkk", "kkkkk", "kkkkkkk", "kkkkkkkkkk", "KKKKKKKK", "KKKKKKKKKKK",
        "rsrsrs", "rsrs", "hahaha", "hauahaua", "ksksksk", "ashuahsuah",
        "kkkkk morri", "kkkk to passada",
    ],

    # Palavras de reacao
    "reactions": [
        "pse", "foda", "tenso", "mds", "vish", "eita", "caraca", "puts",
        "slk", "plmds", "socorro", "mds do ceu", "ai gente", "namoral",
    ],

    # Padroes de pontuacao excessiva
    "punctuationPatterns": ["???", "!!!", "...", "?!?!", "!!!!!", "????", "?!", "..........."],
}

# -- Education Modifiers ----------------------------------------------------

EDUCATION_MODIFIERS: dict[str, EducationModifier] = {
    "Fundamental": {
        "spellingAccuracy": 0.4,
        "vocabularyTier": "basic",
        "punctuationUsage": "none",
        "commonErrors": [
            ("mais", "mas"),
            ("agente", "a gente"),
            ("concerteza", "com certeza"),
            ("derrepente", "de repente"),
            ("mim fazer", "eu fazer"),
            ("mim ir", "eu ir"),
            ("nois", "nos"),
            ("nois vai", "nos vamos"),
            ("ele foi e falo", "ele foi e falou"),
            ("porisso", "por isso"),
            ("aonde", "onde"),
            ("perca", "perda"),
            ("tiver", "estiver"),
            ("menas", "menos"),
            ("poblema", "problema"),
            ("cunzinha", "cozinha"),
            ("percisa", "precisa"),
            ("indiota", "idiota"),
            ("nao", "nao"),
            ("tambem", "tambem"),
            ("voce", "voce"),
            ("eh", "e"),
            ("ta", "esta"),
            ("to", "estou"),
            ("pro", "para o"),
            ("num", "nao"),
        ],
    },
    "Medio": {
        "spellingAccuracy": 0.65,
        "vocabularyTier": "basic",
        "punctuationUsage": "minimal",
        "commonErrors": [
            ("mais", "mas"),
            ("agente", "a gente"),
            ("concerteza", "com certeza"),
            ("mim fazer", "eu fazer"),
            ("nao", "nao"),
            ("tambem", "tambem"),
            ("voce", "voce"),
            ("poblema", "problema"),
            ("ta", "esta"),
        ],
    },
    "Superior Incompleto": {
        "spellingAccuracy": 0.8,
        "vocabularyTier": "intermediate",
        "punctuationUsage": "standard",
        "commonErrors": [
            ("mais", "mas"),
            ("nao", "nao"),
            ("voce", "voce"),
        ],
    },
    "Superior Completo": {
        "spellingAccuracy": 0.92,
        "vocabularyTier": "advanced",
        "punctuationUsage": "standard",
        "commonErrors": [],
    },
    "Pos-Graduacao/MBA": {
        "spellingAccuracy": 0.95,
        "vocabularyTier": "advanced",
        "punctuationUsage": "meticulous",
        "commonErrors": [],
    },
    "Mestrado/Doutorado": {
        "spellingAccuracy": 0.98,
        "vocabularyTier": "advanced",
        "punctuationUsage": "meticulous",
        "commonErrors": [],
    },
}

# -- Generation Modifiers ---------------------------------------------------

GENERATION_MODIFIERS: dict[str, GenerationModifier] = {
    "Gen Z": {
        "abbreviationRate": 0.75,
        "emojiDensity": 0.7,
        "capsRate": 0.3,
        "sentenceLength": "very_short",
        "laughterRate": 0.5,
        "extraAbbreviations": ["mn", "slk", "pfv", "pprt", "sdds", "pdc", "mlk", "plmds", "mds", "nd", "ngm"],
        "memeExpressions": [
            "to passada", "lacrou", "surtei", "cancelado", "vibes", "red flag",
            "brisa", "cringe", "based", "real", "ain gente", "socorro", "gente",
        ],
    },
    "Millennial": {
        "abbreviationRate": 0.5,
        "emojiDensity": 0.35,
        "capsRate": 0.15,
        "sentenceLength": "short",
        "laughterRate": 0.35,
        "extraAbbreviations": ["vc", "tb", "pq", "blz", "vlw", "flw"],
        "memeExpressions": ["sqn", "partiu", "senta la", "chateado", "nem", "haha"],
    },
    "Gen X": {
        "abbreviationRate": 0.2,
        "emojiDensity": 0.15,
        "capsRate": 0.1,
        "sentenceLength": "medium",
        "laughterRate": 0.15,
        "extraAbbreviations": ["vc", "tb"],
        "memeExpressions": [],
    },
    "Boomer": {
        "abbreviationRate": 0.05,
        "emojiDensity": 0.1,
        "capsRate": 0.45,
        "sentenceLength": "long",
        "laughterRate": 0.05,
        "extraAbbreviations": [],
        "memeExpressions": [],
    },
}

# -- Class Modifiers --------------------------------------------------------

CLASS_MODIFIERS: dict[str, ClassModifier] = {
    "A": {
        "formalityLevel": 0.7,
        "complainAbout": ["impostos absurdos", "burocracia", "seguranca", "esse governo"],
        "aspirational": False,
    },
    "B1": {
        "formalityLevel": 0.6,
        "complainAbout": ["custo de vida", "qualidade dos servicos", "impostos", "educacao"],
        "aspirational": True,
    },
    "B2": {
        "formalityLevel": 0.5,
        "complainAbout": ["preco das coisas", "falta de oportunidade", "saude publica"],
        "aspirational": True,
    },
    "C1": {
        "formalityLevel": 0.4,
        "complainAbout": ["salario", "transporte", "saude publica", "preco do mercado"],
        "aspirational": True,
    },
    "C2": {
        "formalityLevel": 0.3,
        "complainAbout": ["emprego", "preco da comida", "violencia", "falta de tudo"],
        "aspirational": False,
    },
    "D": {
        "formalityLevel": 0.2,
        "complainAbout": ["fome", "emprego", "moradia", "violencia", "abandono"],
        "aspirational": False,
    },
    "E": {
        "formalityLevel": 0.15,
        "complainAbout": ["sobrevivencia", "fome", "abandono do estado", "violencia"],
        "aspirational": False,
    },
}

# -- Area Type Modifiers ----------------------------------------------------

AREA_MODIFIERS: dict[str, AreaModifier] = {
    "Capital/Metropole": {
        "regionalBoost": -0.1,
        "religiousRate": 0.2,
        "formalityShift": 0.1,
    },
    "Urbana/Interior": {
        "regionalBoost": 0.15,
        "religiousRate": 0.35,
        "formalityShift": -0.05,
    },
    "Rural": {
        "regionalBoost": 0.3,
        "religiousRate": 0.5,
        "formalityShift": -0.15,
    },
    "Litoral": {
        "regionalBoost": 0.05,
        "religiousRate": 0.2,
        "formalityShift": 0,
    },
}

# -- Emojis by sentiment and context ----------------------------------------

SENTIMENT_EMOJIS: dict[str, list[str]] = {
    "positive": ["\U0001f44d", "\U0001f44f", "\U0001f4aa", "\u2705", "\U0001f525", "\u2764\ufe0f", "\U0001f64c", "\U0001f4af", "\U0001f44a", "\U0001f3af"],
    "negative": ["\U0001f44e", "\U0001f621", "\U0001f92c", "\U0001f480", "\U0001f926", "\U0001f624", "\U0001f644", "\U0001f612", "\u26a0\ufe0f", "\U0001f6ab"],
    "neutral": ["\U0001f914", "\U0001f937", "\U0001f610", "\U0001f4ad", "\U0001f4ca", "\u2696\ufe0f", "\U0001f440", "\U0001f4ac"],
    "religious": ["\U0001f64f", "\u271d\ufe0f", "\u26ea", "\U0001f54a\ufe0f", "\U0001f4d6"],
}


# -- Helper functions -------------------------------------------------------

def get_state_profile(uf: str) -> StateProfile:
    """Get state profile or fallback to SP (generic)."""
    return STATE_PROFILES.get(uf, STATE_PROFILES["SP"])


def get_region_from_uf(uf: str) -> str:
    """Get region name from UF code or fallback to 'Sudeste'."""
    profile = STATE_PROFILES.get(uf)
    if profile:
        return profile["region"]
    return "Sudeste"
