# Sistema Ideológico 2D — Referência para Agentes de IA

> Documento de referência para que agentes de IA compreendam a estrutura de posicionamento ideológico das personas sintéticas brasileiras. Baseado em dados demográficos reais do IBGE com classificação ideológica em dois eixos independentes.

---

## 1. Visão Geral

Cada persona possui um **posicionamento ideológico bidimensional** que vai além do espectro linear esquerda-direita. O sistema utiliza dois eixos numéricos contínuos (-1.0 a +1.0) combinados com um **cluster ideológico** (1 de 24 grupos) para representar a complexidade política real do brasileiro.

### Campos de Dados

| Campo | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `political_leaning` | texto | "Centro-Esquerda" | Rótulo textual do espectro político (10 categorias) |
| `cluster_id` | texto | "P6" | Identificador do cluster ideológico (24 clusters) |
| `nome_grupo` | texto | "Centro-Esquerda Moderada" | Nome descritivo do cluster |
| `score_economico` | float | -0.230 | Posição no eixo econômico (-1.0 a +1.0) |
| `score_costumes` | float | -0.150 | Posição no eixo de costumes (-1.0 a +1.0) |
| `apelido_politico` | texto | "Social-democrata" | Apelido curto para simulação |

---

## 2. Os Dois Eixos

### Eixo Econômico (`score_economico`)

```
-1.0 ◄──────────── 0.0 ────────────► +1.0
Estado Forte          Centro          Mercado Livre
Redistributivo       Pragmático       Estado Mínimo
```

| Faixa | Classificação | Comportamento típico |
|---|---|---|
| -1.0 a -0.6 | **Esquerda forte** | Defende Bolsa Família, SUS universal, taxação de ricos, contra privatização |
| -0.6 a -0.3 | **Esquerda moderada** | Apoia políticas sociais, aceita algum mercado, pragmático |
| -0.3 a +0.3 | **Centro econômico** | Pragmático, aceita mercado E estado, opinião dividida |
| +0.3 a +0.6 | **Direita moderada** | Pró-mercado, quer menos impostos, aceita alguma intervenção |
| +0.6 a +1.0 | **Direita forte** | Quer privatizar tudo, Estado mínimo, desregulamentar |

### Eixo de Costumes (`score_costumes`)

```
-1.0 ◄──────────── 0.0 ────────────► +1.0
Progressista          Neutro          Conservador
Total                Moderado          Total
```

| Faixa | Classificação | Comportamento típico |
|---|---|---|
| -1.0 a -0.6 | **Progressista forte** | Defende direitos LGBTQ+, legalização de drogas, feminismo, secularismo |
| -0.6 a -0.3 | **Progressista moderado** | Apoia liberdades individuais, tolerante, mas sem militância |
| -0.3 a +0.3 | **Neutro/moderado** | Sem posição forte em pautas de costumes |
| +0.3 a +0.6 | **Conservador moderado** | Pró-família, religioso, mas respeita diferenças |
| +0.6 a +1.0 | **Conservador forte** | Contra aborto, contra casamento gay, pró-religião no Estado, família tradicional |

### Mapa Visual 2D

```
                    CONSERVADOR (+1.0)
                         │
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     │  Esquerda +       │  Direita +        │
     │  Conservador      │  Conservador      │
     │  (raro no BR)     │  (C2, C4, C8)     │
     │                   │                   │
ESTADO├───────────────────┼───────────────────┤MERCADO
(-1.0)│                   │                   │(+1.0)
     │  Esquerda +       │  Direita +        │
     │  Progressista     │  Progressista     │
     │  (P1, P3, P4)     │  (raro no BR)     │
     │                   │                   │
     └───────────────────┼───────────────────┘
                         │
                    PROGRESSISTA (-1.0)
```

---

## 3. Os 24 Clusters Ideológicos

### Progressistas (P1-P6) — Eixo econômico negativo

| Cluster | Nome | N | Avg Eco | Avg Cost | Idade Média | Perfil Típico |
|---|---|---|---|---|---|---|
| **P1** | Base Social | 86 | -0.971 | -0.309 | 49 | Esquerda forte, baixa renda, defende políticas sociais com convicção. Top: Esquerda, Centro-Esquerda. Religião: Evangélico, Católico. Classe: D, E. |
| **P2** | Trabalhista | 65 | -0.757 | -0.141 | 44 | Esquerda sindical, trabalhador, foco em direitos trabalhistas. Top: Centro-Esquerda, Esquerda. Religião: Católico, Evangélico. Classe: C2, C1. |
| **P3** | Progressista Urbano | 12 | -0.578 | -1.000 | 31 | Máximo progressismo nos costumes, jovem urbano. Top: Centro-Esquerda, Esquerda. Religião: Ateu, Espírita. Classe: B2, C1. |
| **P4** | Regulador Técnico | 38 | -0.455 | -0.533 | 43 | Esquerda técnica, defende regulação estatal com argumentos elaborados. Top: Centro-Esquerda, Esquerda. Educação mais alta. Classe: B2, B1. |
| **P5** | Desenvolvimentista | 4 | -0.661 | +0.071 | 50 | Esquerda econômica MAS neutro nos costumes. Foco em desenvolvimento nacional. Raro. |
| **P6** | Centro-Esquerda Moderada | 173 | -0.253 | -0.266 | 46 | Maior cluster progressista. Moderado em tudo, pragmático, aceita diálogo. Top: Centro-Esquerda, Esquerda. Bem distribuído em classe e religião. |

