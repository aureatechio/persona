#!/usr/bin/env python3
"""
Populate Supabase 'personas' table with 2002 IBGE-based personas.
Keeps Mariana Costa (b94accc1-7a04-4051-9d09-500b1ede7df0) and replaces all others.

Usage: python3 scripts/populate_personas.py

Requirements: pip install supabase
"""

import csv
import random
import hashlib
import math
import sys
import time
from supabase import create_client

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1: CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

SUPABASE_URL = "https://sobfplitrzgggzqsycew.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA"
CSV_PATH = "/Users/arthurcavallini/Downloads/personas_2002_IBGE_like_clusters_2D_variacao.csv"
MARIANA_ID = "b94accc1-7a04-4051-9d09-500b1ede7df0"
BATCH_SIZE = 25

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2: IBGE STATISTICAL DATA (Censo 2022 approximate)
# ══════════════════════════════════════════════════════════════════════════════

# Ethnicity distribution by region (IBGE Censo 2022)
ETHNICITY_BY_REGION = {
    "Norte":        {"Parda": 0.67, "Branca": 0.20, "Preta": 0.07, "Indígena": 0.04, "Amarela": 0.02},
    "Nordeste":     {"Parda": 0.62, "Branca": 0.22, "Preta": 0.12, "Indígena": 0.01, "Amarela": 0.03},
    "Centro-Oeste": {"Parda": 0.55, "Branca": 0.35, "Preta": 0.07, "Indígena": 0.02, "Amarela": 0.01},
    "Sudeste":      {"Branca": 0.50, "Parda": 0.36, "Preta": 0.10, "Amarela": 0.03, "Indígena": 0.01},
    "Sul":          {"Branca": 0.73, "Parda": 0.19, "Preta": 0.05, "Amarela": 0.02, "Indígena": 0.01},
}

# Income ranges by social class (ABEP/IBGE, R$ 2024)
INCOME_BY_CLASS = {
    "A":  (15000, 50000),
    "B1": (8000, 15000),
    "B2": (4000, 8000),
    "C1": (2500, 4000),
    "C2": (1600, 2500),
    "D":  (800, 1600),
    "E":  (400, 800),
}

FAIXA_RENDA_IBGE = {
    "A":  "Acima de 20 salários mínimos",
    "B1": "De 10 a 20 salários mínimos",
    "B2": "De 4 a 10 salários mínimos",
    "C1": "De 2 a 4 salários mínimos",
    "C2": "De 1 a 2 salários mínimos",
    "D":  "Até 1 salário mínimo",
    "E":  "Até meio salário mínimo",
}

PODER_COMPRA = {"A": 10, "B1": 8, "B2": 7, "C1": 5, "C2": 4, "D": 3, "E": 2}

# IDH by state (IBGE/PNUD 2021 approximate)
IDH_BY_STATE = {
    "AC": 0.663, "AL": 0.631, "AM": 0.674, "AP": 0.660, "BA": 0.660,
    "CE": 0.682, "DF": 0.824, "ES": 0.740, "GO": 0.735, "MA": 0.639,
    "MG": 0.731, "MS": 0.729, "MT": 0.725, "PA": 0.646, "PB": 0.658,
    "PE": 0.673, "PI": 0.646, "PR": 0.749, "RJ": 0.762, "RN": 0.684,
    "RO": 0.690, "RR": 0.674, "RS": 0.746, "SC": 0.774, "SE": 0.665,
    "SP": 0.783, "TO": 0.699,
}

# Regional profile descriptions (IBGE)
PERFIL_REGIONAL = {
    "Norte": "Região amazônica com economia baseada em extrativismo, agronegócio e zona franca industrial",
    "Nordeste": "Região com forte cultura popular, economia em expansão com turismo, agricultura e serviços",
    "Centro-Oeste": "Região de agronegócio forte, expansão urbana acelerada e polo do funcionalismo público",
    "Sudeste": "Centro econômico e financeiro do país, maior concentração industrial e de serviços",
    "Sul": "Região com alto desenvolvimento humano, forte indústria, cooperativismo e agropecuária",
}

DENSIDADE_POR_PORTE = {
    "Capital": "Alta",
    "Grande": "Alta",
    "Médio": "Média",
    "Pequeno": "Baixa",
}

PROB_CARREIRA_POR_REGIAO = {
    "Norte": "Média para Serviços Públicos e Extrativismo",
    "Nordeste": "Média para Serviços, Comércio e Turismo",
    "Centro-Oeste": "Alta para Agronegócio e Funcionalismo Público",
    "Sudeste": "Alta para Indústria, Tecnologia e Serviços",
    "Sul": "Alta para Indústria, Cooperativismo e Agropecuária",
}

# Civil status distribution by age (IBGE approximate)
CIVIL_STATUS_BY_AGE = {
    (16, 24):  [("Solteiro", 0.85), ("Casado", 0.08), ("União Estável", 0.05), ("Divorciado", 0.01), ("Viúvo", 0.01)],
    (25, 34):  [("Solteiro", 0.50), ("Casado", 0.25), ("União Estável", 0.15), ("Divorciado", 0.08), ("Viúvo", 0.02)],
    (35, 44):  [("Solteiro", 0.25), ("Casado", 0.40), ("União Estável", 0.15), ("Divorciado", 0.15), ("Viúvo", 0.05)],
    (45, 54):  [("Solteiro", 0.15), ("Casado", 0.45), ("União Estável", 0.10), ("Divorciado", 0.20), ("Viúvo", 0.10)],
    (55, 64):  [("Solteiro", 0.10), ("Casado", 0.40), ("União Estável", 0.08), ("Divorciado", 0.22), ("Viúvo", 0.20)],
    (65, 100): [("Solteiro", 0.05), ("Casado", 0.35), ("União Estável", 0.05), ("Divorciado", 0.15), ("Viúvo", 0.40)],
}


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3: CITY COORDINATES (163 cities)
# ══════════════════════════════════════════════════════════════════════════════

