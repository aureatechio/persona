/**
 * AI-powered route classifier for Arena questions.
 *
 * Uses Claude Sonnet 4 to determine whether a question can be answered
 * using existing persona data columns (local processing) or needs
 * the full Python AI backend.
 *
 * Returns: { route: "local" | "python", fields: string[], reason: string }
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AVAILABLE_COLUMNS = `
TEMAS POLÊMICOS (sim/não):
tema_aborto, tema_armas, tema_maconha, tema_privatizacoes, tema_cotas_raciais, tema_casamento_gay

QUESTIONÁRIO POLÍTICO/SOCIAL (sim/não ou escala):
q_pena_morte, q_familia_tradicional, q_racismo_estrutural, q_meritocracia, q_religiao_politica,
q_feminismo_bom, q_democracia_importante, q_intervencao_militar, q_impeachment_lula,
q_mudanca_climatica_real, q_sus_funciona, q_vacinas_confiar, q_direitos_lgbt,
q_adocao_homoafetiva, q_bolsa_familia_bom, q_amazonia_preservar, q_energia_renovavel,
q_linguagem_neutra, q_genero_biologico, q_homeschooling, q_voto_obrigatorio,
q_drogas_descriminalizar, q_maioridade_penal_16, q_prostituicao_legalizar,
q_policia_violenta, q_crack_internar_forcado, q_seguranca_prioridade,
q_camera_facial_aceita, q_justica_funciona, q_prisao_perpetua

ECONOMIA:
q_salario_minimo_aumentar, q_reforma_tributaria, q_imposto_ricos, q_estado_tamanho,
q_teto_gastos, q_previdencia_reforma, q_bitcoin_confiar, q_banco_central_independente,
q_auxilio_emergencial_voltar, q_desemprego_principal, q_inflacao_controle, q_13_salario_manter

CONFIANÇA INSTITUCIONAL (escala 1-10):
q_confianca_stf, q_confianca_congresso, q_confianca_imprensa, q_confianca_policia,
q_confianca_exercito, q_confianca_igreja

POLÍTICO:
aprovacao_lula, q_avaliacao_bolsonaro, voto_2022, voto_2026,
q_reeleicao, q_fake_news_problema, q_redes_sociais_censuradas,
q_sistema_eleitoral_confiavel, q_pt_comunista, q_bolsonaro_ditador,
q_corrupcao_problema

MEIO AMBIENTE:
q_agronegocio_desmata, q_queimadas_criminosas

CIÊNCIA/SAÚDE:
q_ciencia_importante, q_terra_plana, q_medicina_publica_boa, q_plano_saude_tem

EDUCAÇÃO:
q_universidade_publica_gratuita, q_ensino_distancia, q_escola_particular_melhor, q_enem_justo

INTERNACIONAL:
q_china_ameaca, q_eua_aliado, q_imigracao

MÍDIA:
q_whatsapp_noticias

TABU IMPLÍCITO (sim/não):
q_ti_sonegaria_imposto, q_ti_aceitaria_propina, q_ti_venderia_voto,
q_ti_bater_filho_normal, q_ti_linchamento_apoiaria, q_ti_tortura_preso_ok,
q_ti_trabalho_infantil_ok, q_ti_jeitinho_furar_fila, q_ti_nepotismo_concurso,
q_ti_compraria_produto_roubado, q_ti_racismo_latente, q_ti_nao_contrataria_negro_chefia,
q_ti_vizinho_negro_incomoda, q_ti_mulher_roupa_culpada, q_ti_homofobia_violenta,
q_ti_assediaria_mulher_rua, q_ti_intolerancia_religiosa, q_ti_preconceito_nordestino,
q_ti_violencia_domestica, q_ti_menor14_sabe_o_que_faz

VIVÊNCIAS (sim/não):
q_vi_abuso_sexual_infancia, q_vi_passou_fome, q_vi_ja_foi_assaltado,
q_vi_desempregado_1ano, q_vi_depressao_ansiedade, q_vi_pensou_suicidio,
q_vi_preso_ou_familiar_preso, q_vi_ja_dormiu_na_rua, q_vi_enchente_desastre,
q_vi_dependencia, q_vi_sofreu_violencia_domestica, q_vi_sofreu_racismo,
q_vi_sofreu_assedio_sexual

DEMOGRÁFICOS:
gender_identity, age, region_br, generation, social_class, education_level,
macro_religion, raca_cor, political_leaning
`;

const SYSTEM_PROMPT = `Voce e um classificador de perguntas de pesquisa de opiniao publica brasileira.
Sua tarefa: decidir se a pergunta pode ser respondida com colunas de dados existentes (LOCAL) ou precisa de IA generativa (PYTHON).

COLUNAS DISPONIVEIS:
${AVAILABLE_COLUMNS}

REGRAS DE DECISAO (em ordem de prioridade):

1. PYTHON OBRIGATORIAMENTE se a pergunta:
   - Menciona uma PESSOA ESPECIFICA (politico, celebridade, empresario, influencer) que NAO seja Lula ou Bolsonaro
   - Menciona um EVENTO ESPECIFICO (acidente, caso judicial, escandalo, noticia)
   - Pede OPINIAO sobre algo que aconteceu recentemente (fato noticioso)
   - Pergunta sobre POLITICA EXTERNA especifica (guerra, invasao, acordo)
   - Menciona NOMES PROPRIOS de pessoas, empresas, ou lugares especificos
   - IGNORE o framing da pergunta ("na minha opiniao", "eu acho que", "voces acham") — foque nas ENTIDADES mencionadas
   - Exemplos: "O Daniel Vorcara era pra estar preso", "Na minha opiniao o Vorcaro deveria estar preso", "O que acham do caso do aviao?", "Devemos invadir a Venezuela?", "O Pablo Marcal deveria ser presidente?"

2. LOCAL se a pergunta:
   - E sobre um TEMA GENERICO coberto pelas colunas (aborto, armas, drogas, economia, etc.)
   - E sobre INSTITUICOES GENERICAS (STF, policia, congresso, imprensa, igreja)
   - E sobre Lula ou Bolsonaro ESPECIFICAMENTE (temos colunas dedicadas)
   - Pode ser inferida de colunas existentes por RELACAO INDIRETA clara
   - Exemplos: "O STF e corrupto?", "A maconha deveria ser legalizada?", "O Brasil e racista?", "O Lula e bom presidente?"

3. NA DUVIDA: prefira PYTHON. E melhor usar IA do que dar resposta errada com colunas nao relacionadas.

ATENCAO: Nao confunda COINCIDENCIA DE PALAVRAS com RELACAO SEMANTICA.
- "Fulano era pra estar preso" NAO tem relacao com q_vi_preso_ou_familiar_preso (que e sobre vivencia pessoal)
- "A policia e violenta" TEM relacao com q_policia_violenta (mesmo tema)
- A coluna deve medir EXATAMENTE o que a pergunta pede, nao apenas conter uma palavra parecida

Responda APENAS com JSON (sem markdown):
{"route":"local"|"python","fields":["coluna1","coluna2"],"reason":"explicacao curta"}`;

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question) return Response.json({ route: 'python', fields: [], reason: 'empty' });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `PERGUNTA: "${question}"`,
      }],
      temperature: 0,
    });

    const raw = response.content.find(b => b.type === 'text')?.text?.trim() || '';

    // Parse JSON
    let parsed;
    try {
      const clean = raw.startsWith('```')
        ? raw.split('\n', 1)[0] === '```json'
          ? raw.slice(raw.indexOf('\n') + 1, raw.lastIndexOf('```')).trim()
          : raw.replace(/```/g, '').trim()
        : raw;
      parsed = JSON.parse(clean);
    } catch {
      return Response.json({ route: 'python', fields: [], reason: 'parse_error' });
    }

    return Response.json({
      route: parsed.route || 'python',
      fields: parsed.fields || [],
      reason: parsed.reason || '',
    });
  } catch (err) {
    console.error('[classify-route] Error:', err);
    return Response.json({ route: 'local', fields: [], reason: 'error_fallback' });
  }
}
