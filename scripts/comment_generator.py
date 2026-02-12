"""
Comment Generator Engine (Python Port)
=======================================
Combines three TypeScript modules into a single Python file:
  1. comment-templates.ts   -> COMMENT_TEMPLATES, INTENSITY_WEIGHTS
  2. persona-writing-style.ts -> compute_writing_style()
  3. comment-generator.ts   -> generate_comment() (main export)

Pipeline:
  1. select_template     -- choose template by archetype/sentiment/topic/intensity
  2. fill_slots          -- inject regional expressions into slots
  3. add_reaction        -- prepend reaction words
  4. add_religious_expr  -- append/prepend religious expressions
  5. apply_spelling_errors -- introduce spelling errors (education)
  6. apply_abbreviations -- apply internet abbreviations (generation)
  7. apply_caps_pattern  -- apply caps style (generation)
  8. add_laughter        -- add laughter (kkkk, rsrs)
  9. add_emojis          -- add emojis by sentiment/generation
  10. add_punctuation     -- adjust punctuation excess

Dependencies:
  - brazilian_linguistics (companion module in same directory)
"""

from __future__ import annotations

import random
import re
from typing import Any, Literal

from brazilian_linguistics import (
    AREA_MODIFIERS,
    CLASS_MODIFIERS,
    EDUCATION_MODIFIERS,
    GENERATION_MODIFIERS,
    INTERNET_BR,
    SENTIMENT_EMOJIS,
    get_state_profile,
)

# ── Type Aliases ──────────────────────────────────────────────────────────────

Intensity = Literal["mild", "moderate", "strong", "extreme"]
Sentiment = Literal["positive", "negative", "neutral"]

# A single template entry
CommentTemplate = dict  # {"base": str, "intensity": Intensity}

# Persona dict expected keys:
#   region, state, generation, education_level, social_class,
#   political_leaning, religion, age, gender, area_type,
#   archetype_id, name

WritingStyle = dict  # keys described in compute_writing_style()


###############################################################################
# A) COMMENT TEMPLATES DATABASE
###############################################################################

# ── Traditionalist (Conservador & Religioso) ─────────────────────────────────

_traditionalist = {
    "positive": {
        "crime": [
            # mild (40%)
            {"base": "concordo, a gente precisa de mais segurança e respeito às leis", "intensity": "mild"},
            {"base": "é isso aí, tem que ter consequência pra quem desrespeita a lei", "intensity": "mild"},
            {"base": "apoio sim, família brasileira precisa de proteção", "intensity": "mild"},
            {"base": "com certeza, chega de impunidade nesse país", "intensity": "mild"},
            # moderate (30%)
            {"base": "{opener} concordo!! bandido tem que pagar pelo que faz sim, chega de passar a mão na cabeça", "intensity": "moderate"},
            {"base": "tá certíssimo {filler} tolerância zero com vagabundo!! a lei existe pra ser cumprida", "intensity": "moderate"},
            {"base": "{opener} finalmente alguém com coragem de falar!! chega de defender bandido", "intensity": "moderate"},
            # strong (20%)
            {"base": "{opener} bandido bom é bandido preso!! ou melhor {intensifier}!! chega de passar pano pra marginal", "intensity": "strong"},
            {"base": "tinha q ser tudo na cadeia sem direito a nada {filler} esse país só melhora quando parar de ter dó de vagabundo", "intensity": "strong"},
            # extreme (10%)
            {"base": "{opener} bandido bom é bandido morto!! acabou!! quem defende bandido é tão ruim quanto!! {closer}", "intensity": "extreme"},
        ],
        "social": [
            {"base": "concordo com a iniciativa, desde que respeite os valores da família", "intensity": "mild"},
            {"base": "apoio, mas tem que ter equilíbrio com os bons costumes", "intensity": "mild"},
            {"base": "{opener} tá certo!! tem que preservar nossos valores e nossa cultura", "intensity": "moderate"},
            {"base": "isso mesmo {filler} a moral e a família vêm primeiro, sempre", "intensity": "moderate"},
            {"base": "{opener} a base é a família tradicional e ponto final!! quem não gosta problema de quem não gosta", "intensity": "strong"},
        ],
        "economy": [
            {"base": "faz sentido, tem que ter responsabilidade com o dinheiro público", "intensity": "mild"},
            {"base": "concordo, menos impostos e mais trabalho é o caminho", "intensity": "mild"},
            {"base": "{opener} certíssimo!! quem trabalha tem que ser valorizado, não quem fica parado esperando esmola", "intensity": "moderate"},
            {"base": "apoio total {filler} o Brasil precisa de gente que trabalha não de vagabundo mamando no governo", "intensity": "moderate"},
            {"base": "{opener} enquanto esse povo ficar querendo tudo de graça esse país não vai pra frente nunca {closer}", "intensity": "strong"},
        ],
        "politics": [
            {"base": "concordo, precisamos de mais ordem e responsabilidade na política", "intensity": "mild"},
            {"base": "é verdade, político tem que trabalhar pelo povo, não pelo próprio bolso", "intensity": "mild"},
            {"base": "{opener} tá na hora de limpar esse congresso!! só tem ladrão", "intensity": "moderate"},
            {"base": "{opener} político corrupto tinha q ser preso e perder tudo!! chega de roubar o povo {closer}", "intensity": "strong"},
            {"base": "esse país só vai mudar no dia que botar militar pra governar de novo {filler} democracia aqui não funciona", "intensity": "extreme"},
        ],
        "environment": [
            {"base": "entendo a preocupação com o meio ambiente, mas não pode prejudicar quem trabalha", "intensity": "mild"},
            {"base": "{opener} o agro sustenta esse país!! tem que ter equilíbrio", "intensity": "moderate"},
        ],
        "general": [
            {"base": "concordo plenamente, é questão de bom senso", "intensity": "mild"},
            {"base": "é isso aí {filler} a maioria silenciosa concorda", "intensity": "mild"},
            {"base": "{opener} finalmente alguém falando o óbvio!! era hora", "intensity": "moderate"},
            {"base": "como cidadão de bem eu apoio sim {closer}", "intensity": "moderate"},
            {"base": "{opener} isso q é falar a verdade!! o povo de bem tá cansado de ficar calado {closer}", "intensity": "strong"},
        ],
    },
    "negative": {
        "crime": [
            {"base": "discordo, acho que não é por aí que vamos resolver", "intensity": "mild"},
            {"base": "não concordo {filler} tem que ter punição sim mas com humanidade", "intensity": "moderate"},
            {"base": "{opener} isso vai contra tudo que a gente acredita como cristão {closer}", "intensity": "moderate"},
        ],
        "social": [
            {"base": "não concordo, acho que isso vai contra nossos valores tradicionais", "intensity": "mild"},
            {"base": "{opener} isso é exatamente o que tá destruindo a sociedade!! vai contra a natureza", "intensity": "moderate"},
            {"base": "{opener} DEUS fez homem e mulher!! ponto final!! essa ideologia de gênero é do demônio", "intensity": "strong"},
            {"base": "isso é coisa do diabo {filler} na minha época ninguém precisava disso e todo mundo era normal", "intensity": "strong"},
            {"base": "{opener} essa agenda LGBT quer destruir a família!! quem apoia isso tá perdido!! DEUS VAI COBRAR {closer}", "intensity": "extreme"},
            {"base": "querem enfiar goela abaixo essa palhaçada {filler} homem é homem mulher é mulher e acabou!! ngm me cala {closer}", "intensity": "extreme"},
        ],
        "economy": [
            {"base": "discordo, isso não resolve o problema real da economia", "intensity": "mild"},
            {"base": "{opener} mais gasto público é a última coisa que esse país precisa", "intensity": "moderate"},
        ],
        "politics": [
            {"base": "discordo totalmente, isso é mais uma jogada política pra enganar o povo", "intensity": "mild"},
            {"base": "{opener} esse governo tá destruindo o Brasil!! vergonha nacional {closer}", "intensity": "moderate"},
            {"base": "{opener} FORA!! tira esses comunistas do poder!! tão acabando com o país {closer}", "intensity": "strong"},
        ],
        "environment": [
            {"base": "discordo {filler} isso aí é agenda globalista pra prejudicar o Brasil", "intensity": "moderate"},
            {"base": "{opener} esse negócio de ambientalismo é tudo mentira pra frear o progresso do Brasil {closer}", "intensity": "strong"},
        ],
        "general": [
            {"base": "discordo {filler} isso vai contra nossos valores mais fundamentais", "intensity": "mild"},
            {"base": "{opener} isso é exatamente o que tá destruindo a base da nossa sociedade", "intensity": "moderate"},
            {"base": "absurdo!! quem propõe isso não tem família pra proteger {closer}", "intensity": "strong"},
            {"base": "completamente contra!! precisamos voltar aos nossos princípios cristãos antes que seja tarde demais", "intensity": "moderate"},
        ],
    },
    "neutral": {
        "crime": [
            {"base": "entendo o ponto mas acho que precisa analisar melhor antes de decidir", "intensity": "mild"},
            {"base": "é complexo {filler} tem que ouvir os dois lados", "intensity": "mild"},
        ],
        "social": [
            {"base": "não tenho certeza sobre isso {filler} é um tema difícil", "intensity": "mild"},
            {"base": "preciso pensar mais sobre isso, não é tão simples", "intensity": "mild"},
        ],
        "economy": [
            {"base": "tem argumentos dos dois lados {filler} difícil dizer quem tá certo", "intensity": "mild"},
        ],
        "politics": [
            {"base": "acho que os dois lados têm razão em parte {filler} política é complicado", "intensity": "mild"},
        ],
        "environment": [
            {"base": "entendo os dois lados {filler} não é simples", "intensity": "mild"},
        ],
        "general": [
            {"base": "não tenho uma opinião formada sobre isso ainda, é complexo", "intensity": "mild"},
            {"base": "é uma questão que merece mais debate {filler} não dá pra simplificar", "intensity": "mild"},
            {"base": "preciso ouvir mais argumentos antes de me posicionar", "intensity": "mild"},
        ],
    },
}

