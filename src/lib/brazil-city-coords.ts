/**
 * Lookup table of Brazilian city coordinates.
 * Used as fallback when Python backend sends cityBreakdown without lat/lng.
 * Key format: "CityName-UF" (e.g., "São Paulo-SP")
 */

const BRAZIL_CITY_COORDS: Record<string, [number, number]> = {
  // ── Capitais ──
  'Rio Branco-AC': [-9.9754, -67.8249],
  'Maceió-AL': [-9.6658, -35.7353],
  'Manaus-AM': [-3.119, -60.0217],
  'Macapá-AP': [0.0349, -51.0694],
  'Salvador-BA': [-12.9714, -38.5124],
  'Fortaleza-CE': [-3.7172, -38.5433],
  'Brasília-DF': [-15.7975, -47.8919],
  'Vitória-ES': [-20.3155, -40.3128],
  'Goiânia-GO': [-16.6869, -49.2648],
  'São Luís-MA': [-2.5297, -44.2825],
  'Belo Horizonte-MG': [-19.9167, -43.9345],
  'Campo Grande-MS': [-20.4697, -54.6201],
  'Cuiabá-MT': [-15.601, -56.0974],
  'Belém-PA': [-1.4558, -48.5024],
  'João Pessoa-PB': [-7.115, -34.861],
  'Recife-PE': [-8.0476, -34.877],
  'Teresina-PI': [-5.0892, -42.8019],
  'Curitiba-PR': [-25.4284, -49.2733],
  'Rio de Janeiro-RJ': [-22.9068, -43.1729],
  'Natal-RN': [-5.7945, -35.211],
  'Porto Velho-RO': [-8.7612, -63.9004],
  'Boa Vista-RR': [2.8195, -60.6714],
  'Porto Alegre-RS': [-30.0346, -51.2177],
  'Florianópolis-SC': [-27.5954, -48.548],
  'Aracaju-SE': [-10.9091, -37.0677],
  'São Paulo-SP': [-23.5505, -46.6333],
  'Palmas-TO': [-10.1689, -48.3317],

  // ── Grandes cidades ──
  'Guarulhos-SP': [-23.4538, -46.5333],
  'Campinas-SP': [-22.9099, -47.0626],
  'São Bernardo do Campo-SP': [-23.6914, -46.5646],
  'Santo André-SP': [-23.6737, -46.5432],
  'Osasco-SP': [-23.5325, -46.7917],
  'São José dos Campos-SP': [-23.1896, -45.8841],
  'Ribeirão Preto-SP': [-21.1704, -47.8103],
  'Sorocaba-SP': [-23.5015, -47.4526],
  'Santos-SP': [-23.9608, -46.3336],
  'Jundiaí-SP': [-23.1857, -46.8978],
  'Piracicaba-SP': [-22.7252, -47.6492],
  'Bauru-SP': [-22.3246, -49.0871],
  'São José do Rio Preto-SP': [-20.8113, -49.3758],
  'Franca-SP': [-20.539, -47.4008],
  'Taubaté-SP': [-23.0204, -45.5558],
  'Limeira-SP': [-22.5643, -47.402],
  'Mogi das Cruzes-SP': [-23.5221, -46.1856],
  'Niterói-RJ': [-22.8833, -43.1036],
  'São Gonçalo-RJ': [-22.8269, -43.0634],
  'Duque de Caxias-RJ': [-22.7856, -43.3117],
  'Nova Iguaçu-RJ': [-22.7592, -43.451],
  'Petrópolis-RJ': [-22.5049, -43.1771],
  'Volta Redonda-RJ': [-22.5022, -44.1044],
  'Campos dos Goytacazes-RJ': [-21.7545, -41.3244],
  'Contagem-MG': [-19.9332, -44.0539],
  'Uberlândia-MG': [-18.9186, -48.2772],
  'Juiz de Fora-MG': [-21.764, -43.3496],
  'Betim-MG': [-19.9677, -44.1985],
  'Montes Claros-MG': [-16.7351, -43.8615],
  'Uberaba-MG': [-19.7472, -47.9326],
  'Governador Valadares-MG': [-18.8509, -41.9494],
  'Ipatinga-MG': [-19.4683, -42.5367],
  'Manhuaçu-MG': [-20.2572, -42.0283],
  'Joinville-SC': [-26.3045, -48.8487],
  'Blumenau-SC': [-26.9194, -49.0661],
  'Chapecó-SC': [-27.0963, -52.6158],
  'Criciúma-SC': [-28.6775, -49.3697],
  'Londrina-PR': [-23.3045, -51.1696],
  'Maringá-PR': [-23.4205, -51.9333],
  'Ponta Grossa-PR': [-25.095, -50.1621],
  'Cascavel-PR': [-24.9578, -53.459],
  'Foz do Iguaçu-PR': [-25.5163, -54.5854],
  'Caxias do Sul-RS': [-29.1681, -51.1794],
  'Pelotas-RS': [-31.7654, -52.3376],
  'Canoas-RS': [-29.9179, -51.1739],
  'Santa Maria-RS': [-29.6868, -53.8149],
  'Gravataí-RS': [-29.9428, -50.9919],
  'Novo Hamburgo-RS': [-29.6787, -51.1306],
  'Feira de Santana-BA': [-12.267, -38.9666],
  'Vitória da Conquista-BA': [-14.861, -40.8441],
  'Camaçari-BA': [-12.6983, -38.3244],
  'Ilhéus-BA': [-14.7936, -39.0463],
  'Lauro de Freitas-BA': [-12.8981, -38.3227],
  'Aparecida de Goiânia-GO': [-16.8198, -49.2469],
  'Anápolis-GO': [-16.3281, -48.953],
  'Caucaia-CE': [-3.7281, -38.6533],
  'Juazeiro do Norte-CE': [-7.2131, -39.3153],
  'Sobral-CE': [-3.6861, -40.3481],
  'Jaboatão dos Guararapes-PE': [-8.113, -35.016],
  'Caruaru-PE': [-8.2824, -35.9761],
  'Olinda-PE': [-7.9907, -34.8553],
  'Petrolina-PE': [-9.3891, -40.5028],
  'Campina Grande-PB': [-7.2172, -35.8811],
  'Parnamirim-RN': [-5.9156, -35.2634],
  'Mossoró-RN': [-5.1878, -37.3444],
  'São José de Ribamar-MA': [-2.5474, -44.0585],
  'Imperatriz-MA': [-5.5195, -47.4735],
  'Ananindeua-PA': [-1.3659, -48.3886],
  'Santarém-PA': [-2.4426, -54.708],
  'Marabá-PA': [-5.3687, -49.1178],
  'Serra-ES': [-20.1209, -40.3075],
  'Vila Velha-ES': [-20.3297, -40.2922],
  'Cariacica-ES': [-20.2636, -40.4164],
  'Cachoeiro de Itapemirim-ES': [-20.8488, -41.1128],
  'Linhares-ES': [-19.3911, -40.0722],
  'Colatina-ES': [-19.5392, -40.6306],
  'Guarapari-ES': [-20.6735, -40.5008],
  'São Mateus-ES': [-18.7163, -39.8588],

  // ── Cidades médias relevantes ──
  'Itu-SP': [-23.264, -47.2992],
  'Indaiatuba-SP': [-23.0907, -47.2181],
  'Marília-SP': [-22.2139, -49.9458],
  'Presidente Prudente-SP': [-22.1256, -51.3889],
  'Araraquara-SP': [-21.7946, -48.175],
  'São Carlos-SP': [-22.0174, -47.891],
  'Americana-SP': [-22.7393, -47.3314],
  'Diadema-SP': [-23.6861, -46.6228],
  'Carapicuíba-SP': [-23.5224, -46.8356],
  'Itaquaquecetuba-SP': [-23.4863, -46.3486],
  'Taboão da Serra-SP': [-23.6022, -46.7531],
  'Barueri-SP': [-23.5107, -46.8764],
  'Cotia-SP': [-23.6036, -46.9192],
  'Embu das Artes-SP': [-23.649, -46.8524],
  'Suzano-SP': [-23.5425, -46.3108],
  'Praia Grande-SP': [-24.0058, -46.4028],
  'São Vicente-SP': [-23.9619, -46.3878],
  'Guarujá-SP': [-23.9935, -46.2564],
  'Jacareí-SP': [-23.3048, -45.9659],
  'Itapetininga-SP': [-23.5916, -48.0531],
  'Botucatu-SP': [-22.8862, -48.4455],
  'Assis-SP': [-22.6617, -50.4122],
  'Ourinhos-SP': [-22.9787, -49.8706],
  'Catanduva-SP': [-21.1378, -48.973],
  'Araçatuba-SP': [-21.2088, -50.4328],
  'Birigui-SP': [-21.2886, -50.3406],
};

/**
 * Look up coordinates for a city+state pair.
 * Returns [lat, lng] or null if not found.
 */
export function getCityCoords(cityName: string, state: string): [number, number] | null {
  // Try exact match
  const key = `${cityName}-${state}`;
  if (BRAZIL_CITY_COORDS[key]) return BRAZIL_CITY_COORDS[key];

  // Try normalized (remove accents)
  const normalized = cityName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const keyNorm = `${normalized}-${state}`;

  // Search through all keys with normalized comparison
  for (const [k, v] of Object.entries(BRAZIL_CITY_COORDS)) {
    const kNorm = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (kNorm === keyNorm || kNorm.toLowerCase() === keyNorm.toLowerCase()) return v;
  }

  return null;
}