CITY_COORDS = {
    # Acre
    "Rio Branco-AC": (-9.97, -67.81), "Cruzeiro do Sul-AC": (-7.63, -72.67), "Sena Madureira-AC": (-9.07, -68.66),
    # Alagoas
    "Maceió-AL": (-9.67, -35.74), "Arapiraca-AL": (-9.75, -36.66), "Rio Largo-AL": (-9.48, -35.84), "Palmeira dos Índios-AL": (-9.41, -36.63),
    # Amazonas
    "Manaus-AM": (-3.12, -60.02), "Coari-AM": (-4.09, -63.14), "Itacoatiara-AM": (-3.14, -58.44), "Parintins-AM": (-2.63, -56.73),
    # Amapá
    "Macapá-AP": (0.03, -51.05), "Santana-AP": (0.06, -51.17), "Laranjal do Jari-AP": (-0.80, -52.46),
    # Bahia
    "Salvador-BA": (-12.97, -38.51), "Feira de Santana-BA": (-12.27, -38.97), "Vitória da Conquista-BA": (-14.86, -40.84),
    "Camaçari-BA": (-12.70, -38.33), "Juazeiro-BA": (-9.42, -40.50), "Itabuna-BA": (-14.79, -39.28),
    "Ilhéus-BA": (-14.79, -39.05), "Barreiras-BA": (-12.15, -45.00),
    # Ceará
    "Fortaleza-CE": (-3.72, -38.53), "Caucaia-CE": (-3.74, -38.65), "Juazeiro do Norte-CE": (-7.21, -39.32),
    "Sobral-CE": (-3.69, -40.35), "Maracanaú-CE": (-3.87, -38.63), "Crato-CE": (-7.24, -39.41), "Itapipoca-CE": (-3.49, -39.58),
    # Distrito Federal
    "Brasília-DF": (-15.79, -47.88),
    # Espírito Santo
    "Vitória-ES": (-20.32, -40.34), "Serra-ES": (-20.13, -40.31), "Vila Velha-ES": (-20.33, -40.29),
    "Cariacica-ES": (-20.26, -40.42), "Cachoeiro de Itapemirim-ES": (-20.85, -41.11),
    "Linhares-ES": (-19.39, -40.07), "Colatina-ES": (-19.54, -40.63),
    # Goiás
    "Goiânia-GO": (-16.69, -49.25), "Aparecida de Goiânia-GO": (-16.82, -49.24), "Anápolis-GO": (-16.33, -48.95),
    "Rio Verde-GO": (-17.80, -50.92), "Luziânia-GO": (-16.25, -47.95), "Águas Lindas de Goiás-GO": (-15.77, -48.28),
    # Maranhão
    "São Luís-MA": (-2.53, -44.28), "Imperatriz-MA": (-5.52, -47.47), "São José de Ribamar-MA": (-2.56, -44.06),
    "Timon-MA": (-5.09, -42.84), "Caxias-MA": (-4.87, -43.35), "Bacabal-MA": (-4.22, -44.78),
    # Minas Gerais
    "Belo Horizonte-MG": (-19.92, -43.94), "Uberlândia-MG": (-18.92, -48.28), "Contagem-MG": (-19.93, -44.05),
    "Juiz de Fora-MG": (-21.76, -43.35), "Betim-MG": (-19.97, -44.20), "Montes Claros-MG": (-16.73, -43.86),
    "Uberaba-MG": (-19.75, -47.93), "Governador Valadares-MG": (-18.85, -41.95), "Ipatinga-MG": (-19.47, -42.54),
    "Divinópolis-MG": (-20.14, -44.88), "Poços de Caldas-MG": (-21.79, -46.56), "Varginha-MG": (-21.55, -45.43),
    # Mato Grosso do Sul
    "Campo Grande-MS": (-20.44, -54.65), "Dourados-MS": (-22.22, -54.81), "Três Lagoas-MS": (-20.75, -51.68), "Corumbá-MS": (-19.01, -57.65),
    # Mato Grosso
    "Cuiabá-MT": (-15.60, -56.10), "Rondonópolis-MT": (-16.47, -54.64), "Sinop-MT": (-11.86, -55.51),
    "Várzea Grande-MT": (-15.65, -56.13), "Tangará da Serra-MT": (-14.62, -57.50),
    # Pará
    "Belém-PA": (-1.46, -48.50), "Ananindeua-PA": (-1.37, -48.39), "Santarém-PA": (-2.44, -54.71),
    "Marabá-PA": (-5.37, -49.12), "Castanhal-PA": (-1.30, -47.92), "Parauapebas-PA": (-6.07, -49.90), "Abaetetuba-PA": (-1.72, -48.88),
    # Paraíba
    "João Pessoa-PB": (-7.12, -34.86), "Campina Grande-PB": (-7.23, -35.88), "Santa Rita-PB": (-7.11, -34.98),
    "Patos-PB": (-7.02, -37.28), "Sousa-PB": (-6.76, -38.23),
    # Pernambuco
    "Recife-PE": (-8.05, -34.87), "Jaboatão dos Guararapes-PE": (-8.18, -35.00), "Olinda-PE": (-8.01, -34.86),
    "Caruaru-PE": (-8.28, -35.97), "Petrolina-PE": (-9.39, -40.50), "Paulista-PE": (-7.94, -34.87), "Garanhuns-PE": (-8.89, -36.50),
    # Piauí
    "Teresina-PI": (-5.09, -42.80), "Parnaíba-PI": (-2.90, -41.78), "Picos-PI": (-7.08, -41.47), "Floriano-PI": (-6.77, -43.02),
    # Paraná
    "Curitiba-PR": (-25.43, -49.27), "Londrina-PR": (-23.31, -51.16), "Maringá-PR": (-23.42, -51.94),
    "Ponta Grossa-PR": (-25.09, -50.16), "Cascavel-PR": (-24.96, -53.46), "Foz do Iguaçu-PR": (-25.55, -54.59),
    "São José dos Pinhais-PR": (-25.54, -49.21), "Guarapuava-PR": (-25.39, -51.46),
    # Rio de Janeiro
    "Rio de Janeiro-RJ": (-22.91, -43.17), "São Gonçalo-RJ": (-22.83, -43.05), "Duque de Caxias-RJ": (-22.79, -43.31),
    "Nova Iguaçu-RJ": (-22.76, -43.45), "Niterói-RJ": (-22.88, -43.10), "Belford Roxo-RJ": (-22.76, -43.40),
    "Campos dos Goytacazes-RJ": (-21.75, -41.32), "Petrópolis-RJ": (-22.51, -43.18),
    "Volta Redonda-RJ": (-22.52, -44.10), "Macaé-RJ": (-22.37, -41.79), "Angra dos Reis-RJ": (-23.01, -44.32),
    # Rio Grande do Norte
    "Natal-RN": (-5.79, -35.21), "Mossoró-RN": (-5.19, -37.34), "Parnamirim-RN": (-5.91, -35.26), "São Gonçalo do Amarante-RN": (-5.79, -35.33),
    # Rondônia
    "Porto Velho-RO": (-8.76, -63.90), "Ji-Paraná-RO": (-10.88, -61.95), "Ariquemes-RO": (-9.91, -63.04), "Vilhena-RO": (-12.74, -60.15),
    # Roraima
    "Boa Vista-RR": (2.82, -60.67), "Rorainópolis-RR": (0.94, -60.44),
    # Rio Grande do Sul
    "Porto Alegre-RS": (-30.03, -51.23), "Caxias do Sul-RS": (-29.17, -51.18), "Canoas-RS": (-29.92, -51.17),
    "Pelotas-RS": (-31.77, -52.34), "Gravataí-RS": (-29.94, -50.99), "Santa Maria-RS": (-29.68, -53.81),
    "Novo Hamburgo-RS": (-29.69, -51.13), "Passo Fundo-RS": (-28.26, -52.41),
    # Santa Catarina
    "Florianópolis-SC": (-27.60, -48.55), "Joinville-SC": (-26.30, -48.85), "Blumenau-SC": (-26.92, -49.07),
    "Chapecó-SC": (-27.10, -52.62), "Itajaí-SC": (-26.91, -48.66), "São José-SC": (-27.61, -48.64),
    "Criciúma-SC": (-28.68, -49.37), "Lages-SC": (-27.82, -50.33),
    # Sergipe
    "Aracaju-SE": (-10.91, -37.07), "Nossa Senhora do Socorro-SE": (-10.86, -37.13),
    "Lagarto-SE": (-10.92, -37.65), "Itabaiana-SE": (-10.69, -37.43),
    # São Paulo
    "São Paulo-SP": (-23.55, -46.63), "Guarulhos-SP": (-23.46, -46.53), "Campinas-SP": (-22.91, -47.06),
    "São Bernardo do Campo-SP": (-23.69, -46.56), "Santo André-SP": (-23.67, -46.54), "Osasco-SP": (-23.53, -46.79),
    "Santos-SP": (-23.96, -46.33), "São José dos Campos-SP": (-23.18, -45.88), "Ribeirão Preto-SP": (-21.18, -47.81),
    "Sorocaba-SP": (-23.50, -47.46), "Piracicaba-SP": (-22.73, -47.65), "Bauru-SP": (-22.31, -49.07),
    "Marília-SP": (-22.21, -49.95), "Presidente Prudente-SP": (-22.13, -51.39), "Araçatuba-SP": (-21.21, -50.43),
    "Botucatu-SP": (-22.89, -48.44), "Itu-SP": (-23.26, -47.30),
    # Tocantins
    "Palmas-TO": (-10.18, -48.33), "Araguaína-TO": (-7.19, -48.21), "Gurupi-TO": (-11.73, -49.07), "Porto Nacional-TO": (-10.71, -48.42),
}

# Coastal cities for area_type override
COASTAL_CITIES = {
    "Santos", "Vitória", "Vila Velha", "Florianópolis", "Natal", "Maceió", "Aracaju",
    "São Luís", "Belém", "Macapá", "Fortaleza", "Recife", "Salvador", "Rio de Janeiro",
    "Niterói", "João Pessoa", "Olinda", "Ilhéus", "Itajaí", "Parnaíba", "Angra dos Reis",
    "Macaé", "Itapipoca", "Cachoeiro de Itapemirim", "Linhares", "Campos dos Goytacazes",
    "Pelotas", "Paulista", "Camaçari", "Serra", "Cariacica",
}


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4: DATA POOLS
# ══════════════════════════════════════════════════════════════════════════════

# --- Occupations by tier ---
OCCUPATIONS = {
    "top": [
        ("CEO", "Gestão Empresarial"), ("CTO", "Tecnologia"), ("Diretor Financeiro", "Finanças"),
        ("Cirurgião", "Saúde"), ("Juiz", "Direito"), ("Desembargador", "Direito"),
        ("Diretor de Marketing", "Marketing"), ("VP de Vendas", "Comercial"),
        ("Empresário", "Negócios Próprios"), ("Sócio de Escritório", "Direito"),
        ("Gestor de Fundos", "Finanças"), ("Diretor de Engenharia", "Tecnologia"),
        ("Consultor Estratégico", "Consultoria"), ("Médico Especialista", "Saúde"),
        ("Diretor de Hospital", "Saúde"), ("Fazendeiro/Agropecuarista", "Agronegócio"),
    ],
    "high": [
        ("Engenheiro de Software", "Tecnologia"), ("Médico Clínico", "Saúde"),
        ("Advogado", "Direito"), ("Gerente de Projetos", "Gestão"),
        ("Analista de Dados Sênior", "Tecnologia"), ("Arquiteto", "Construção Civil"),
        ("Economista", "Finanças"), ("Psicólogo Clínico", "Saúde"),
        ("Professor Universitário", "Educação"), ("Gerente Comercial", "Comercial"),
        ("Engenheiro Civil", "Construção Civil"), ("Dentista", "Saúde"),
        ("Farmacêutico", "Saúde"), ("Veterinário", "Saúde/Agro"),
        ("Contador Sênior", "Finanças"), ("Designer UX Sênior", "Tecnologia"),
        ("Gerente de RH", "Gestão"), ("Nutricionista", "Saúde"),
        ("Fisioterapeuta", "Saúde"), ("Analista de Investimentos", "Finanças"),
    ],
    "mid": [
        ("Analista de Marketing", "Marketing"), ("Professor", "Educação"),
        ("Enfermeiro", "Saúde"), ("Técnico de TI", "Tecnologia"),
        ("Policial Militar", "Segurança Pública"), ("Contador", "Finanças"),
        ("Designer Gráfico", "Comunicação"), ("Vendedor", "Comercial"),
        ("Corretor de Imóveis", "Imobiliário"), ("Técnico de Enfermagem", "Saúde"),
        ("Servidor Público", "Governo"), ("Assistente Social", "Social"),
        ("Eletricista", "Serviços"), ("Mecânico Especializado", "Automotivo"),
        ("Cabeleireiro/Barbeiro", "Beleza"), ("Fotógrafo", "Comunicação"),
        ("Auxiliar Administrativo", "Administração"), ("Recepcionista", "Serviços"),
        ("Técnico em Segurança do Trabalho", "Segurança"), ("Agente de Saúde", "Saúde"),
        ("Motoboy/Entregador", "Logística"), ("Vigilante", "Segurança"),
        ("Operador de Máquinas", "Indústria"), ("Soldador", "Indústria"),
    ],
    "low": [
        ("Atendente", "Comércio"), ("Operador de Caixa", "Comércio"),
        ("Motorista de App", "Transporte"), ("Diarista", "Serviços Domésticos"),
        ("Pedreiro", "Construção Civil"), ("Cozinheiro", "Alimentação"),
        ("Porteiro", "Serviços"), ("Faxineiro", "Serviços"),
        ("Ajudante de Obra", "Construção Civil"), ("Manicure", "Beleza"),
        ("Catador de Recicláveis", "Reciclagem"), ("Ambulante", "Comércio Informal"),
        ("Lavadeira", "Serviços Domésticos"), ("Auxiliar de Cozinha", "Alimentação"),
        ("Servente", "Construção Civil"), ("Pescador", "Pesca"),
        ("Agricultor Familiar", "Agricultura"), ("Costureira", "Confecção"),
        ("Garçom/Garçonete", "Alimentação"), ("Balconista", "Comércio"),
    ],
}

OCCUPATION_TIER_BY_CLASS = {
    "A": "top", "B1": "high", "B2": "high",
    "C1": "mid", "C2": "mid", "D": "low", "E": "low",
}

SECTORS_BY_REGION = {
    "Norte": ["Extrativismo", "Mineração", "Governo", "Comércio", "Agronegócio", "Zona Franca"],
    "Nordeste": ["Turismo", "Comércio", "Governo", "Agricultura", "Indústria", "Serviços"],
    "Centro-Oeste": ["Agronegócio", "Governo", "Comércio", "Serviços", "Logística"],
    "Sudeste": ["Tecnologia", "Finanças", "Indústria", "Serviços", "Comércio", "Saúde"],
    "Sul": ["Indústria", "Agronegócio", "Cooperativismo", "Tecnologia", "Comércio", "Turismo"],
}