# ── Activist (Engajado Social / Justiça & Direitos) ─────────────────────────

_activist = {
    "positive": {
        "crime": [
            {"base": "concordo mas lembrando que o sistema carcerário precisa de reforma urgente", "intensity": "mild"},
            {"base": "apoio desde que não criminalize a pobreza como sempre fazem nesse país", "intensity": "mild"},
            {"base": "{opener} tem que atacar as causas!! pobreza e desigualdade são a raiz da violência", "intensity": "moderate"},
        ],
        "social": [
            {"base": "sim!! isso é um passo importante pra justiça social", "intensity": "mild"},
            {"base": "concordo {filler} precisamos pensar nas pessoas mais vulneráveis sempre", "intensity": "mild"},
            {"base": "apoio total!! igualdade e dignidade pra todos sem exceção", "intensity": "mild"},
            {"base": "{opener} finalmente uma discussão séria sobre direitos!! era hora desse país acordar", "intensity": "moderate"},
            {"base": "isso é sobre direitos humanos {filler} não existe meio termo quando se trata de dignidade", "intensity": "moderate"},
            {"base": "{opener} REPRESENTATIVIDADE IMPORTA SIM!! quem discorda tá do lado errado da história {closer}", "intensity": "strong"},
            {"base": "quem é contra isso é pq nunca sofreu preconceito na pele {filler} fácil falar quando vc é privilegiado", "intensity": "strong"},
        ],
        "economy": [
            {"base": "concordo mas tem que garantir que os mais pobres não paguem a conta como sempre", "intensity": "mild"},
            {"base": "{opener} o problema é que sempre quem paga é o trabalhador!! rico nunca perde nada nesse país", "intensity": "moderate"},
            {"base": "enquanto bilionário pagar menos imposto que trabalhador esse país não muda {closer}", "intensity": "strong"},
        ],
        "politics": [
            {"base": "apoio, mas com participação popular real, não democracia de fachada", "intensity": "mild"},
            {"base": "{opener} o povo precisa ter voz!! chega de elite decidindo tudo por nós", "intensity": "moderate"},
        ],
        "environment": [
            {"base": "concordo totalmente!! o meio ambiente é prioridade urgente", "intensity": "mild"},
            {"base": "{opener} a Amazônia é patrimônio de todos!! temos que proteger com unhas e dentes", "intensity": "moderate"},
            {"base": "{opener} capitalismo tá destruindo o planeta!! se não mudar agora não vai ter futuro pra ninguém {closer}", "intensity": "strong"},
        ],
        "general": [
            {"base": "apoio!! é sobre empatia e respeito ao próximo", "intensity": "mild"},
            {"base": "{opener} finalmente!! era hora de alguém levantar essa discussão", "intensity": "moderate"},
            {"base": "quem é contra isso não entende o que é viver à margem da sociedade", "intensity": "moderate"},
        ],
    },
    "negative": {
        "crime": [
            {"base": "discordo {filler} a solução não é punir mais, é investir em educação e oportunidade", "intensity": "mild"},
            {"base": "{opener} isso só reforça a desigualdade!! pobre vai preso e rico paga fiança e vai pra casa", "intensity": "moderate"},
            {"base": "mais uma vez querem criminalizar a pobreza {filler} vergonhoso esse pensamento punitivista", "intensity": "moderate"},
            {"base": "{opener} ISSO É GENOCÍDIO DA POPULAÇÃO NEGRA!! sistema prisional é continuação da escravidão {closer}", "intensity": "strong"},
            {"base": "povo fascista querendo prender pobre e preto enquanto político corrupto tá solto!! hipócritas {closer}", "intensity": "extreme"},
        ],
        "social": [
            {"base": "discordo, acho que precisamos ser mais inclusivos não menos", "intensity": "mild"},
            {"base": "{opener} que retrocesso!! isso é coisa de gente que nunca sofreu discriminação", "intensity": "moderate"},
            {"base": "{opener} isso é fascismo puro!! querem nos calar mas não vão conseguir {closer}", "intensity": "strong"},
        ],
        "economy": [
            {"base": "discordo {filler} isso só beneficia quem já é rico", "intensity": "mild"},
            {"base": "{opener} mais uma medida pra ferrar o pobre e enriquecer elite!! sempre a mesma história", "intensity": "moderate"},
            {"base": "{opener} enquanto povo passa fome bilionário tá comprando iate!! esse sistema é podre {closer}", "intensity": "strong"},
        ],
        "politics": [
            {"base": "discordo totalmente, é mais um ataque à democracia", "intensity": "mild"},
            {"base": "{opener} isso é golpe!! querem destruir a democracia que o povo conquistou com sangue", "intensity": "strong"},
        ],
        "environment": [
            {"base": "discordo {filler} não dá pra desenvolver destruindo o meio ambiente", "intensity": "mild"},
            {"base": "{opener} estão destruindo a Amazônia pelo lucro!! genocídio ambiental {closer}", "intensity": "strong"},
        ],
        "general": [
            {"base": "discordo, isso reflete um pensamento retrógrado que não ajuda ninguém", "intensity": "mild"},
            {"base": "{opener} completamente contra!! precisamos de empatia não de punição cega", "intensity": "moderate"},
            {"base": "isso é mais uma forma de opressão contra os mais vulneráveis {closer}", "intensity": "moderate"},
            {"base": "{opener} precisamos atacar as causas não os sintomas!! isso é retrocesso puro", "intensity": "strong"},
        ],
    },
    "neutral": {
        "crime": [
            {"base": "o tema é complexo {filler} tem que olhar as causas estruturais antes de decidir", "intensity": "mild"},
        ],
        "social": [
            {"base": "é importante ouvir todos os lados, especialmente os mais afetados", "intensity": "mild"},
            {"base": "o tema merece uma análise mais profunda das causas estruturais", "intensity": "mild"},
        ],
        "economy": [
            {"base": "precisa ver quem realmente se beneficia e quem paga a conta", "intensity": "mild"},
        ],
        "politics": [
            {"base": "é uma questão que precisa de mais diálogo e participação popular", "intensity": "mild"},
        ],
        "environment": [
            {"base": "concordo que precisa discutir mas ouvindo as comunidades tradicionais", "intensity": "mild"},
        ],
        "general": [
            {"base": "preciso entender melhor os impactos sociais antes de opinar", "intensity": "mild"},
            {"base": "não é tão simples quanto parece {filler} a questão é sistêmica", "intensity": "mild"},
            {"base": "precisamos de mais dados e pesquisas sociais antes de decidir", "intensity": "mild"},
        ],
    },
}