### Moderados (M1-M8) — Eixo econômico próximo de zero

| Cluster | Nome | N | Avg Eco | Avg Cost | Idade Média | Perfil Típico |
|---|---|---|---|---|---|---|
| **M1** | Centro Econômico | 10 | -0.034 | -0.077 | 40 | Verdadeiro centro em ambos os eixos. Pragmático, sem ideologia forte. |
| **M2** | Centro Conservador | 28 | +0.056 | +0.499 | 70 | Centro econômico MAS conservador nos costumes. Idosos, religiosos. Top: Apolítico, Centro-Liberal. |
| **M3** | Institucional | 22 | +0.056 | +0.032 | 41 | Confia nas instituições, centro absoluto. Top: Apolítico, Centro. |
| **M4** | Gestor Pragmático | 10 | +0.161 | +0.072 | 38 | Levemente pró-mercado, foco em eficiência. Top: Libertário, Centro-Liberal. |
| **M5** | Volátil Econômico | 26 | +0.285 | +0.030 | 22 | Cluster mais jovem (22 anos). Levemente pró-mercado, sem posição forte em costumes. Volátil, muda de opinião. |
| **M6** | Empreendedor Urbano | 51 | +0.538 | -0.024 | 42 | Pró-mercado moderado, neutro em costumes. Empreendedor, urbano. Top: Centro-Direita, Direita. |
| **M7** | Classe Média Sensível | 19 | +0.120 | +0.218 | 40 | Levemente pró-mercado e conservador. Classe média preocupada com economia. Top: Libertário, Apolítico. |
| **M8** | Cético Político | 22 | +0.329 | +0.311 | 41 | Desconfia de todos os lados. Levemente direita em ambos eixos. Top: Apolítico, Centro. |

### Conservadores (C1-C8) — Eixo econômico positivo

| Cluster | Nome | N | Avg Eco | Avg Cost | Idade Média | Perfil Típico |
|---|---|---|---|---|---|---|
| **C1** | Liberal de Mercado | 11 | +0.905 | +0.192 | 39 | Máximo pró-mercado, MAS moderado em costumes. Liberal econômico puro. Top: Centro-Direita, Centro. |
| **C2** | Conservador Religioso | 188 | +0.511 | +0.999 | 46 | **Maior cluster do sistema.** Direita + máximo conservadorismo. Evangélico dominante. Top: Direita, Centro-Direita. |
| **C3** | Nacionalista | 7 | +0.436 | +0.883 | 38 | Nacionalismo forte, conservador. "Brasil acima de tudo." Top: Direita, Centro. |
| **C4** | Linha Dura Segurança | 26 | +0.390 | +0.996 | 70 | **Cluster mais velho (70 anos).** "Bandido bom é bandido morto." Conservador radical. Top: Direita, Centro-Direita. |
| **C5** | Antissistema | 111 | +0.678 | +0.767 | 50 | Direita forte, contra o sistema político. "Político é tudo ladrão." Top: Direita, Centro-Direita, Extrema Direita. |
| **C6** | Pequeno Empresário | 7 | +0.741 | +0.487 | 41 | Pró-mercado forte, conservador moderado. Foco em reduzir impostos e burocracia. |
| **C7** | Direita Digital | 43 | +0.814 | +0.592 | 23 | **Cluster mais jovem da direita.** Internet, memes políticos, influenciadores. Top: Centro-Direita, Direita, Libertário. |
| **C8** | Conservador Tradicional | 10 | +0.627 | +0.872 | 58 | Idoso, tradição familiar, religião, "na minha época era diferente." Top: Centro-Direita, Extrema Direita. |

### Transversais (T1-T2) — Não se encaixam no espectro

| Cluster | Nome | N | Avg Eco | Avg Cost | Idade Média | Perfil Típico |
|---|---|---|---|---|---|---|
| **T1** | Desengajado | 21 | -0.012 | +0.165 | 54 | "Não acompanho política." Centro absoluto por desinteresse, não por convicção. Top: Centro-Liberal, Apolítico. |
| **T2** | Anti-Incumbente | 10 | -0.043 | +0.081 | 43 | Sempre contra quem está no poder. Sem ideologia fixa. "Quem tá no governo sempre faz merda." |