COMPANIES_BY_REGION = {
    "Norte": ["Governo do Estado", "Autônomo", "Comércio local", "Hospital público", "Escola municipal", "Zona Franca de Manaus", "Startup local", "Mineradora", "Cooperativa agrícola"],
    "Nordeste": ["Governo do Estado", "Autônomo", "Hotel/Pousada", "Comércio local", "Hospital público", "Universidade Federal", "Startup local", "Shopping local", "Cooperativa"],
    "Centro-Oeste": ["Governo Federal", "Autônomo", "Fazenda/Agro", "Comércio local", "Hospital", "Universidade", "Cargill/ADM", "JBS/BRF", "Startup local"],
    "Sudeste": ["Autônomo", "Itaú Unibanco", "Petrobras", "Magazine Luiza", "iFood", "Nubank", "Hospital Sírio-Libanês", "Embraer", "Vale", "Natura", "Startup", "Comércio próprio", "Hospital/Clínica", "Escola particular", "TOTVS", "Ambev"],
    "Sul": ["Autônomo", "Cooperativa", "WEG", "Sadia/BRF", "Randon", "Aurora Alimentos", "Comércio local", "Hospital", "Universidade", "Startup local", "Indústria local"],
}

# --- Hard Skills by sector ---
HARD_SKILLS = {
    "Tecnologia": ["Python/JavaScript", "SQL/Bancos de Dados", "Cloud (AWS/GCP)", "Machine Learning", "DevOps/CI-CD", "React/Angular", "Arquitetura de Software", "Cybersecurity"],
    "Saúde": ["Diagnóstico Clínico", "Procedimentos Cirúrgicos", "Farmacologia", "Gestão Hospitalar", "Bioética", "Prontuário Eletrônico", "Urgência e Emergência"],
    "Finanças": ["Análise Financeira", "Contabilidade (IFRS)", "Gestão de Riscos", "Mercado de Capitais", "Planejamento Tributário", "Excel Avançado", "Power BI/Tableau"],
    "Direito": ["Direito Civil", "Direito Trabalhista", "Direito Tributário", "Oratória Jurídica", "Processo Civil", "Mediação e Arbitragem"],
    "Educação": ["Didática", "Gestão de Sala de Aula", "Avaliação Pedagógica", "Tecnologia Educacional", "Inclusão Escolar", "Planejamento Curricular"],
    "Marketing": ["Google Ads/Meta Ads", "SEO/SEM", "CRM (HubSpot/Salesforce)", "Analytics", "Copywriting", "Branding", "Social Media Management"],
    "Gestão": ["Gestão de Projetos (PMI)", "Lean/Six Sigma", "OKRs/KPIs", "Gestão de Pessoas", "Planejamento Estratégico", "Negociação"],
    "Comércio": ["Vendas B2B/B2C", "Gestão de Estoque", "Visual Merchandising", "Atendimento ao Cliente", "Técnicas de Negociação"],
    "Construção Civil": ["AutoCAD", "Revit/BIM", "Cálculo Estrutural", "Orçamento de Obras", "Normas ABNT", "Gestão de Obras"],
    "Agronegócio": ["Gestão de Safra", "Agricultura de Precisão", "Manejo Animal", "Logística Agrícola", "Defensivos e Fertilizantes"],
    "Governo": ["Legislação Pública", "Gestão Pública", "Licitações", "Compliance", "Planejamento Orçamentário"],
    "default": ["Excel/Planilhas", "Atendimento ao Cliente", "Organização", "Informática Básica", "Comunicação Escrita"],
}

SOFT_SKILLS = [
    ("Liderança", 5, 10), ("Comunicação", 4, 10), ("Trabalho em Equipe", 3, 10),
    ("Resolução de Problemas", 4, 10), ("Criatividade", 3, 9), ("Empatia", 2, 10),
    ("Gestão de Tempo", 3, 9), ("Adaptabilidade", 3, 9), ("Negociação", 2, 9),
    ("Paciência", 1, 9), ("Pensamento Crítico", 3, 9), ("Inteligência Emocional", 2, 9),
    ("Proatividade", 3, 10), ("Resiliência", 3, 9), ("Organização", 2, 9),
    ("Assertividade", 2, 9), ("Escuta Ativa", 2, 9), ("Flexibilidade", 3, 9),
]

# --- Psychology ---
ZODIAC_SIGNS = ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"]

ARCHETYPES = [
    "O Inocente", "O Sábio", "O Explorador", "O Rebelde", "O Mago", "O Herói",
    "O Amante", "O Comediante", "O Cidadão Comum", "O Cuidador", "O Governante", "O Criador",
]

CORE_VALUES_POOL = [
    "Família", "Fé", "Ordem", "Justiça", "Igualdade", "Empatia", "Conhecimento", "Verdade",
    "Racionalidade", "Equilíbrio", "Diálogo", "Harmonia", "Liberdade", "Mérito", "Inovação",
    "Segurança", "Tradição", "Respeito", "Progresso", "Criatividade", "Autonomia",
    "Comunidade", "Solidariedade", "Cuidado", "Sucesso", "Eficiência", "Estética",
    "Honestidade", "Lealdade", "Coragem", "Disciplina", "Saúde", "Educação",
    "Prosperidade", "Paz", "Espiritualidade", "Natureza", "Aventura", "Simplicidade",
]

COGNITIVE_BIASES = [
    "Viés de Confirmação", "Viés de Autoridade", "Efeito Halo", "Viés de Ancoragem",
    "Efeito Dunning-Kruger", "Viés de Disponibilidade", "Efeito de Dotação",
    "Viés de Grupo", "Viés de Status Quo", "Viés Otimista", "Efeito de Enquadramento",
    "Viés de Retrospectiva", "Falácia do Custo Irrecuperável", "Viés de Negatividade",
    "Efeito Bandwagon", "Viés de Atribuição", "Viés de Sobrevivência",
    "Ilusão de Controle", "Viés de Proximidade", "Viés de Recência",
]

AVERSIONS = [
    "Ineficiência/Lerdeza", "Desorganização", "Conteúdo Superficial", "Mentira/Falsidade",
    "Barulho Excessivo", "Desrespeito", "Injustiça", "Falta de Pontualidade",
    "Fofoca", "Arrogância", "Preguiça", "Grosseria", "Trânsito", "Burocracia",
    "Corrupção", "Falta de Educação", "Hipocrisia", "Ingratidão", "Violência",
    "Poluição/Lixo", "Preconceito", "Desperdício de Comida", "Gente Falsa",
    "Falta de Empatia", "Cobrança Excessiva", "Excesso de Tecnologia",
    "Desigualdade Social", "Falta de Respeito aos Idosos", "Abandono de Animais",
]

OBJECTIONS = [
    "Falta de Tempo", "Desconfiança de Promessas Mágicas", "Complexidade de Implementação",
    "Custo Alto", "Não Vejo Necessidade", "Já Tentei e Não Funcionou",
    "Prefiro Fazer do Meu Jeito", "Medo de Mudança", "Falta de Prova Social",
    "Não Confio na Marca", "É Muito Complicado", "Preciso Pensar Mais",
    "Não É Prioridade Agora", "Já Tenho Algo Similar", "Receio de Arrependimento",
]

# --- Lifestyle ---
HOBBIES_POOL = {
    "young_urban": ["Games", "Séries/Netflix", "TikTok", "Skateboarding", "Festas/Baladas", "Viagens", "Fotografia", "Música/Playlist", "Anime/Mangá", "E-sports"],
    "young_active": ["Academia", "Corrida", "Surf", "Beach Tennis", "Crossfit", "Trilhas", "Ciclismo", "Escalada", "Slackline", "Parkour"],
    "adult_urban": ["Leitura", "Restaurantes", "Viagens", "Cinema", "Podcast", "Investimentos", "Yoga", "Pilates", "Networking", "Cursos Online"],
    "adult_family": ["Churrasco", "Futebol", "Culinária", "Jardinagem", "Artesanato", "Pesca", "Igreja", "Passeios com Filhos", "Cuidar da Casa", "Assistir TV"],
    "elder": ["Caminhada", "Jardinagem", "Crochê/Tricô", "Palavras Cruzadas", "Assistir TV", "Igreja", "Cuidar de Netos", "Leitura", "Rádio", "Dominó/Cartas"],
    "rural": ["Pesca", "Caça", "Cavalgada", "Rodeio", "Cuidar de Animais", "Agricultura", "Forró/Música Regional", "Futebol de Várzea", "Igreja", "Feira/Mercado"],
}

SOCIAL_MEDIA_BY_GEN = {
    "Gen Z": [["TikTok", "Instagram", "WhatsApp"], ["Instagram", "YouTube", "WhatsApp"], ["TikTok", "Twitter/X", "WhatsApp", "Discord"]],
    "Millennial": [["Instagram", "LinkedIn", "WhatsApp"], ["Instagram", "Twitter/X", "WhatsApp"], ["LinkedIn", "WhatsApp", "YouTube"]],
    "Gen X": [["Facebook", "WhatsApp", "Instagram"], ["WhatsApp", "YouTube", "Facebook"], ["LinkedIn", "WhatsApp", "Facebook"]],
    "Boomer": [["Facebook", "WhatsApp"], ["WhatsApp", "YouTube"], ["Facebook", "WhatsApp", "Instagram"]],
}

HABITS_POOL = [
    "Exercício regular", "Leitura diária", "Meditação", "Skincare", "Caminhada matinal",
    "Oração/Devoção", "Organização do dia (to-do list)", "Cozinhar em casa", "Beber água",
    "Networking semanal", "Estudo contínuo", "Diário/Journaling", "Voluntariado",
    "Alimentação saudável", "Dormir cedo", "Gratidão diária", "Arrumar a cama",
    "Economia mensal", "Ler notícias", "Fazer exercícios de respiração",
]

ADDICTIONS_POOL = [
    ("Café/Cafeína", 3, 10), ("Redes Sociais (Doomscrolling)", 3, 10), ("Cigarro", 2, 9),
    ("Álcool", 2, 9), ("Açúcar/Doces", 3, 9), ("Celular", 4, 10),
    ("Delivery de Comida (iFood)", 3, 9), ("Netflix/Streaming", 3, 9), ("Jogos/Games", 2, 9),
    ("Compras Online", 2, 8), ("Chimarrão/Tereré", 3, 10), ("Refrigerante", 2, 8),
    ("Apostas/Bets", 2, 8), ("Fofoca/Redes de fofoca", 2, 7), ("Cerveja", 2, 9),
]