# ── Analyst (Analítico Racional / Dados & Evidências) ────────────────────────

_analyst = {
    "positive": {
        "crime": [
            {"base": "as evidências mostram que essa abordagem tem eficácia comprovada em outros países", "intensity": "mild"},
            {"base": "analisando os dados disponíveis a proposta faz sentido do ponto de vista técnico", "intensity": "mild"},
            {"base": "estatisticamente é uma tendência positiva {filler} os indicadores sustentam essa posição", "intensity": "moderate"},
        ],
        "social": [
            {"base": "os estudos mostram impacto positivo em sociedades que adotaram medidas similares", "intensity": "mild"},
            {"base": "do ponto de vista dos dados as evidências são favoráveis", "intensity": "mild"},
        ],
        "economy": [
            {"base": "os indicadores econômicos apontam na mesma direção, concordo com a análise", "intensity": "mild"},
            {"base": "olhando PIB e indicadores sociais a tendência é clara {filler} faz sentido", "intensity": "moderate"},
            {"base": "do ponto de vista macroeconômico os números sustentam essa posição", "intensity": "mild"},
        ],
        "politics": [
            {"base": "a ciência política mostra que reformas nessa linha tendem a funcionar", "intensity": "mild"},
            {"base": "comparando com outros sistemas políticos a evidência aponta nessa direção", "intensity": "mild"},
        ],
        "environment": [
            {"base": "os relatórios do IPCC são claros sobre a urgência dessa questão", "intensity": "mild"},
            {"base": "as métricas ambientais confirmam a necessidade dessa abordagem", "intensity": "mild"},
        ],
        "general": [
            {"base": "os dados sugerem que essa abordagem pode ser efetiva segundo estudos recentes", "intensity": "mild"},
            {"base": "analisando as evidências disponíveis concordo com essa perspectiva", "intensity": "mild"},
            {"base": "do ponto de vista técnico os indicadores corroboram essa análise", "intensity": "mild"},
            {"base": "estatisticamente faz sentido {filler} os números apoiam essa posição", "intensity": "moderate"},
        ],
    },
    "negative": {
        "crime": [
            {"base": "os dados de países que tentaram isso mostram que não funciona a longo prazo", "intensity": "mild"},
            {"base": "as evidências empíricas não sustentam essa conclusão {filler} os dados dizem o contrário", "intensity": "moderate"},
            {"base": "estudos comparativos mostram que essa medida não produz os resultados esperados", "intensity": "moderate"},
        ],
        "social": [
            {"base": "do ponto de vista sociológico os dados mostram que o caminho é outro", "intensity": "mild"},
            {"base": "as pesquisas não sustentam esse argumento {filler} é falácia estatística", "intensity": "moderate"},
        ],
        "economy": [
            {"base": "os indicadores econômicos não sustentam essa projeção otimista", "intensity": "mild"},
            {"base": "analisando a curva de Laffer e os dados tributários essa proposta é ineficiente", "intensity": "moderate"},
        ],
        "politics": [
            {"base": "a experiência histórica mostra que esse tipo de medida gera efeitos colaterais piores", "intensity": "mild"},
        ],
        "environment": [
            {"base": "os dados ambientais contradizem essa abordagem {filler} insustentável", "intensity": "moderate"},
        ],
        "general": [
            {"base": "discordo {filler} a correlação não implica causalidade e o raciocínio está errado", "intensity": "mild"},
            {"base": "do ponto de vista lógico há falhas sérias nessa argumentação", "intensity": "moderate"},
            {"base": "analisando os dados disponíveis essa abordagem se mostra ineficaz", "intensity": "mild"},
        ],
    },
    "neutral": {
        "crime": [
            {"base": "precisamos de mais dados antes de uma conclusão definitiva", "intensity": "mild"},
        ],
        "social": [
            {"base": "a questão é multifatorial e não admite respostas simplistas", "intensity": "mild"},
        ],
        "economy": [
            {"base": "os estudos são inconclusivos {filler} necessário aprofundar a análise", "intensity": "mild"},
        ],
        "politics": [
            {"base": "há argumentos válidos em ambos os lados {filler} difícil definir com os dados atuais", "intensity": "mild"},
        ],
        "environment": [
            {"base": "a metodologia importa {filler} sem rigor científico qualquer conclusão é prematura", "intensity": "mild"},
        ],
        "general": [
            {"base": "preciso ver mais dados e pesquisas antes de me posicionar", "intensity": "mild"},
            {"base": "a questão é multifatorial {filler} não admite respostas simplistas", "intensity": "mild"},
            {"base": "os estudos são inconclusivos, necessário aprofundar a análise com mais rigor", "intensity": "mild"},
            {"base": "sem um estudo metodologicamente sólido qualquer conclusão é prematura", "intensity": "mild"},
            {"base": "há argumentos válidos em ambos os lados {filler} difícil definir com os dados atuais", "intensity": "mild"},
        ],
    },
}