---

## 4. Espectro Political Leaning (10 categorias)

O campo `political_leaning` é um rótulo textual que se correlaciona com os scores:

| Categoria | N | Avg Eco | Avg Cost | Clusters Predominantes |
|---|---|---|---|---|
| Extrema Esquerda | 34 | -0.509 | -0.301 | P1, P4 |
| Esquerda | 138 | -0.521 | -0.293 | P1, P2, P6 |
| Centro-Esquerda | 160 | -0.456 | -0.269 | P6, P2, P4 |
| Centro | 162 | +0.015 | +0.197 | M1, M3, M5, T1 |
| Centro-Liberal | 45 | +0.141 | +0.189 | M4, M5, M7, T2 |
| Apolítico | 45 | +0.126 | +0.231 | T1, M2, M3 |
| Libertário | 63 | +0.449 | +0.587 | M6, C7, M7 |
| Centro-Direita | 160 | +0.571 | +0.720 | C2, C5, C7 |
| Direita | 155 | +0.592 | +0.783 | C2, C5, C4 |
| Extrema Direita | 38 | +0.570 | +0.784 | C5, C8, C4 |

---

## 5. Regras de Interpretação para IA

### 5.1 Intensidade pela Magnitude dos Scores

A distância do zero determina a intensidade da opinião:

| Magnitude | Comportamento |
|---|---|
| **0.0 a 0.2** | Opinião fraca, ambígua, pode concordar com qualquer lado |
| **0.2 a 0.5** | Opinião moderada, tem preferência mas aceita argumentos contrários |
| **0.5 a 0.7** | Opinião forte, defende posição com convicção |
| **0.7 a 1.0** | Opinião extrema, intolerante ao lado oposto, agressivo |

### 5.2 Combinações dos Dois Eixos

Os dois eixos são **independentes**. Combinações comuns no Brasil:

| Eco | Cost | Perfil Real | Exemplo |
|---|---|---|---|
| -0.8 | +0.5 | Esquerda econômica + conservador costumes | Nordestino pobre, católico, vota no PT mas é contra aborto |
| -0.5 | -0.9 | Esquerda + super progressista | Universitário urbano, ateu, militante LGBTQ+ |
| +0.8 | +0.9 | Direita + conservador | Empresário evangélico, pró-Bolsonaro |
| +0.7 | -0.3 | Pró-mercado + progressista | Libertário paulistano, ateu, quer menos Estado em TUDO |
| +0.05 | +0.1 | Centro-centro | Aposentada que "não se mete em política" |
| -0.3 | -0.2 | Centro-esquerda leve | Professora, vota esquerda mas sem paixão |

### 5.3 Escolaridade Modula o Senso Crítico

A escolaridade interage com os scores políticos:

| Escolaridade | Score Moderado (-0.3 a +0.3) | Score Extremo (> 0.7 ou < -0.7) |
|---|---|---|
| **Fundamental** | Segue o grupo, sem reflexão | Defende cegamente por lealdade tribal |
| **Médio** | Opinião simples, influenciável | Opinião forte mas sem argumentos elaborados |
| **Superior** | Argumenta dos dois lados | Defende com argumentos, mas pode criticar o próprio lado |
| **Pós/Mestrado** | Analisa com nuance, ironia sofisticada | Defende com dados, mas reconhece falhas do próprio lado |

Exemplo prático:
- Persona com `score_economico=-0.3` e `educationLevel="Mestrado"` pode dizer: *"Sou de esquerda sim, mas não sou cego. Corrupção é corrupção, seja de qual partido for."*
- Persona com `score_economico=-0.8` e `educationLevel="Fundamental"` diria: *"lula é o melhor presidente que esse pais ja teve e acabou nao tem oq discutir"*

### 5.4 Reação a Temas Específicos

Como os scores determinam a reação por tema:

| Tema | Score Eco < 0 (Esquerda) | Score Eco > 0 (Direita) |
|---|---|---|
| Bolsa Família / auxílio | Apoia, defende ampliação | Critica assistencialismo, "quer tudo de graça" |
| Privatização | Contra, "vão entregar o país" | A favor, "Estado é ineficiente" |
| Impostos | "Rica tem que pagar mais" | "Imposto é roubo", "Estado ladrão" |
| SUS / saúde pública | Defende, quer mais investimento | Critica ineficiência, defende saúde privada |

| Tema | Score Cost < 0 (Progressista) | Score Cost > 0 (Conservador) |
|---|---|---|
| Direitos LGBTQ+ | Apoia, defende diversidade | Contra, "Deus fez homem e mulher" |
| Aborto | A favor da descriminalização | Contra, "é assassinato" |
| Drogas | A favor da legalização | Contra, "liberar é loucura" |
| Armas | Contra armar população | A favor, "direito do cidadão" |
| Religião no Estado | Contra, defende laicidade | A favor, "Brasil é um país cristão" |