# --- Health ---
PHYSICAL_ACTIVITIES = [
    ("Caminhada", "Saúde e bem-estar"), ("Academia/Musculação", "Hipertrofia e Saúde"),
    ("Corrida", "Cardio e Resistência"), ("Futebol", "Social e Cardio"),
    ("Natação", "Cardio e Reabilitação"), ("Yoga", "Flexibilidade e Mental"),
    ("Pilates", "Postura e Core"), ("Ciclismo", "Cardio e Transporte"),
    ("Beach Tennis", "Social e Cardio"), ("Crossfit", "Condicionamento Geral"),
    ("Dança", "Social e Cardio"), ("Luta/Artes Marciais", "Defesa e Condicionamento"),
    ("Vôlei", "Social e Cardio"), ("Hidroginástica", "Reabilitação e Social"),
    ("Alongamento", "Flexibilidade"), ("Nenhuma (Sedentário)", "Nenhum"),
]

LEISURE_ACTIVITIES = [
    "Restaurantes", "Cinema", "Teatro", "Shopping", "Viagens nacionais",
    "Viagens internacionais", "Praia", "Parques", "Festas/Eventos", "Shows/Concertos",
    "Barzinhos", "Feira gastronômica", "Museus/Exposições", "Churrasco em casa",
    "Piquenique", "Pescaria", "Acampamento", "Spa/Day Use", "Karaokê",
    "Passeio no campo", "Visitar parentes", "Cuidar do jardim", "Assistir futebol",
]

CHRONIC_CONDITIONS_BY_AGE = {
    "young": [[], ["Ansiedade"], ["Asma"], ["Enxaqueca"], ["Rinite alérgica"], ["Acne persistente"]],
    "adult": [[], ["Ansiedade"], ["Hipertensão leve"], ["Enxaqueca tensional"], ["Gastrite nervosa"], ["Lombalgia"], ["Depressão leve"], ["Colesterol elevado"], ["Insônia"]],
    "elder": [["Hipertensão"], ["Diabetes tipo 2"], ["Artrose"], ["Hipertensão", "Diabetes tipo 2"], ["Colesterol alto"], ["Artrite"], ["Osteoporose"], ["Problema cardíaco"], ["Hipertensão", "Colesterol alto"]],
}

# --- History/Biography ---
BIOGRAPHY_CONTEXTS = {
    "A": ["Família tradicional da elite local", "Família de empresários bem-sucedidos", "Pais profissionais liberais renomados", "Herdeiro(a) de negócio familiar"],
    "B1": ["Classe média alta com boa educação", "Família de profissionais liberais", "Cresceu em bairro nobre", "Pais servidores públicos de alto escalão"],
    "B2": ["Classe média com esforço dos pais", "Família estável com bons valores", "Cresceu em bairro de classe média", "Pais trabalhadores com foco na educação dos filhos"],
    "C1": ["Família batalhadora que buscou ascensão social", "Cresceu em bairro popular mas organizado", "Pais comerciantes", "Família de trabalhadores com ambição"],
    "C2": ["Família humilde mas digna", "Cresceu em comunidade periférica", "Pais trabalhadores informais", "Família grande com poucos recursos"],
    "D": ["Família em situação de vulnerabilidade", "Cresceu em periferia com dificuldades", "Pais com trabalho informal", "Infância marcada por dificuldades financeiras"],
    "E": ["Família em extrema pobreza", "Cresceu em zona rural ou periferia muito carente", "Pais analfabetos ou semianalfabetos", "Infância com insegurança alimentar"],
}

EDUCATION_PATHS = {
    "Fundamental incompleto": ["Abandonou os estudos cedo para trabalhar", "Não teve oportunidade de completar os estudos", "Trabalhou desde criança ajudando a família"],
    "Fundamental completo": ["Completou o ensino fundamental com dificuldade", "Estudou em escola pública da região", "Concluiu os estudos básicos entre idas e vindas"],
    "Médio incompleto": ["Interrompeu o ensino médio por necessidade financeira", "Ainda pretende concluir o ensino médio", "Parou de estudar para trabalhar em tempo integral"],
    "Médio completo": ["Concluiu o ensino médio em escola pública", "Formou-se no ensino médio técnico", "Terminou os estudos no EJA (supletivo)"],
    "Superior incompleto": ["Começou a faculdade mas trancou", "Está cursando ensino superior", "Não conseguiu concluir a graduação por falta de recursos"],
    "Superior completo": ["Graduou-se pela universidade da região", "Concluiu o ensino superior com bolsa de estudos", "Formou-se em universidade particular"],
    "Mestrado": ["Possui mestrado acadêmico na área de atuação", "Concluiu pós-graduação stricto sensu", "Seguiu carreira acadêmica com mestrado"],
    "Doutorado": ["Doutor(a) pela universidade de referência", "Pesquisador(a) com doutorado na área", "Carreira acadêmica com doutorado e publicações"],
}

DREAMS_POOL = {
    "young": ["Fazer intercâmbio/morar fora", "Abrir o próprio negócio", "Se formar na faculdade", "Conseguir um bom emprego", "Ser influenciador digital", "Ter estabilidade financeira", "Viajar o mundo"],
    "adult": ["Comprar a casa própria", "Ter independência financeira", "Dar boa educação aos filhos", "Crescer na carreira/ser promovido", "Abrir o próprio negócio", "Fazer um sabático", "Mudar de área profissional"],
    "elder": ["Ver os filhos/netos bem na vida", "Aproveitar a aposentadoria", "Viajar com a família", "Ter saúde para aproveitar a vida", "Deixar um legado", "Conhecer a Terra Santa", "Ter paz e tranquilidade"],
}

SHORT_TERM_GOALS = {
    "young": ["Passar no vestibular/concurso", "Conseguir o primeiro emprego", "Tirar carteira de motorista", "Mudar de cidade", "Aprender inglês"],
    "adult": ["Ser promovido", "Economizar para investir", "Trocar de carro", "Reformar a casa", "Fazer um curso de especialização", "Mudar de emprego"],
    "elder": ["Fazer um check-up completo", "Organizar a aposentadoria", "Reformar a casa", "Cuidar da saúde", "Passar mais tempo com a família"],
}

FAMILY_DYNAMICS = {
    "close": "Relação próxima e afetuosa com a família",
    "distant": "Relação distante com pouco contato familiar",
    "conflictual": "Relação conflituosa com histórico de desentendimentos",
    "dependent": "Relação de dependência emocional com a família",
    "protective": "Relação protetora, é o pilar emocional da família",
    "respectful": "Relação baseada em respeito mútuo e tradição",
}

TRAUMAS_POOL = [
    ("Perda de familiar próximo", ["datas comemorativas", "hospitais"], 5, 10),
    ("Bullying na escola/trabalho", ["ambientes escolares", "exclusão social"], 3, 8),
    ("Dificuldades financeiras severas", ["dívidas", "desemprego", "contas"], 4, 9),
    ("Término de relacionamento importante", ["músicas", "lugares que frequentavam"], 3, 8),
    ("Burnout/esgotamento profissional", ["pressão no trabalho", "prazos"], 4, 9),
    ("Experiência de violência urbana", ["ruas escuras", "barulhos altos"], 5, 10),
    ("Doença grave na família", ["hospitais", "diagnósticos"], 5, 9),
    ("Abandono parental", ["rejeição", "figuras de autoridade"], 6, 10),
    ("Acidente de trânsito", ["trânsito intenso", "velocidade"], 3, 8),
    ("Discriminação/preconceito", ["ambientes hostis", "comentários"], 4, 9),
    ("Pandemia COVID-19 (perdas/isolamento)", ["lockdown", "máscaras"], 3, 8),
    ("Enchente/desastre natural", ["chuvas fortes", "sirenes"], 4, 9),
    ("Desemprego prolongado", ["entrevistas", "cobranças"], 4, 9),
    ("Divórcio dos pais na infância", ["discussões", "mudanças"], 4, 8),
    ("Experiência de assédio", ["ambientes de trabalho", "situações de poder"], 5, 10),
]

HISTORICAL_EVENTS = [
    ("Eleições 2022 (Lula x Bolsonaro)", "Política brasileira polarizada"),
    ("Pandemia COVID-19 (2020-2022)", "Isolamento social e perdas"),
    ("Copa do Mundo 2022 (Qatar)", "Futebol e identidade nacional"),
    ("Manifestações de Junho/2013", "Insatisfação popular com a política"),
    ("Impeachment de Dilma (2016)", "Crise política e institucional"),
    ("Boom das Startups (2018-2021)", "Transformação digital e novas carreiras"),
    ("Invasão do 8 de Janeiro (2023)", "Ataque à democracia"),
    ("Enchentes no RS (2024)", "Tragédia climática e solidariedade"),
    ("Crise Hídrica (2021)", "Impacto no dia a dia e contas de luz"),
    ("Pix e revolução bancária (2020+)", "Inclusão financeira digital"),
    ("Lava Jato e combate à corrupção", "Esperança e descrença na Justiça"),
    ("Reforma Trabalhista (2017)", "Mudanças nas relações de trabalho"),
    ("Crescimento do Agronegócio", "Expansão econômica no interior"),
    ("Ascensão das redes sociais no Brasil", "Mudança na forma de comunicação"),
]

RECENT_EVENTS_POOL = [
    "Mudança de emprego", "Mudança de cidade/bairro", "Nascimento de filho(a)",
    "Término de relacionamento", "Início de relacionamento", "Promoção no trabalho",
    "Perda de emprego", "Doença na família", "Compra da casa própria",
    "Início de um curso/faculdade", "Viagem marcante", "Conflito familiar",
    "Início de terapia", "Troca de carro", "Problemas de saúde",
    "Reconciliação familiar", "Abertura de negócio próprio", "Aposentadoria",
    "Casamento/União", "Formatura", "Falecimento de pessoa próxima",
]