# ── Moderate (Equilíbrio & Consenso) ─────────────────────────────────────────

_moderate = {
    "positive": {
        "crime": [
            {"base": "acho uma posição razoável {filler} desde que com os devidos ajustes", "intensity": "mild"},
            {"base": "concordo em parte, o caminho do meio parece mais sensato", "intensity": "mild"},
            {"base": "com diálogo e equilíbrio acho que pode funcionar", "intensity": "mild"},
        ],
        "social": [
            {"base": "apoio com ressalvas {filler} precisamos ouvir todos os envolvidos", "intensity": "mild"},
            {"base": "concordo desde que não radicalize pra nenhum lado", "intensity": "mild"},
        ],
        "economy": [
            {"base": "faz sentido se implementado com equilíbrio e gradualidade", "intensity": "mild"},
            {"base": "concordo {filler} mas tem que pensar nos dois lados da moeda", "intensity": "mild"},
        ],
        "politics": [
            {"base": "apoio desde que seja construído com diálogo entre todas as partes", "intensity": "mild"},
        ],
        "environment": [
            {"base": "concordo {filler} mas precisa equilibrar preservação com desenvolvimento", "intensity": "mild"},
        ],
        "general": [
            {"base": "acho uma posição razoável desde que com os devidos ajustes e diálogo", "intensity": "mild"},
            {"base": "concordo em parte {filler} o caminho do meio parece mais sensato", "intensity": "mild"},
            {"base": "com diálogo e equilíbrio entre as partes acho que pode funcionar", "intensity": "mild"},
            {"base": "apoio com ressalvas {filler} tem que ouvir todo mundo antes", "intensity": "mild"},
        ],
    },
    "negative": {
        "crime": [
            {"base": "acho que essa posição é um pouco extrema {filler} precisamos de equilíbrio", "intensity": "mild"},
            {"base": "discordo da radicalidade {filler} o diálogo é sempre o melhor caminho", "intensity": "mild"},
        ],
        "social": [
            {"base": "entendo a intenção mas a forma tá errada {filler} muito radical", "intensity": "mild"},
            {"base": "{opener} qualquer extremo é ruim {filler} tanto pra um lado quanto pro outro", "intensity": "moderate"},
        ],
        "economy": [
            {"base": "discordo {filler} parece uma solução muito radical sem pensar nas consequências", "intensity": "mild"},
        ],
        "politics": [
            {"base": "não consigo apoiar algo tão polarizado {filler} precisamos de moderação", "intensity": "mild"},
        ],
        "environment": [
            {"base": "discordo da abordagem {filler} tem que achar o equilíbrio", "intensity": "mild"},
        ],
        "general": [
            {"base": "acho que essa posição é um pouco extrema {filler} precisamos de equilíbrio", "intensity": "mild"},
            {"base": "discordo da radicalidade {filler} o diálogo é sempre melhor caminho", "intensity": "mild"},
            {"base": "não consigo apoiar algo tão polarizado {filler} precisamos de moderação", "intensity": "mild"},
            {"base": "entendo a intenção mas a forma tá errada {filler} excessivamente radical", "intensity": "moderate"},
        ],
    },
    "neutral": {
        "crime": [
            {"base": "vejo pontos válidos nos dois lados {filler} muito difícil escolher", "intensity": "mild"},
        ],
        "social": [
            {"base": "acho que a resposta tá no meio termo como sempre", "intensity": "mild"},
            {"base": "sei la {filler} acho q tem argumento dos dois lados ne", "intensity": "mild"},
        ],
        "economy": [
            {"base": "preciso pensar mais {filler} tem prós e contras", "intensity": "mild"},
        ],
        "politics": [
            {"base": "a polarização não ajuda ninguém {filler} vamos buscar diálogo construtivo", "intensity": "mild"},
        ],
        "environment": [
            {"base": "é uma questão que pede ponderação não posições radicais", "intensity": "mild"},
        ],
        "general": [
            {"base": "vejo pontos válidos nos dois lados {filler} muito difícil escolher", "intensity": "mild"},
            {"base": "sei la {filler} acho que tem argumento dos dois lados ne", "intensity": "mild"},
            {"base": "acho que a resposta tá no meio termo como sempre", "intensity": "mild"},
            {"base": "a polarização não ajuda ninguém {filler} vamos buscar diálogo", "intensity": "mild"},
            {"base": "é uma questão que pede ponderação e não posições radicais", "intensity": "mild"},
        ],
    },
}

# ── Entrepreneur (Empreendedor / Pragmático & Econômico) ─────────────────────