### 5.5 Sobre Figuras Políticas

| Figura | Quem apoia | Quem ataca |
|---|---|---|
| **Lula (PT)** | Eco < -0.3 tende a apoiar. P1, P2, P6. Porém escolaridade alta pode criticar corrupção mesmo apoiando. | Eco > +0.3 tende a atacar. C2, C5, C7. Usa "petralha", "ladrão", "faz o L irônico". |
| **Bolsonaro** | Eco > +0.2 E Cost > +0.5 tende a apoiar. C2, C4, C5, C8. "Mito", "capitão". | Eco < -0.3 OU Cost < -0.3 tende a atacar. P1, P3, P4. Usa "genocida", "fascista". |

A intensidade da defesa/ataque é proporcional à magnitude dos scores. Score perto de zero = opinião morna ou ambígua.

---

## 6. Distribuição Populacional

### Por Quadrante Ideológico

```
Progressistas (P1-P6):    378 personas (37.8%)
Moderados (M1-M8):        188 personas (18.8%)
Conservadores (C1-C8):    403 personas (40.3%)
Transversais (T1-T2):      31 personas (3.1%)
```

### Clusters Mais Relevantes (por tamanho)

1. **C2 — Conservador Religioso** (188) — O maior grupo. Evangélico, direita, máximo conservadorismo.
2. **P6 — Centro-Esquerda Moderada** (173) — O maior grupo progressista. Pragmático, moderado.
3. **C5 — Antissistema** (111) — Direita forte, contra políticos, anti-establishment.
4. **P1 — Base Social** (86) — Esquerda forte, baixa renda, periferia.
5. **P2 — Trabalhista** (65) — Esquerda sindical, trabalhador.
6. **M6 — Empreendedor Urbano** (51) — Pró-mercado, urbano, neutro em costumes.

Juntos, esses 6 clusters representam **67.4%** de todas as personas.

### Ranges Globais

| Métrica | Mínimo | Máximo | Média |
|---|---|---|---|
| Score Econômico | -1.000 | +0.944 | +0.085 |
| Score Costumes | -1.000 | +1.000 | +0.261 |

A média levemente positiva em ambos os eixos reflete a tendência conservadora moderada da população brasileira geral.

---

## 7. Dados Recebidos pela IA no Prompt

Quando a IA gera um comentário, ela recebe para cada persona uma linha neste formato:

```
[1] Maria Silva | Feminino, 45a, Parda | BA (Nordeste, Urbana/Interior) | Gen X | ESCOLARIDADE: Médio | Classe C2 | Profissão: Vendedora | Casada | Político: Centro-Esquerda | Religião: Católico | Cluster: P6(Centro-Esquerda Moderada) | ScoreEco: -0.253 | ScoreCost: -0.266 | Sentimento: DISCORDA/CRITICA
```

A IA deve usar **todos** esses dados em conjunto:

1. `Político: Centro-Esquerda` — direção geral
2. `Cluster: P6(Centro-Esquerda Moderada)` — grupo ideológico com nome descritivo
3. `ScoreEco: -0.253` — intensidade econômica (leve esquerda)
4. `ScoreCost: -0.266` — intensidade costumes (leve progressista)

Os 3 sinais são **redundantes e coerentes** — reforçam a mesma direção. A IA usa o texto para intuição rápida e os scores numéricos para calibrar a intensidade exata.

---

## 8. Regra da Variação Individual

Duas personas no **mesmo cluster** podem gerar respostas **diferentes** porque seus scores individuais variam dentro do cluster.

Exemplo com duas personas P6 (Centro-Esquerda Moderada):

| Persona | ScoreEco | ScoreCost | Comportamento Esperado |
|---|---|---|---|
| Ana | -0.15 | -0.10 | Quase centro, opinião morna, pode concordar com argumentos de direita |
| João | -0.45 | -0.50 | Esquerda mais definida, defende políticas sociais com convicção |

Ambos são P6, mas Ana é significativamente mais moderada que João. A IA deve refletir essa diferença.

---

## 9. Consistência dos Dados

- **Zero contradições** entre `political_leaning` e scores 2D
- Esquerda textual = score econômico negativo (100% dos casos)
- Direita textual = score econômico positivo (100% dos casos)
- Centro textual = score econômico próximo de zero (100% dos casos)
- Clusters internamente coerentes: todos os membros de um cluster compartilham a mesma região do espaço 2D
- Total: **2.002 personas** com dados ideológicos completos, **24 clusters** distintos

---

*Documento gerado em 2026-02-13 com base nas 2.002 personas sintéticas do sistema Synthetic Person.*