POLITICAL_VALUES = {
    "Esquerda": "Justiça Social e Igualdade",
    "Centro-Esquerda": "Direitos Sociais com Responsabilidade Fiscal",
    "Extrema Esquerda": "Revolução Social e Redistribuição Radical",
    "Direita": "Ordem, Família e Livre Mercado",
    "Centro-Direita": "Conservadorismo Moderado e Economia Liberal",
    "Extrema Direita": "Nacionalismo, Tradição e Lei Dura",
    "Centro": "Pragmatismo e Equilíbrio entre Pautas",
    "Centro-Liberal": "Liberdade Econômica e Pautas Sociais",
    "Apolítico": "Não se identifica com nenhum espectro",
    "Libertário": "Liberdade Individual e Mínimo Estado",
}

TABUS_BY_RELIGION = {
    "Católico": ["Aborto", "Divórcio", "Infidelidade"],
    "Evangélico/Protestante": ["Homossexualidade", "Aborto", "Vícios", "Idolatria"],
    "Espírita (Kardecista)": ["Materialismo excessivo", "Suicídio"],
    "Ateu/Agnóstico": ["Dogmatismo religioso", "Censura"],
    "Espiritualidade Eclética": ["Negatividade", "Materialismo"],
    "Matriz Africana (Candomblé/Umbanda)": ["Intolerância religiosa", "Desrespeito aos Orixás"],
    "Judaísmo": ["Não-kosher", "Trabalho no Shabat"],
    "Islamismo": ["Haram", "Desonra familiar"],
    "Outros": ["Varia conforme a crença"],
}

RELIGION_DETAIL = {
    "Católico": "Católica Apostólica Romana",
    "Evangélico/Protestante": ["Assembleia de Deus", "Igreja Universal", "Igreja Batista", "Presbiteriana", "Metodista", "Adventista", "Sara Nossa Terra", "Renascer em Cristo"],
    "Espírita (Kardecista)": "Espiritismo Kardecista",
    "Ateu/Agnóstico": "Sem filiação religiosa",
    "Espiritualidade Eclética": "Espiritualidade moderna (Astrologia/Yoga/Meditação)",
    "Matriz Africana (Candomblé/Umbanda)": ["Candomblé", "Umbanda"],
    "Judaísmo": "Judaísmo",
    "Islamismo": "Islamismo Sunita",
    "Outros": ["Budismo", "Hinduísmo", "Wicca", "Santo Daime", "Testemunhas de Jeová"],
}


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5: HELPER / MAPPING FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def seed_random(persona_id: str):
    """Seed random based on persona_id for deterministic generation."""
    h = int(hashlib.md5(persona_id.encode()).hexdigest(), 16)
    random.seed(h)


def pick(lst):
    return random.choice(lst) if lst else None


def pick_weighted(options):
    """Pick from list of (value, weight) tuples."""
    values, weights = zip(*options)
    return random.choices(values, weights=weights, k=1)[0]


def rand_int(lo, hi):
    return random.randint(lo, hi)


def rand_float(lo, hi, decimals=1):
    return round(random.uniform(lo, hi), decimals)


def get_generation(age):
    if age <= 28: return "Gen Z"
    if age <= 44: return "Millennial"
    if age <= 60: return "Gen X"
    return "Boomer"


def get_age_group(age):
    if age <= 30: return "young"
    if age <= 60: return "adult"
    return "elder"


def map_education(escolaridade_detalhada):
    mapping = {
        "Fundamental incompleto": "Fundamental",
        "Fundamental completo": "Fundamental",
        "Médio incompleto": "Médio",
        "Médio completo": "Médio",
        "Superior incompleto": "Superior Incompleto",
        "Superior completo": "Superior Completo",
        "Mestrado": "Mestrado/Doutorado",
        "Doutorado": "Mestrado/Doutorado",
    }
    return mapping.get(escolaridade_detalhada, "Médio")


def map_religion(religiao):
    if religiao == "Católica":
        return "Católico"
    elif religiao == "Evangélica":
        return "Evangélico/Protestante"
    elif religiao == "Sem religião":
        return pick_weighted([("Ateu/Agnóstico", 70), ("Espiritualidade Eclética", 30)])
    elif religiao == "Outras":
        return pick_weighted([
            ("Espírita (Kardecista)", 40), ("Espiritualidade Eclética", 25),
            ("Matriz Africana (Candomblé/Umbanda)", 15), ("Judaísmo", 5), ("Islamismo", 5), ("Outros", 10),
        ])
    return "Outros"


def map_political(voto_2022):
    if voto_2022 == "Lula":
        return pick_weighted([
            ("Esquerda", 35), ("Centro-Esquerda", 40), ("Extrema Esquerda", 8), ("Centro", 17),
        ])
    elif voto_2022 == "Bolsonaro":
        return pick_weighted([
            ("Direita", 35), ("Centro-Direita", 35), ("Extrema Direita", 10),
            ("Centro", 10), ("Libertário", 10),
        ])
    else:  # Branco/Nulo
        return pick_weighted([
            ("Centro", 25), ("Centro-Liberal", 25), ("Apolítico", 30),
            ("Libertário", 10), ("Centro-Esquerda", 5), ("Centro-Direita", 5),
        ])


def map_area_type(porte, city):
    if porte == "Capital":
        return "Capital/Metrópole"
    elif porte == "Grande":
        return "Capital/Metrópole"
    elif porte == "Médio":
        if city in COASTAL_CITIES:
            return "Litoral"
        return "Urbana/Interior"
    else:  # Pequeno
        if city in COASTAL_CITIES:
            return "Litoral"
        return pick_weighted([("Urbana/Interior", 70), ("Rural", 30)])


def get_civil_status(age):
    for (lo, hi), options in CIVIL_STATUS_BY_AGE.items():
        if lo <= age <= hi:
            return pick_weighted(options)
    return "Solteiro"


def get_ethnicity(region):
    dist = ETHNICITY_BY_REGION.get(region, ETHNICITY_BY_REGION["Sudeste"])
    return pick_weighted(list(dist.items()))


def get_coords(city, state):
    key = f"{city}-{state}"
    if key in CITY_COORDS:
        lat, lng = CITY_COORDS[key]
        # Add small random offset for variety
        lat += random.uniform(-0.05, 0.05)
        lng += random.uniform(-0.05, 0.05)
        return round(lat, 6), round(lng, 6)
    # Fallback: use state capital with larger offset
    for k, v in CITY_COORDS.items():
        if k.endswith(f"-{state}"):
            lat, lng = v
            lat += random.uniform(-0.5, 0.5)
            lng += random.uniform(-0.5, 0.5)
            return round(lat, 6), round(lng, 6)
    return -15.79, -47.88  # Brasília fallback


def get_archetype(political, religion, social_class, age):
    """Assign archetype based on demographics."""
    # Right-leaning + traditional
    if political in ("Direita", "Centro-Direita", "Extrema Direita"):
        if religion in ("Católico", "Evangélico/Protestante"):
            return pick_weighted([
                ("O Governante", 25), ("O Cidadão Comum", 30), ("O Cuidador", 20), ("O Herói", 15), ("O Inocente", 10),
            ])
        return pick_weighted([
            ("O Governante", 30), ("O Explorador", 25), ("O Criador", 20), ("O Herói", 15), ("O Cidadão Comum", 10),
        ])
    # Left-leaning
    if political in ("Esquerda", "Centro-Esquerda", "Extrema Esquerda"):
        return pick_weighted([
            ("O Rebelde", 20), ("O Cuidador", 25), ("O Herói", 15), ("O Sábio", 15), ("O Cidadão Comum", 15), ("O Comediante", 10),
        ])
    # Center/Liberal
    if political in ("Centro", "Centro-Liberal", "Libertário"):
        return pick_weighted([
            ("O Sábio", 20), ("O Explorador", 20), ("O Cidadão Comum", 15), ("O Criador", 15), ("O Mago", 15), ("O Governante", 15),
        ])
    # Apolítico
    return pick_weighted([
        ("O Cidadão Comum", 35), ("O Inocente", 20), ("O Cuidador", 20), ("O Amante", 15), ("O Comediante", 10),
    ])


def get_disc(archetype, political):
    """Assign DISC factor based on archetype and political leaning."""
    archetype_disc = {
        "O Governante": "Dominância", "O Herói": "Dominância", "O Rebelde": "Dominância",
        "O Criador": "Dominância", "O Mago": "Influência",
        "O Comediante": "Influência", "O Amante": "Influência", "O Explorador": "Influência",
        "O Cidadão Comum": "Estabilidade", "O Inocente": "Estabilidade", "O Cuidador": "Estabilidade",
        "O Sábio": "Conformidade",
    }
    return archetype_disc.get(archetype, "Estabilidade")


def get_cronotype(age, social_class):
    if age <= 25:
        return pick_weighted([("Noturno/Night Owl", 50), ("Vespertino", 30), ("Matutino", 20)])
    elif age <= 50:
        return pick_weighted([("Matutino", 40), ("Vespertino", 30), ("Noturno/Night Owl", 30)])
    else:
        return pick_weighted([("Matutino", 60), ("Vespertino", 25), ("Noturno/Night Owl", 15)])


def get_height_weight(gender, age, social_class):
    """Generate realistic height/weight for Brazilian demographics."""
    if gender == "Feminino":
        height = rand_int(150, 175)
        base_weight = rand_int(48, 85)
    else:
        height = rand_int(160, 190)
        base_weight = rand_int(58, 105)
    # Age adjustment
    if age > 50:
        base_weight += rand_int(0, 10)
    return height, base_weight


def get_pico_energia(cronotype):
    if cronotype == "Matutino":
        return "06:00 - 12:00"
    elif cronotype == "Vespertino":
        return "12:00 - 18:00"
    return "18:00 - 01:00"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6: JSON GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