_entrepreneur = {
    "positive": {
        "crime": [
            {"base": "concordo {filler} segurança jurídica é fundamental pra qualquer negócio funcionar", "intensity": "mild"},
            {"base": "apoio, o empresário precisa de segurança pra investir nesse país", "intensity": "mild"},
            {"base": "{opener} sem segurança não tem investimento!! isso é básico pra economia funcionar", "intensity": "moderate"},
        ],
        "social": [
            {"base": "do ponto de vista de mercado diversidade traz resultados comprovados", "intensity": "mild"},
            {"base": "concordo {filler} inclusão é bom pra economia também", "intensity": "mild"},
        ],
        "economy": [
            {"base": "faz total sentido do ponto de vista prático e econômico", "intensity": "mild"},
            {"base": "concordo {filler} isso pode trazer resultados positivos e mensuráveis", "intensity": "mild"},
            {"base": "{opener} o mercado já mostra que essa direção é a mais eficiente", "intensity": "moderate"},
            {"base": "quem entende de gestão sabe que essa é a abordagem correta {closer}", "intensity": "moderate"},
            {"base": "{opener} menos burocracia e mais liberdade econômica!! é isso que o Brasil precisa {closer}", "intensity": "strong"},
        ],
        "politics": [
            {"base": "apoio se realmente reduzir a burocracia e facilitar a vida do empreendedor", "intensity": "mild"},
            {"base": "{opener} reforma tributária já!! não dá mais pra trabalhar nesse país com tanta burocracia", "intensity": "moderate"},
        ],
        "environment": [
            {"base": "concordo desde que não inviabilize o agronegócio que sustenta o país", "intensity": "mild"},
        ],
        "general": [
            {"base": "faz sentido do ponto de vista prático e econômico", "intensity": "mild"},
            {"base": "concordo {filler} precisamos de soluções práticas não de mais ideologia", "intensity": "mild"},
            {"base": "{opener} isso tem potencial de resultado real!! apoio", "intensity": "moderate"},
            {"base": "{opener} quem trabalha e empreende sabe que esse é o caminho {closer}", "intensity": "moderate"},
        ],
    },
    "negative": {
        "crime": [
            {"base": "discordo {filler} isso não resolve a insegurança que o empresário vive todo dia", "intensity": "mild"},
        ],
        "social": [
            {"base": "discordo {filler} o foco tem que ser geração de emprego e renda não ideologia", "intensity": "moderate"},
            {"base": "{opener} enquanto ficam discutindo essas bobagens o país tá perdendo competitividade {closer}", "intensity": "strong"},
        ],
        "economy": [
            {"base": "não vejo viabilidade econômica nessa proposta {filler} os custos são altos demais", "intensity": "mild"},
            {"base": "discordo {filler} o custo-benefício simplesmente não justifica", "intensity": "mild"},
            {"base": "{opener} inviável!! quem propõe isso nunca administrou nada na vida {closer}", "intensity": "strong"},
            {"base": "{opener} mais imposto pra sustentar vagabundo?? enquanto empresário se mata de trabalhar?? revoltante {closer}", "intensity": "extreme"},
        ],
        "politics": [
            {"base": "discordo {filler} mais regulação é o que menos precisamos agora", "intensity": "mild"},
            {"base": "{opener} mais burocracia pra atrapalhar quem trabalha?? esse país não tem jeito enquanto político só pensar em roubar {closer}", "intensity": "strong"},
        ],
        "environment": [
            {"base": "discordo {filler} não pode travar o desenvolvimento do país por ambientalismo radical", "intensity": "moderate"},
        ],
        "general": [
            {"base": "não vejo viabilidade prática nisso {filler} bonito no papel mas não funciona", "intensity": "mild"},
            {"base": "discordo {filler} o custo-benefício não justifica de jeito nenhum", "intensity": "mild"},
            {"base": "isso vai na contramão do crescimento e da eficiência necessária {closer}", "intensity": "moderate"},
            {"base": "{opener} inviável!! quem propõe isso nunca trabalhou de verdade na vida", "intensity": "strong"},
        ],
    },
    "neutral": {
        "crime": [
            {"base": "preciso ver os impactos no ambiente de negócios antes de opinar", "intensity": "mild"},
        ],
        "social": [
            {"base": "depende do impacto econômico {filler} preciso ver os números", "intensity": "mild"},
        ],
        "economy": [
            {"base": "preciso ver os números concretos antes de me posicionar", "intensity": "mild"},
            {"base": "depende da implementação {filler} na teoria pode funcionar na prática...", "intensity": "mild"},
            {"base": "o impacto econômico precisa ser melhor avaliado com dados reais", "intensity": "mild"},
        ],
        "politics": [
            {"base": "sem um estudo de viabilidade sério não dá pra opinar", "intensity": "mild"},
        ],
        "environment": [
            {"base": "precisa de uma análise custo-benefício séria antes de decidir", "intensity": "mild"},
        ],
        "general": [
            {"base": "preciso ver os números concretos antes de me posicionar", "intensity": "mild"},
            {"base": "depende da implementação {filler} na teoria funciona na prática é outra coisa", "intensity": "mild"},
            {"base": "sem um estudo de viabilidade sério não dá pra opinar", "intensity": "mild"},
            {"base": "o impacto real precisa ser melhor avaliado com dados concretos", "intensity": "mild"},
        ],
    },
}

# ── Consolidated database ────────────────────────────────────────────────────

COMMENT_TEMPLATES: dict[str, dict[str, dict[str, list[CommentTemplate]]]] = {
    "traditionalist": _traditionalist,
    "activist": _activist,
    "analyst": _analyst,
    "moderate": _moderate,
    "entrepreneur": _entrepreneur,
}

TOPIC_KEYS = ("crime", "social", "economy", "politics", "environment", "general")

INTENSITY_WEIGHTS: dict[str, float] = {
    "mild": 0.40,
    "moderate": 0.30,
    "strong": 0.20,
    "extreme": 0.10,
}


###############################################################################
# B) WRITING STYLE CALCULATOR
###############################################################################

# ── Political leaning -> aggressiveness mapping ─────────────────────────────

POLITICAL_AGGRESSIVENESS: dict[str, float] = {
    "Extrema Esquerda": 0.6,
    "Esquerda": 0.35,
    "Centro-Esquerda": 0.2,
    "Centro": 0.1,
    "Centro-Liberal": 0.15,
    "Centro-Direita": 0.25,
    "Direita": 0.4,
    "Extrema Direita": 0.7,
    "Libertário": 0.3,
    "Apolítico": 0.1,
}

# ── Religion -> religious expression rate ────────────────────────────────────

RELIGION_EXPRESSION_RATE: dict[str, float] = {
    "Católico": 0.25,
    "Evangélico": 0.6,
    "Espírita": 0.15,
    "Matriz Africana": 0.2,
    "Judaísmo": 0.1,
    "Islamismo": 0.15,
    "Ateu": 0.0,
    "Espiritualidade Eclética": 0.1,
    "Outros": 0.05,
}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _vocab_to_number(tier: str) -> int:
    """Convert vocabulary tier string to numeric: basic=1, intermediate=2, advanced=3."""
    if tier == "basic":
        return 1
    if tier == "intermediate":
        return 2
    return 3