def generate_psychology_json(p):
    """Generate psychology_json matching Mariana Costa's structure."""
    archetype = p["archetype_primary"]
    disc_factor = p["disc_main_factor"]
    age = p["age"]
    political = p["political_leaning"]

    # DISC scores (1-10 scale like Mariana)
    disc = {"dominance": rand_int(2, 7), "influence": rand_int(2, 7), "compliance": rand_int(2, 7), "steadiness": rand_int(2, 7)}
    if disc_factor == "Dominância": disc["dominance"] = rand_int(7, 10)
    elif disc_factor == "Influência": disc["influence"] = rand_int(7, 10)
    elif disc_factor == "Estabilidade": disc["steadiness"] = rand_int(7, 10)
    elif disc_factor == "Conformidade": disc["compliance"] = rand_int(7, 10)

    # Big Five (1-10 scale)
    big_five = {
        "openness": rand_int(3, 10),
        "conscientiousness": rand_int(3, 10),
        "extraversion": rand_int(2, 10),
        "agreeableness": rand_int(2, 10),
        "neuroticism": rand_int(2, 9),
    }
    # Adjust Big Five based on archetype tendencies
    if archetype in ("O Rebelde", "O Explorador"):
        big_five["openness"] = max(big_five["openness"], rand_int(7, 10))
    if archetype in ("O Cidadão Comum", "O Cuidador"):
        big_five["agreeableness"] = max(big_five["agreeableness"], rand_int(6, 10))
    if archetype in ("O Sábio", "O Governante"):
        big_five["conscientiousness"] = max(big_five["conscientiousness"], rand_int(7, 10))

    # Enneagram
    enneagram_by_archetype = {
        "O Governante": (8, "7"), "O Herói": (1, "2"), "O Rebelde": (8, "9"),
        "O Sábio": (5, "6"), "O Explorador": (7, "8"), "O Mago": (4, "5"),
        "O Cuidador": (2, "1"), "O Cidadão Comum": (9, "1"), "O Inocente": (9, "8"),
        "O Amante": (4, "3"), "O Comediante": (7, "6"), "O Criador": (4, "5"),
    }
    enn = enneagram_by_archetype.get(archetype, (6, "5"))

    # Astrology (deterministic from name hash)
    sun_idx = hash(p["name"]) % 12
    moon_idx = (hash(p["name"] + "moon") % 12)
    rising_idx = (hash(p["name"] + "rising") % 12)

    # Core values (3 values)
    values_pool = list(CORE_VALUES_POOL)
    random.shuffle(values_pool)
    core_values = [{"value": values_pool[i], "priority": rand_int(6, 10)} for i in range(3)]
    core_values.sort(key=lambda x: x["priority"], reverse=True)

    # Outlook
    optimism = rand_int(3, 9)
    if political in ("Extrema Esquerda", "Extrema Direita"):
        optimism = max(2, optimism - 2)

    secondary = pick([a for a in ARCHETYPES if a != archetype])

    return {
        "outlook": {
            "optimism_level": optimism,
            "pessimism_level": max(1, 10 - optimism + rand_int(-1, 1)),
            "resilience_score": rand_int(4, 9),
        },
        "astrology": {
            "sun_sign": ZODIAC_SIGNS[sun_idx],
            "moon_sign": ZODIAC_SIGNS[moon_idx],
            "rising_sign": ZODIAC_SIGNS[rising_idx],
            "astrological_map_influence": rand_int(1, 8),
        },
        "enneagram": {
            "core_type": enn[0],
            "wing": enn[1],
            "integration_level": rand_int(3, 8),
        },
        "archetypes": {
            "primary": archetype,
            "secondary": secondary,
            "influence_level": rand_int(6, 10),
        },
        "core_values": core_values,
        "disc_profile": disc,
        "big_five_ocean": big_five,
    }


def generate_beliefs_json(p):
    """Generate beliefs_json matching Mariana Costa's structure."""
    religion = p["macro_religion"]
    political = p["political_leaning"]

    # Aversions (2-3)
    aversions_pool = list(AVERSIONS)
    random.shuffle(aversions_pool)
    aversoes = [{"alvo": aversions_pool[i], "nível": rand_int(5, 10)} for i in range(rand_int(2, 4))]
    aversoes.sort(key=lambda x: x["nível"], reverse=True)

    # Religion detail
    detail = RELIGION_DETAIL.get(religion, "Outra religião")
    if isinstance(detail, list):
        detail = pick(detail)
    tabus = TABUS_BY_RELIGION.get(religion, ["Desrespeito"])
    praticante = rand_int(1, 10) if religion not in ("Ateu/Agnóstico",) else rand_int(1, 3)
    dogmatica = rand_int(1, 10)
    if religion in ("Evangélico/Protestante",):
        dogmatica = max(5, dogmatica)
        praticante = max(4, praticante)
    elif religion in ("Ateu/Agnóstico",):
        dogmatica = min(3, dogmatica)

    # Cognitive biases (3-4)
    biases_pool = list(COGNITIVE_BIASES)
    random.shuffle(biases_pool)
    vieses = [{"nome": biases_pool[i], "nível": rand_int(3, 9)} for i in range(rand_int(3, 4))]

    # Objections (2-3)
    obj_pool = list(OBJECTIONS)
    random.shuffle(obj_pool)
    objecoes = [{"categoria": obj_pool[i], "força": rand_int(4, 10)} for i in range(rand_int(2, 3))]
    objecoes.sort(key=lambda x: x["força"], reverse=True)

    # Political engagement
    engajamento = rand_int(1, 10)
    polarizacao = rand_int(2, 8)
    if political in ("Extrema Esquerda", "Extrema Direita"):
        engajamento = max(6, engajamento)
        polarizacao = max(7, polarizacao)
    elif political in ("Apolítico",):
        engajamento = min(3, engajamento)
        polarizacao = min(3, polarizacao)

    valor_pol = POLITICAL_VALUES.get(political, "Valores diversos")

    return {
        "aversões": aversoes,
        "religião": {
            "fé_ou_doutrina": detail,
            "tabus_associados": random.sample(tabus, min(len(tabus), rand_int(1, 2))),
            "frequência_prática": praticante,
            "influência_dogmática": dogmatica,
        },
        "vieses_cognitivos": vieses,
        "objeções_padrões": objecoes,
        "orientação_política": {
            "espectro": political,
            "valor_prioritário": valor_pol,
            "engajamento_militante": engajamento,
            "nível_de_polarização": polarizacao,
        },
    }


def generate_career_json(p):
    """Generate career_json matching Mariana Costa's structure."""
    social_class = p["social_class"]
    education = p["education_level"]
    age = p["age"]
    region = p["region_br"]
    porte = p["_porte"]

    tier = OCCUPATION_TIER_BY_CLASS.get(social_class, "mid")
    occupation_data = pick(OCCUPATIONS[tier])
    cargo = occupation_data[0]
    area_principal = occupation_data[1]

    # Sector influenced by region
    regional_sectors = SECTORS_BY_REGION.get(region, SECTORS_BY_REGION["Sudeste"])
    setor = pick(regional_sectors)

    # Company
    companies = COMPANIES_BY_REGION.get(region, COMPANIES_BY_REGION["Sudeste"])
    empresa = pick(companies)

    # Experience years (based on age and education)
    if education in ("Superior Completo", "Mestrado/Doutorado", "Pós-Graduação/MBA"):
        start_age = 22
    elif education in ("Superior Incompleto",):
        start_age = 20
    else:
        start_age = 16
    max_exp = max(1, age - start_age)
    exp_years = rand_int(0, min(max_exp, 40))

    # Hard skills (3-4, based on sector)
    sector_key = area_principal if area_principal in HARD_SKILLS else "default"
    for key in HARD_SKILLS:
        if key.lower() in area_principal.lower() or key.lower() in setor.lower():
            sector_key = key
            break
    skills_pool = list(HARD_SKILLS.get(sector_key, HARD_SKILLS["default"]))
    random.shuffle(skills_pool)
    n_hard = rand_int(3, min(4, len(skills_pool)))
    hard_skills = [{"competência": skills_pool[i], "nível": rand_int(4, 10)} for i in range(n_hard)]

    # Soft skills (3-4)
    soft_pool = list(SOFT_SKILLS)
    random.shuffle(soft_pool)
    soft_skills = [{"competência": s[0], "nível": rand_int(s[1], s[2])} for s in soft_pool[:rand_int(3, 4)]]

    # Professional context
    satisfacao = rand_int(3, 9)
    ambicao = rand_int(3, 10)
    if social_class in ("A", "B1"):
        ambicao = max(6, ambicao)
    elif social_class in ("D", "E"):
        satisfacao = min(6, satisfacao)
    wlb = rand_int(2, 9)

    # Communication
    eloquencia = 5
    if education in ("Superior Completo", "Mestrado/Doutorado", "Pós-Graduação/MBA"):
        eloquencia = rand_int(6, 10)
    elif education == "Médio":
        eloquencia = rand_int(4, 7)
    else:
        eloquencia = rand_int(2, 5)

    regionalismo = rand_int(1, 5) if porte in ("Capital", "Grande") else rand_int(4, 9)
    formalidade = rand_int(6, 9) if social_class in ("A", "B1") else rand_int(3, 7) if social_class in ("B2", "C1") else rand_int(1, 5)
    jargao = rand_int(6, 10) if tier in ("top", "high") else rand_int(1, 5)

    return {
        "hard_skills": hard_skills,
        "soft_skills": soft_skills,
        "atuação_e_cargo": {
            "setor": setor,
            "cargo_atual": cargo,
            "área_principal": area_principal,
            "tempo_experiência_anos": exp_years,
        },
        "contexto_profissional": {
            "satisfação_carreira": satisfacao,
            "ambição_proffisional": ambicao,
            "equilíbrio_vida_trabalho": wlb,
        },
        "comunicação_e_linguagem": {
            "eloquência": eloquencia,
            "assertividade": rand_int(3, 9),
            "nível_formalidade": formalidade,
            "regionalismo_na_fala": regionalismo,
            "uso_de_jargão_técnico": jargao,
        },
    }


def generate_lifestyle_json(p):
    """Generate lifestyle_json matching Mariana Costa's structure."""
    age = p["age"]
    social_class = p["social_class"]
    generation = p["generation"]
    region = p["region_br"]
    cronotype = p["cronotype"]
    age_group = get_age_group(age)

    # Cronotype details
    pico = get_pico_energia(cronotype)
    qualidade_sono = rand_int(3, 8) if age < 50 else rand_int(2, 6)

    # Media consumption
    noticias = rand_int(3, 9)
    streaming = rand_int(4, 10) if age < 50 else rand_int(2, 7)
    midia_trad = rand_int(1, 5) if age < 40 else rand_int(4, 9)

    social_media = pick(SOCIAL_MEDIA_BY_GEN.get(generation, SOCIAL_MEDIA_BY_GEN["Millennial"]))

    # Hobbies
    hobby_key = "young_urban" if age < 30 else "adult_urban" if age < 55 else "elder"
    if region in ("Norte", "Nordeste") and social_class in ("D", "E"):
        hobby_key = "rural"
    elif age < 30 and social_class in ("C1", "C2", "D", "E"):
        hobby_key = "adult_family"

    # Positive habits (2-3)
    habits = list(HABITS_POOL)
    random.shuffle(habits)
    habitos_positivos = [{"hábito": habits[i], "frequência_nível": rand_int(4, 9)} for i in range(rand_int(2, 3))]

    # Addictions (2-3)
    addictions = list(ADDICTIONS_POOL)
    random.shuffle(addictions)
    n_addictions = rand_int(2, 3)
    vicios = [{"tipo": a[0], "intensidade": rand_int(a[1], a[2])} for a in addictions[:n_addictions]]

    # Relationships
    sociabilidade = rand_int(4, 9)
    if p.get("archetype_primary") in ("O Comediante", "O Amante"):
        sociabilidade = max(7, sociabilidade)
    elif p.get("archetype_primary") in ("O Sábio",):
        sociabilidade = min(6, sociabilidade)

    vinculo_familiar = rand_int(4, 10)
    if age > 50:
        vinculo_familiar = max(5, vinculo_familiar)

    materialismo = rand_int(3, 10)
    if social_class in ("A", "B1"):
        materialismo = max(6, materialismo)
    elif social_class in ("D", "E"):
        materialismo = min(5, materialismo)

    return {
        "ritmo_e_cronotipo": {
            "tipo": cronotype,
            "pico_de_energia": pico,
            "qualidade_do_sono": qualidade_sono,
        },
        "consumo_de_mídias": {
            "notícias_e_atualidades": noticias,
            "entretenimento_streaming": streaming,
            "redes_sociais_predominantes": social_media,
            "influência_da_mídia_tradicional": midia_trad,
        },
        "hábitos_positivos": habitos_positivos,
        "vícios_e_dependências": vicios,
        "relações_interpessoais": {
            "sociabilidade": sociabilidade,
            "vínculo_familiar": vinculo_familiar,
            "confiança_nas_pessoas": rand_int(3, 8),
            "dependência_de_aprovação_social": rand_int(2, 9),
        },
        "relações_intrapessoais_e_materiais": {
            "autoestima": rand_int(3, 9),
            "apego_a_bens_físicos": rand_int(2, 8),
            "materialismo_e_consumo": materialismo,
            "foco_em_autodesenvolvimento": rand_int(3, 10),
        },
    }


def generate_health_json(p):
    """Generate health_json matching Mariana Costa's structure."""
    age = p["age"]
    social_class = p["social_class"]
    gender = p["gender"]
    age_group = get_age_group(age)

    # Physical activities (1-2)
    activities = list(PHYSICAL_ACTIVITIES)
    random.shuffle(activities)
    n_activities = rand_int(1, 2)
    if social_class in ("D", "E") and age > 40:
        # More sedentary for lower class + older
        if random.random() < 0.4:
            activities = [("Nenhuma (Sedentário)", "Nenhum")]
            n_activities = 1
    atividades = [{"tipo": a[0], "objetivo": a[1], "frequência_nível": rand_int(3, 8)} for a in activities[:n_activities]]

    # Leisure (2-3)
    leisure = list(LEISURE_ACTIVITIES)
    random.shuffle(leisure)
    lazer = [{"atividade": leisure[i], "interesse_nível": rand_int(5, 10)} for i in range(rand_int(2, 3))]
    lazer.sort(key=lambda x: x["interesse_nível"], reverse=True)

    # Chronic conditions
    cond_key = "young" if age < 35 else "adult" if age < 60 else "elder"
    conditions = pick(CHRONIC_CONDITIONS_BY_AGE[cond_key])

    alimentacao = rand_int(3, 9)
    if social_class in ("A", "B1"):
        alimentacao = max(5, alimentacao)
    elif social_class in ("D", "E"):
        alimentacao = min(6, alimentacao)

    disposicao = rand_int(3, 8) if age < 50 else rand_int(2, 6)

    # Life satisfaction
    satisfacao_geral = rand_int(3, 9)
    if social_class in ("A", "B1"):
        satisfacao_geral = max(5, satisfacao_geral)

    equil_emocional = rand_int(3, 8)
    perc_sucesso = rand_int(3, 9)
    if social_class in ("A", "B1"):
        perc_sucesso = max(5, perc_sucesso)

    # Mental health
    estresse = rand_int(3, 9)
    if social_class in ("A", "B1") and age < 50:
        estresse = max(5, estresse)  # High class = high stress from work
    elif social_class in ("D", "E"):
        estresse = max(5, estresse)  # Low class = high stress from finances

    resiliencia = rand_int(3, 9)
    cuidados_mental = rand_int(2, 9)
    if social_class in ("A", "B1", "B2"):
        cuidados_mental = max(4, cuidados_mental)
    terapia = rand_int(1, 9)
    if social_class in ("D", "E"):
        terapia = min(4, terapia)

    return {
        "atividades_fisicas": atividades,
        "atividades_de_lazer": lazer,
        "condições_e_doenças": {
            "doenças_crônicas": conditions,
            "histórico_de_lesões": [] if random.random() > 0.3 else [pick(["Entorse de tornozelo", "Fratura no braço", "Lesão no joelho", "Lesão na coluna", "Tendinite"])],
            "qualidade_da_alimentação": alimentacao,
            "nível_de_disposição_física": disposicao,
        },
        "satisfação_com_a_vida": {
            "índice_geral": satisfacao_geral,
            "equilíbrio_emocional": equil_emocional,
            "percepção_de_sucesso": perc_sucesso,
        },
        "saude_mental_e_estresse": {
            "nível_estresse_crônico": estresse,
            "resiliência_psicológica": resiliencia,
            "cuidados_com_saúde_mental": cuidados_mental,
            "frequência_terapia_ou_meditação": terapia,
        },
    }


def generate_history_json(p):
    """Generate history_json matching Mariana Costa's structure."""
    name = p["name"]
    first_name = name.split()[0]
    age = p["age"]
    gender = p["gender"]
    social_class = p["social_class"]
    city = p["city"]
    state = p["state"]
    education_detail = p["_escolaridade_detalhada"]
    civil_status = p["civil_status"]
    region = p["region_br"]
    age_group = get_age_group(age)

    pronome = "ela" if gender == "Feminino" else "ele"
    nascido = "Nascida" if gender == "Feminino" else "Nascido"

    # Biography
    contexto_origem = pick(BIOGRAPHY_CONTEXTS.get(social_class, BIOGRAPHY_CONTEXTS["C1"]))
    edu_path = pick(EDUCATION_PATHS.get(education_detail, EDUCATION_PATHS.get("Médio completo", ["Concluiu os estudos básicos"])))
    cargo = p.get("_cargo", "trabalhador(a)")
    bio = f"{nascido} em {city}, {state}. {contexto_origem}. {edu_path}. Hoje vive em {city} e atua profissionalmente na região."

    influencia_edu = edu_path

    # Aspirations
    dreams = pick(DREAMS_POOL.get(age_group, DREAMS_POOL["adult"]))
    short_goals = pick(SHORT_TERM_GOALS.get(age_group, SHORT_TERM_GOALS["adult"]))
    medo_fracasso = rand_int(3, 10)

    # Family
    parceiro = "Nenhum(a) (Solteiro(a))"
    if civil_status == "Casado":
        parceiro = f"Casado(a) com cônjuge"
    elif civil_status == "União Estável":
        parceiro = f"Companheiro(a) em união estável"
    elif civil_status == "Divorciado":
        parceiro = "Divorciado(a)"
    elif civil_status == "Viúvo":
        parceiro = "Viúvo(a)"

    dinamica_key = pick(list(FAMILY_DYNAMICS.keys()))
    dinamica = FAMILY_DYNAMICS[dinamica_key]

    pais_desc = pick([
        "Pais presentes e atuantes na criação",
        "Mãe como figura principal, pai ausente",
        "Criado(a) pelos avós",
        "Pais separados desde a infância",
        "Família unida com forte presença dos pais",
        "Pais trabalhadores com pouco tempo para os filhos",
        "Mãe solteira que criou sozinha",
        "Família grande com muitos irmãos",
    ])

    # Recent events (1-2)
    recent_pool = list(RECENT_EVENTS_POOL)
    random.shuffle(recent_pool)
    eventos_recentes = [
        {"evento": recent_pool[i], "impacto_emocional": rand_int(3, 9), "mudança_de_prioridade": pick(["Alta", "Média", "Baixa"])}
        for i in range(rand_int(1, 2))
    ]

    # Traumas (1-2)
    traumas_sample = random.sample(TRAUMAS_POOL, rand_int(1, 2))
    traumas = [
        {"descricao": t[0], "gatilhos": t[1], "intensidade_da_cicatriz": rand_int(t[2], t[3])}
        for t in traumas_sample
    ]

    # Historical events (2-3, age-appropriate)
    available_events = list(HISTORICAL_EVENTS)
    if age < 25:
        available_events = [e for e in available_events if "2013" not in e[0] and "2016" not in e[0] and "Lava Jato" not in e[0]]
    random.shuffle(available_events)
    n_hist = rand_int(2, 3)
    hist_events = []
    for e in available_events[:n_hist]:
        perception = pick([
            f"Impactou diretamente a vida de {first_name}",
            f"Observou de longe mas sentiu os efeitos",
            f"Gerou mudança de perspectiva",
            f"Fortaleceu suas convicções",
            f"Causou preocupação e incerteza",
            f"Motivou {pronome} a se engajar mais",
        ])
        hist_events.append({
            "evento": e[0],
            "percepção_pessoal": perception,
            "nível_de_influência": rand_int(4, 9),
        })

    return {
        "aspiracoes": {
            "sonhos_de_vida": dreams,
            "medo_do_fracasso": medo_fracasso,
            "objetivos_curto_prazo": short_goals,
        },
        "biografia_base": {
            "resumo_narrativo": bio,
            "contexto_de_origem": contexto_origem,
            "influencia_educacional": influencia_edu,
        },
        "nucleo_familiar": {
            "pais": pais_desc,
            "parceiro_a": parceiro,
            "dinamica_relacional": dinamica,
        },
        "eventos_recentes": eventos_recentes,
        "traumas_e_feridas": traumas,
        "eventos_historicos_vivenciados": hist_events,
    }