def _sentence_length_to_count(length: str) -> int:
    """Convert sentence length to sentence count: very_short/short=1, medium=2, long=3."""
    if length in ("very_short", "short"):
        return 1
    if length == "medium":
        return 2
    return 3


def compute_writing_style(persona: dict[str, Any]) -> WritingStyle:
    """
    Map demographic attributes of a persona to concrete writing-style
    parameters used by the comment generator.

    Returns a dict with keys:
        abbreviation_rate, spelling_error_rate, regional_rate,
        emoji_rate, caps_rate, aggressiveness_rate, laughter_rate,
        sentence_count (1|2|3), vocabulary_tier (1|2|3),
        formality_level, religious_rate
    """
    edu = EDUCATION_MODIFIERS.get(persona.get("education_level", ""), EDUCATION_MODIFIERS["Medio"])
    gen = GENERATION_MODIFIERS.get(persona.get("generation", ""), GENERATION_MODIFIERS["Millennial"])
    cls = CLASS_MODIFIERS.get(persona.get("social_class", ""), CLASS_MODIFIERS["C1"])
    area = AREA_MODIFIERS.get(persona.get("area_type", ""), AREA_MODIFIERS["Urbana/Interior"])

    # Abbreviation rate: driven by generation, slightly reduced by high education
    abbreviation_rate = _clamp(
        gen["abbreviationRate"]
        - (0.15 if edu["spellingAccuracy"] > 0.9 else 0)
        + (0.1 if cls["formalityLevel"] < 0.3 else 0),
        0, 1,
    )

    # Spelling error rate: inverse of accuracy, boosted for low-education rural
    spelling_error_rate = _clamp(
        (1 - edu["spellingAccuracy"]) + (0.05 if area["formalityShift"] < 0 else 0),
        0, 1,
    )

    # Regional expression rate: base from area, higher in interior/rural
    regional_rate = _clamp(
        0.4 + area["regionalBoost"] + (0.1 if cls["formalityLevel"] < 0.4 else -0.05),
        0.1, 0.9,
    )

    # Emoji rate: driven by generation
    age = persona.get("age", 30)
    emoji_rate = _clamp(
        gen["emojiDensity"] + (0.1 if age < 25 else (-0.1 if age > 50 else 0)),
        0, 1,
    )

    # Caps rate: Boomers and extreme political leanings use more caps
    political_leaning = persona.get("political_leaning", "")
    caps_rate = _clamp(
        gen["capsRate"] + POLITICAL_AGGRESSIVENESS.get(political_leaning, 0) * 0.15,
        0, 1,
    )

    # Aggressiveness: political extremism + low education + low class correlate
    aggressiveness_rate = _clamp(
        POLITICAL_AGGRESSIVENESS.get(political_leaning, 0.15)
        + (1 - edu["spellingAccuracy"]) * 0.15
        + (1 - cls["formalityLevel"]) * 0.1,
        0, 1,
    )

    # Laughter rate: generation-driven
    laughter_rate: float = gen["laughterRate"]

    # Sentence count: generation-driven
    sentence_count: int = _sentence_length_to_count(gen["sentenceLength"])

    # Vocabulary tier: education-driven
    vocabulary_tier: int = _vocab_to_number(edu["vocabularyTier"])

    # Formality: class + area + education
    formality_level = _clamp(
        cls["formalityLevel"] + area["formalityShift"] + (0.1 if edu["spellingAccuracy"] > 0.9 else -0.05),
        0, 1,
    )

    # Religious expression rate
    religion = persona.get("religion", "")
    religious_rate = _clamp(
        RELIGION_EXPRESSION_RATE.get(religion, 0.1) + area["religiousRate"] * 0.3,
        0, 1,
    )

    return {
        "abbreviation_rate": abbreviation_rate,
        "spelling_error_rate": spelling_error_rate,
        "regional_rate": regional_rate,
        "emoji_rate": emoji_rate,
        "caps_rate": caps_rate,
        "aggressiveness_rate": aggressiveness_rate,
        "laughter_rate": laughter_rate,
        "sentence_count": sentence_count,
        "vocabulary_tier": vocabulary_tier,
        "formality_level": formality_level,
        "religious_rate": religious_rate,
    }


###############################################################################
# C) COMMENT GENERATOR ENGINE
###############################################################################

# ── Helpers ──────────────────────────────────────────────────────────────────


def _pick_random(lst: list) -> Any:
    """Pick a random element from a non-empty list."""
    return lst[random.randint(0, len(lst) - 1)]


def _maybe(probability: float) -> bool:
    """Return True with the given probability."""
    return random.random() < probability


def _escape_regex(s: str) -> str:
    """Escape special regex characters in a string."""
    return re.escape(s)


def _pick_weighted_intensity() -> str:
    """Pick an intensity level using the weighted distribution."""
    rand = random.random()
    cumulative = 0.0
    for intensity, weight in INTENSITY_WEIGHTS.items():
        cumulative += weight
        if rand <= cumulative:
            return intensity
    return "mild"


# ── Step 1: Select Template ─────────────────────────────────────────────────


def _select_template(archetype_id: str, sentiment: str, topic: str) -> CommentTemplate:
    archetype = COMMENT_TEMPLATES.get(archetype_id)
    if not archetype:
        return {"base": "sem opinião formada sobre isso", "intensity": "mild"}

    sentiment_templates = archetype.get(sentiment)
    if not sentiment_templates:
        return {"base": "sem opinião formada sobre isso", "intensity": "mild"}

    # Try specific topic first, fallback to 'general'
    pool = sentiment_templates.get(topic)
    if not pool:
        pool = sentiment_templates.get("general")
    if not pool:
        return {"base": "sem opinião formada sobre isso", "intensity": "mild"}

    # Pick by weighted intensity
    target_intensity = _pick_weighted_intensity()

    # Try to find a template matching the target intensity
    matching = [t for t in pool if t["intensity"] == target_intensity]
    if matching:
        return _pick_random(matching)

    # Fallback: find closest intensity (prefer milder)
    intensity_order = ["mild", "moderate", "strong", "extreme"]
    target_idx = intensity_order.index(target_intensity) if target_intensity in intensity_order else 0

    for delta in range(1, len(intensity_order)):
        # Check lower intensity first
        if target_idx - delta >= 0:
            lower = [t for t in pool if t["intensity"] == intensity_order[target_idx - delta]]
            if lower:
                return _pick_random(lower)
        # Then check higher
        if target_idx + delta < len(intensity_order):
            higher = [t for t in pool if t["intensity"] == intensity_order[target_idx + delta]]
            if higher:
                return _pick_random(higher)

    return _pick_random(pool)


# ── Step 2: Fill Regional Slots ──────────────────────────────────────────────


def _fill_slots(text: str, profile: dict, style: WritingStyle) -> str:
    result = text

    if "{opener}" in result:
        if _maybe(style["regional_rate"]):
            result = result.replace("{opener}", _pick_random(profile["exclamations"]).lower())
        else:
            result = result.replace("{opener}", "")

    if "{filler}" in result:
        if _maybe(style["regional_rate"]):
            result = result.replace("{filler}", _pick_random(profile["fillers"]))
        else:
            result = result.replace("{filler}", "")

    if "{closer}" in result:
        if _maybe(style["regional_rate"]):
            result = result.replace("{closer}", _pick_random(profile["closers"]))
        else:
            result = result.replace("{closer}", "")

    if "{intensifier}" in result:
        if _maybe(style["regional_rate"]):
            result = result.replace("{intensifier}", _pick_random(profile["intensifiers"]))
        else:
            result = result.replace("{intensifier}", "demais")

    # Clean up double spaces from empty slot fills
    result = re.sub(r"\s{2,}", " ", result).strip()

    return result


# ── Step 3: Apply Abbreviations ──────────────────────────────────────────────


def _apply_abbreviations(text: str, style: WritingStyle, generation: str) -> str:
    if style["abbreviation_rate"] <= 0.05:
        return text

    abbreviations = INTERNET_BR["abbreviations"]
    result = text

    # Sort by length descending to avoid partial replacements
    sorted_keys = sorted(abbreviations.keys(), key=len, reverse=True)

    for full_word in sorted_keys:
        if not _maybe(style["abbreviation_rate"]):
            continue

        abbrev = abbreviations[full_word]
        # Word boundary-aware replacement (case-insensitive)
        pattern = re.compile(r"\b" + _escape_regex(full_word) + r"\b", re.IGNORECASE)
        result = pattern.sub(abbrev, result)

    # Add generation-specific extra abbreviations into the text occasionally
    gen_mod = GENERATION_MODIFIERS.get(generation)
    if gen_mod and gen_mod["memeExpressions"] and _maybe(0.15):
        # Occasionally prepend a meme expression
        result = _pick_random(gen_mod["memeExpressions"]) + " " + result

    return result


# ── Step 4: Apply Spelling Errors ────────────────────────────────────────────


def _remove_random_accents(text: str, rate: float) -> str:
    accent_map = {
        "á": "a", "à": "a", "ã": "a", "â": "a",
        "é": "e", "ê": "e",
        "í": "i",
        "ó": "o", "ô": "o", "õ": "o",
        "ú": "u", "ü": "u",
        "ç": "c",
    }

    chars = []
    for char in text:
        lower = char.lower()
        if lower in accent_map and _maybe(rate):
            replacement = accent_map[lower]
            chars.append(replacement if char == lower else replacement.upper())
        else:
            chars.append(char)
    return "".join(chars)


def _apply_spelling_errors(text: str, style: WritingStyle, education_level: str) -> str:
    edu = EDUCATION_MODIFIERS.get(education_level)
    if not edu or not edu["commonErrors"]:
        return text

    error_rate = style["spelling_error_rate"]
    if error_rate <= 0.05:
        return text

    result = text

    # Apply common errors (we intentionally introduce the "wrong" version)
    # The commonErrors are stored as (wrong, correct), so we replace correct -> wrong
    for wrong, correct in edu["commonErrors"]:
        if not _maybe(error_rate):
            continue
        pattern = re.compile(r"\b" + _escape_regex(correct) + r"\b", re.IGNORECASE)
        result = pattern.sub(wrong, result)

    # Remove accents probabilistically for low-education
    if error_rate > 0.3 and _maybe(error_rate * 0.5):
        result = _remove_random_accents(result, error_rate * 0.4)

    # Remove punctuation for very low education
    if edu["punctuationUsage"] == "none" and _maybe(0.6):
        result = re.sub(r"[.,;:]", "", result)

    return result


# ── Step 5: Apply Caps Pattern ───────────────────────────────────────────────


def _apply_caps_pattern(text: str, style: WritingStyle, generation: str) -> str:
    # Boomer ALL CAPS
    if generation == "Boomer" and _maybe(style["caps_rate"]):
        return text.upper()

    # Gen Z: CAPS on emphasis words
    if generation == "Gen Z" and _maybe(style["caps_rate"]):
        emphasis_words = [
            "nunca", "sempre", "todo", "ninguém", "nada", "tudo", "muito",
            "demais", "absurdo", "ridículo", "inacreditável", "óbvio",
            "claro", "sim", "não",
        ]
        result = text
        for word in emphasis_words:
            if _maybe(0.4):
                pattern = re.compile(r"\b" + _escape_regex(word) + r"\b", re.IGNORECASE)
                result = pattern.sub(word.upper(), result)
        return result

    # Others: occasional caps on strong words
    if _maybe(style["caps_rate"] * 0.3):
        words = text.split(" ")
        if words:
            idx = random.randint(0, len(words) - 1)
            if words[idx] and len(words[idx]) > 3:
                words[idx] = words[idx].upper()
            return " ".join(words)

    return text


# ── Step 6: Add Laughter ─────────────────────────────────────────────────────


def _add_laughter(text: str, style: WritingStyle, sentiment: str) -> str:
    # More likely on negative (sarcastic) or positive (enthusiastic) sentiments
    boost = -0.2 if sentiment == "neutral" else 0.1

    if not _maybe(style["laughter_rate"] + boost):
        return text

    laugh = _pick_random(INTERNET_BR["laughter"])

    # Sometimes at start, sometimes at end
    if _maybe(0.3):
        return laugh + " " + text
    return text + " " + laugh


# ── Step 7: Add Emojis ───────────────────────────────────────────────────────


def _add_emojis(
    text: str,
    style: WritingStyle,
    sentiment: str,
    state_profile: dict,
    religion: str,
) -> str:
    if style["emoji_rate"] <= 0.05:
        return text

    emojis: list[str] = []

    # Add sentiment-based emoji
    if _maybe(style["emoji_rate"]):
        pool = SENTIMENT_EMOJIS.get(sentiment, SENTIMENT_EMOJIS["neutral"])
        emojis.append(_pick_random(pool))

    # Add state-specific emoji occasionally
    if _maybe(style["emoji_rate"] * 0.4) and state_profile.get("typicalEmojis"):
        emojis.append(_pick_random(state_profile["typicalEmojis"]))

    # Add religious emoji for religious personas
    if _maybe(style["religious_rate"] * 0.5):
        emojis.append(_pick_random(SENTIMENT_EMOJIS["religious"]))

    # High emoji density: add more
    if style["emoji_rate"] > 0.5 and _maybe(0.5):
        pool = SENTIMENT_EMOJIS.get(sentiment, SENTIMENT_EMOJIS["neutral"])
        emojis.append(_pick_random(pool))

    if not emojis:
        return text

    return text + " " + "".join(emojis)