def generate_demographic_json(p):
    """Generate demographic_json matching Mariana Costa's structure."""
    name = p["name"]
    age = p["age"]
    gender = p["gender"]
    city = p["city"]
    state = p["state"]
    region = p["region_br"]
    social_class = p["social_class"]
    education = p["education_level"]
    lat = p["lat"]
    lng = p["lng"]
    area_type = p["area_type"]

    # Ethnicity by region (IBGE)
    ethnicity = get_ethnicity(region)

    # Height/Weight
    height, weight = get_height_weight(gender, age, social_class)

    # Income
    income_range = INCOME_BY_CLASS.get(social_class, (1500, 3000))
    income = rand_int(income_range[0], income_range[1])
    family_income = round(income * rand_float(1.2, 2.5))

    faixa_renda = FAIXA_RENDA_IBGE.get(social_class, "Renda variável")
    poder_compra = PODER_COMPRA.get(social_class, 5)

    idh = IDH_BY_STATE.get(state, 0.700)
    perfil_regional = PERFIL_REGIONAL.get(region, "Perfil regional diversificado")
    densidade = DENSIDADE_POR_PORTE.get(p["_porte"], "Média")
    prob_carreira = PROB_CARREIRA_POR_REGIAO.get(region, "Média para diversos setores")

    # Occupation (from career_json)
    cargo = p.get("_cargo", "Trabalhador(a)")
    setor = p.get("_setor", "Serviços")

    # Civil status details
    civil_status = p["civil_status"]
    tem_filhos = False
    dependentes = 0
    mora_com = "Sozinho(a)"

    if civil_status in ("Casado", "União Estável"):
        tem_filhos = random.random() > 0.3
        if tem_filhos:
            dependentes = rand_int(1, 3)
            mora_com = f"Cônjuge e {dependentes} filho(s)"
        else:
            mora_com = "Cônjuge"
    elif civil_status == "Solteiro" and age < 25:
        mora_com = "Pais"
    elif civil_status == "Viúvo":
        tem_filhos = random.random() > 0.4
        if tem_filhos:
            dependentes = rand_int(1, 2)
            mora_com = f"Sozinho(a), filhos visitam"
        else:
            mora_com = "Sozinho(a)"
    elif civil_status == "Divorciado":
        tem_filhos = random.random() > 0.4
        if tem_filhos:
            dependentes = rand_int(1, 2)
            mora_com = f"Com {dependentes} filho(s)"
        else:
            mora_com = "Sozinho(a)"

    return {
        "padroes_ibge": {
            "perfil_regional_ibge": perfil_regional,
            "densidade_demografica_local": densidade,
            "probabilidade_estatistica_de_carreira": prob_carreira,
            "indice_desenvolvimento_humano_municipal": idh,
        },
        "geolocalizacao": {
            "cidade": city,
            "estado": state,
            "regiao": region,
            "tipo_area": area_type,
            "coordenadas": {
                "latitude": lat,
                "longitude": lng,
            },
        },
        "socioeconomico": {
            "escolaridade": p["_escolaridade_detalhada"],
            "classe_social": social_class,
            "setor_economico": setor,
            "ocupacao_principal": cargo,
        },
        "renda_e_financas": {
            "faixa_renda_ibge": faixa_renda,
            "renda_familiar_total": family_income,
            "poder_de_compra_nivel": poder_compra,
            "renda_mensal_individual": income,
        },
        "identidade_basica": {
            "etnia": ethnicity,
            "idade": age,
            "genero": gender,
            "peso_kg": weight,
            "altura_cm": height,
            "nome_completo": name,
        },
        "familia_e_estado_civil": {
            "mora_com": mora_com,
            "tem_filhos": tem_filhos,
            "dependentes": dependentes,
            "estado_civil": civil_status,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7: MAIN PERSONA BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def build_persona(row):
    """Build a complete persona from a CSV row, matching Mariana Costa's structure."""
    persona_id = row["persona_id"]
    seed_random(persona_id)

    name = row["nome_completo"]
    age = int(row["idade"])
    gender = row["sexo"]
    city = row["municipio"]
    state = row["uf"]
    region = row["regiao"]
    porte = row["porte_municipio"]
    social_class = row["nivel_economico"]
    escolaridade = row["escolaridade_detalhada"]
    religiao_csv = row["religiao"]
    voto = row["voto_2022"]

    # New 2D ideological fields
    apelido_politico = row.get("apelido_politico", "")
    cluster_id = row.get("cluster_id", "")
    nome_grupo = row.get("nome_grupo", "")
    score_economico = float(row.get("score_economico", 0))
    score_costumes = float(row.get("score_costumes", 0))

    # Derived fields
    lat, lng = get_coords(city, state)
    education_level = map_education(escolaridade)
    macro_religion = map_religion(religiao_csv)
    political_leaning = map_political(voto)
    area_type = map_area_type(porte, city)
    generation = get_generation(age)
    civil_status = get_civil_status(age)
    cronotype = get_cronotype(age, social_class)
    archetype_primary = get_archetype(political_leaning, macro_religion, social_class, age)
    disc_main_factor = get_disc(archetype_primary, political_leaning)

    # Build intermediate data dict
    p = {
        "name": name,
        "age": age,
        "gender": gender,
        "city": city,
        "state": state,
        "lat": lat,
        "lng": lng,
        "gender_identity": gender,
        "civil_status": civil_status,
        "social_class": social_class,
        "education_level": education_level,
        "generation": generation,
        "political_leaning": political_leaning,
        "archetype_primary": archetype_primary,
        "disc_main_factor": disc_main_factor,
        "macro_religion": macro_religion,
        "cronotype": cronotype,
        "region_br": region,
        "area_type": area_type,
        # New 2D ideological fields
        "apelido_politico": apelido_politico,
        "cluster_id": cluster_id,
        "nome_grupo": nome_grupo,
        "score_economico": score_economico,
        "score_costumes": score_costumes,
        # Internal fields for generators (removed before DB insert)
        "_porte": porte,
        "_escolaridade_detalhada": escolaridade,
    }

    # Generate career first to get occupation info
    career = generate_career_json(p)
    p["_cargo"] = career["atuação_e_cargo"]["cargo_atual"]
    p["_setor"] = career["atuação_e_cargo"]["setor"]

    # Generate all JSON columns
    p["psychology_json"] = generate_psychology_json(p)
    p["beliefs_json"] = generate_beliefs_json(p)
    p["career_json"] = career
    p["lifestyle_json"] = generate_lifestyle_json(p)
    p["health_json"] = generate_health_json(p)
    p["history_json"] = generate_history_json(p)
    p["demographic_json"] = generate_demographic_json(p)

    # Remove internal fields
    for key in list(p.keys()):
        if key.startswith("_"):
            del p[key]

    return p


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 8: DATABASE OPERATIONS AND ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def delete_all_except_mariana():
    """Delete all personas except Mariana Costa."""
    print("Deletando todas as personas (exceto Mariana Costa)...")

    # First count
    result = supabase.table("personas").select("id", count="exact").execute()
    total = len(result.data) if result.data else 0
    print(f"  Total antes: {total}")

    if total <= 1:
        print("  Nenhuma persona para deletar.")
        return

    # Get all IDs except Mariana
    ids_result = supabase.table("personas").select("id").neq("id", MARIANA_ID).execute()
    ids_to_delete = [r["id"] for r in ids_result.data] if ids_result.data else []

    if not ids_to_delete:
        print("  Nenhuma persona para deletar.")
        return

    # Delete in batches to avoid timeout
    batch_size = 50
    deleted = 0
    for i in range(0, len(ids_to_delete), batch_size):
        batch_ids = ids_to_delete[i:i+batch_size]
        try:
            supabase.table("personas").delete().in_("id", batch_ids).execute()
            deleted += len(batch_ids)
            print(f"  Deletadas: {deleted}/{len(ids_to_delete)}")
        except Exception as e:
            print(f"  Erro ao deletar batch: {e}")
            # Try one by one
            for uid in batch_ids:
                try:
                    supabase.table("personas").delete().eq("id", uid).execute()
                    deleted += 1
                except Exception as e2:
                    print(f"    Erro ao deletar {uid}: {e2}")

    print(f"  Total deletadas: {deleted}")


def insert_personas(personas):
    """Insert personas in batches."""
    total = len(personas)
    inserted = 0
    errors = 0

    print(f"\nInserindo {total} personas em batches de {BATCH_SIZE}...")

    for i in range(0, total, BATCH_SIZE):
        batch = personas[i:i+BATCH_SIZE]
        try:
            result = supabase.table("personas").insert(batch).execute()
            inserted += len(batch)
            print(f"  Inseridas: {inserted}/{total} ({(inserted/total*100):.1f}%)")
        except Exception as e:
            print(f"  Erro no batch {i//BATCH_SIZE + 1}: {e}")
            # Try one by one to identify the problem
            for persona in batch:
                try:
                    supabase.table("personas").insert(persona).execute()
                    inserted += 1
                except Exception as e2:
                    errors += 1
                    print(f"    FALHA: {persona['name']} - {e2}")

        # Small delay to avoid rate limiting
        if i > 0 and i % 100 == 0:
            time.sleep(0.5)

    return inserted, errors


def main():
    print("=" * 70)
    print("SYNTHETIC PERSON - Populando 2002 personas IBGE")
    print("=" * 70)

    # Step 1: Read CSV
    print(f"\n[1/4] Lendo CSV: {CSV_PATH}")
    rows = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  {len(rows)} personas encontradas no CSV")

    # Step 2: Delete existing (except Mariana Costa)
    print(f"\n[2/4] Limpando banco de dados...")
    delete_all_except_mariana()

    # Step 3: Build personas
    print(f"\n[3/4] Gerando dados completos para {len(rows)} personas...")
    personas = []
    for idx, row in enumerate(rows):
        persona = build_persona(row)
        personas.append(persona)
        if (idx + 1) % 200 == 0:
            print(f"  Geradas: {idx + 1}/{len(rows)}")
    print(f"  Total geradas: {len(personas)}")

    # Show distribution summary
    regions = {}
    for p in personas:
        r = p["region_br"]
        regions[r] = regions.get(r, 0) + 1
    print(f"  Distribuição por região: {regions}")

    # Step 4: Insert into Supabase
    print(f"\n[4/4] Inserindo no Supabase...")
    inserted, errors = insert_personas(personas)

    # Final count
    result = supabase.table("personas").select("id", count="exact").execute()
    final_count = len(result.data) if result.data else 0

    print(f"\n{'=' * 70}")
    print(f"RESULTADO FINAL:")
    print(f"  Inseridas com sucesso: {inserted}")
    print(f"  Erros: {errors}")
    print(f"  Total no banco: {final_count} (incluindo Mariana Costa)")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