# ── Step 8: Add Punctuation ──────────────────────────────────────────────────


def _add_punctuation(text: str, style: WritingStyle, intensity: str) -> str:
    # Strong/extreme intensity -> more punctuation
    boost = 0.4 if intensity == "extreme" else (0.2 if intensity == "strong" else 0)

    if _maybe(0.3 + boost + (1 - style["formality_level"]) * 0.2):
        # Replace trailing punctuation with exaggerated version
        pattern = _pick_random(INTERNET_BR["punctuationPatterns"])
        trimmed = re.sub(r"[.!?]+$", "", text)
        return trimmed + pattern

    # Low formality: remove periods (people don't use them on social media)
    if style["formality_level"] < 0.4 and _maybe(0.5):
        return re.sub(r"\.$", "", text)

    return text


# ── Step 9: Add Religious Expressions ────────────────────────────────────────

_RELIGIOUS_EXPRESSIONS: dict[str, list[str]] = {
    "Evangélico": ["Deus abençoe", "em nome de Jesus", "a Bíblia diz", "Deus é fiel", "glória a Deus", "na fé"],
    "Católico": ["Deus queira", "Nossa Senhora", "se Deus quiser", "Deus tenha misericórdia"],
    "Espírita": ["a espiritualidade nos guia", "as boas energias"],
    "Matriz Africana": ["axé", "com fé nos orixás"],
}


def _add_religious_expressions(text: str, style: WritingStyle, religion: str) -> str:
    if not _maybe(style["religious_rate"] * 0.4):
        return text

    pool = _RELIGIOUS_EXPRESSIONS.get(religion)
    if not pool:
        return text

    expr = _pick_random(pool)

    # Add at end
    if _maybe(0.6):
        return text + ". " + expr
    # Add at start
    return expr + "!! " + text


# ── Step 10: Add Reaction Words ──────────────────────────────────────────────


def _add_reaction(text: str, style: WritingStyle, intensity: str) -> str:
    # Only for informal comments with some intensity
    if style["formality_level"] > 0.6:
        return text
    if intensity == "mild" and not _maybe(0.15):
        return text
    if not _maybe(0.25):
        return text

    reaction = _pick_random(INTERNET_BR["reactions"])
    return reaction + " " + text


###############################################################################
# MAIN EXPORT
###############################################################################


def generate_comment(persona: dict[str, Any], topic: str, sentiment: str) -> str:
    """
    Generate a single realistic Brazilian social media comment.

    Args:
        persona: dict with keys: region, state, generation, education_level,
                 social_class, political_leaning, religion, age, gender,
                 area_type, archetype_id, name
        topic: one of 'crime', 'social', 'economy', 'politics', 'environment', 'general'
        sentiment: one of 'positive', 'negative', 'neutral'

    Returns:
        A generated comment string.
    """
    # Validate topic
    valid_topic = topic if topic in TOPIC_KEYS else "general"

    # Get persona's state profile and writing style
    state_profile = get_state_profile(persona.get("state", "SP"))
    style = compute_writing_style(persona)

    # 1. Select template
    template = _select_template(persona.get("archetype_id", "moderate"), sentiment, valid_topic)

    # 2. Fill regional slots
    comment = _fill_slots(template["base"], state_profile, style)

    # 3. Add reaction words
    comment = _add_reaction(comment, style, template["intensity"])

    # 4. Add religious expressions
    comment = _add_religious_expressions(comment, style, persona.get("religion", ""))

    # 5. Apply spelling errors (before abbreviations, so errors apply to full words)
    comment = _apply_spelling_errors(comment, style, persona.get("education_level", "Medio"))

    # 6. Apply abbreviations
    comment = _apply_abbreviations(comment, style, persona.get("generation", "Millennial"))

    # 7. Apply caps pattern
    comment = _apply_caps_pattern(comment, style, persona.get("generation", "Millennial"))

    # 8. Add laughter
    comment = _add_laughter(comment, style, sentiment)

    # 9. Add emojis
    comment = _add_emojis(comment, style, sentiment, state_profile, persona.get("religion", ""))

    # 10. Adjust punctuation
    comment = _add_punctuation(comment, style, template["intensity"])

    # Final cleanup
    comment = re.sub(r"\s{2,}", " ", comment).strip()

    # Ensure it doesn't end up empty after cleanup
    if not comment:
        comment = "sem opinião formada sobre isso"

    return comment


###############################################################################
# BATCH GENERATE (for Pulse Arena)
###############################################################################


def generate_batch_comments(
    personas: list[dict[str, Any]],
    topic: str,
    sentiment_distribution: dict[str, dict[str, float]],
    comments_per_archetype: int,
) -> list[dict[str, Any]]:
    """
    Generate multiple comments from a pool of personas.
    Used by Pulse Arena to generate representative sample comments.

    Args:
        personas: list of persona dicts
        topic: topic key
        sentiment_distribution: dict[archetype_id -> {positive, negative, neutral}]
        comments_per_archetype: how many comments per archetype

    Returns:
        Shuffled list of GeneratedComment dicts.
    """
    comments: list[dict[str, Any]] = []

    # Group personas by archetype
    by_archetype: dict[str, list[dict]] = {}
    for p in personas:
        aid = p.get("archetype_id", "moderate")
        if aid not in by_archetype:
            by_archetype[aid] = []
        by_archetype[aid].append(p)

    sentiments: list[str] = ["positive", "negative", "neutral"]

    for archetype_id, pool in by_archetype.items():
        if not pool:
            continue

        dist = sentiment_distribution.get(archetype_id)
        if not dist:
            continue

        for sentiment in sentiments:
            if sentiment == "neutral":
                count = max(1, round(comments_per_archetype * 0.2))
            else:
                count = max(1, round(comments_per_archetype * 0.4))

            for _ in range(count):
                persona = _pick_random(pool)
                comment_text = generate_comment(persona, topic, sentiment)

                comments.append({
                    "archetype": archetype_id,
                    "sentiment": sentiment,
                    "comment": comment_text,
                    "persona_name": persona.get("name", ""),
                    "age": persona.get("age", 0),
                    "location": persona.get("state", ""),
                    "state": persona.get("state", ""),
                    "region": persona.get("region", ""),
                    "generation": persona.get("generation", ""),
                })

    # Shuffle
    random.shuffle(comments)

    return comments
