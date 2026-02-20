'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  MapPin,
  MessageSquare,
  Brain,
  Heart,
  Briefcase,
  Activity,
  BookOpen,
  Target,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  Tv,
  Dumbbell,
  AlertTriangle,
  Star,
  Compass,
  EyeOff,
  Flame,
} from 'lucide-react';

export default function PersonaProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [persona, setPersona] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPersona();
  }, [id]);

  async function fetchPersona() {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      router.push('/');
      return;
    }
    setPersona(data);
  }

  if (!persona) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: User },
    { id: 'tabu', label: 'Tabu Implícito', icon: EyeOff },
    { id: 'vivencias', label: 'Vivências', icon: Flame },
    { id: 'psychology', label: 'Psicologia', icon: Brain },
    { id: 'beliefs', label: 'Crenças', icon: Shield },
    { id: 'career', label: 'Carreira', icon: Briefcase },
    { id: 'lifestyle', label: 'Estilo de Vida', icon: Activity },
    { id: 'health', label: 'Saúde', icon: Heart },
    { id: 'history', label: 'História', icon: BookOpen },
  ];

  const archetypePrimary = persona.archetype_primary || persona.psychology_json?.archetypes?.primary || 'Neutro';
  const socialClass = persona.social_class || persona.demographic_json?.socioeconomico?.classe_social;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-zinc-900">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <Link href="/" className="text-zinc-500 hover:text-white transition-all p-2 hover:bg-zinc-900 rounded-xl">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="font-bold text-lg md:text-xl tracking-tight truncate">Perfil da Persona</h1>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white text-black px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5 text-sm md:text-base"
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Iniciar Chat</span>
              <span className="sm:hidden">Chat</span>
            </Link>
          </div>
        </header>


      {/* Hero Section */}
      <section className="bg-gradient-to-b from-zinc-950 to-black py-16 border-b border-zinc-900/50 font-sans">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            <div className="w-40 h-40 rounded-[2.5rem] bg-zinc-900 flex items-center justify-center text-zinc-500 border border-zinc-800 shadow-2xl overflow-hidden">
              {persona.photo_path ? (
                <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
              ) : (
                <User size={80} />
              )}
            </div>
            <div className="text-center md:text-left flex-1">
                <h2 className="text-4xl font-black mb-3 tracking-tight">{persona.name}</h2>
                <p className="text-zinc-500 flex items-center justify-center md:justify-start gap-2 mb-6 font-medium">
                  <MapPin size={18} />
                  {persona.age} anos • {persona.city}, {persona.state}
                </p>
                {persona.apelido_politico && (
                  <p className="text-zinc-400 text-sm font-medium mb-4">&ldquo;{persona.apelido_politico}&rdquo;</p>
                )}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <span className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-2xl text-sm font-bold border border-amber-500/20">
                    {archetypePrimary}
                  </span>
                  <span className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-2xl text-sm font-bold border border-blue-500/20">
                    Enneagrama {persona.psychology_json?.enneagram?.core_type}w{persona.psychology_json?.enneagram?.wing}
                  </span>
                  <span className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-2xl text-sm font-bold border border-purple-500/20">
                    {socialClass}
                  </span>
                  {persona.nome_grupo && (
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-2xl text-sm font-bold border border-emerald-500/20">
                      {persona.cluster_id && <span className="opacity-60 mr-1.5">{persona.cluster_id}</span>}
                      {persona.nome_grupo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Navigation */}
        <nav className="sticky top-[81px] z-40 bg-black/95 backdrop-blur-md border-b border-zinc-900 overflow-x-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto px-8">
            <div className="flex gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-5 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                    activeTab === tab.id 
                      ? 'text-white border-white' 
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-8 py-12 w-full">
          {activeTab === 'overview' && <OverviewTab persona={persona} />}
          {activeTab === 'tabu' && <TabuImplicitoTab persona={persona} />}
          {activeTab === 'vivencias' && <VivenciasTab persona={persona} />}
          {activeTab === 'psychology' && <PsychologyTab persona={persona} />}
          {activeTab === 'beliefs' && <BeliefsTab persona={persona} />}
          {activeTab === 'career' && <CareerTab persona={persona} />}
          {activeTab === 'lifestyle' && <LifestyleTab persona={persona} />}
          {activeTab === 'health' && <HealthTab persona={persona} />}
          {activeTab === 'history' && <HistoryTab persona={persona} />}
        </main>
    </div>
  );
}

// ===== COMPONENTES DE SEÇÃO =====

function SectionCard({ title, icon: Icon, children, className = '' }: any) {
  return (
    <div className={`bg-zinc-950 rounded-[2rem] border border-zinc-900 p-8 shadow-sm hover:shadow-xl hover:shadow-white/[0.02] transition-all ${className}`}>
      <h3 className="flex items-center gap-3 text-xl font-black mb-8 tracking-tight">
        {Icon && <Icon size={24} className="text-zinc-500" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProgressBar({ value, max = 10, color = 'bg-white' }: any) {
  const percentage = (value / max) * 100;
  return (
    <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50 shadow-inner">
      <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`} style={{ width: `${percentage}%` }} />
    </div>
  );
}


function StatItem({ label, value, max = 10, color }: any) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium">{value}/{max}</span>
      </div>
      <ProgressBar value={value} max={max} color={color} />
    </div>
  );
}

// ===== TABS =====

function OverviewTab({ persona }: { persona: any }) {
  const demo = persona.demographic_json;
  const identity = demo?.identidade_basica;
  const socio = demo?.socioeconomico;
  const finance = demo?.renda_e_financas;
  const family = demo?.familia_e_estado_civil;
  const geo = demo?.geolocalizacao;
  const ibge = demo?.padroes_ibge;
  const genderIdentity = persona.gender_identity || identity?.genero;
  const socialClass = persona.social_class || socio?.classe_social;
  const educationLevel = persona.education_level || socio?.escolaridade;
  const civilStatus = persona.civil_status || family?.estado_civil;
  const regionBr = persona.region_br || geo?.regiao;
  const areaType = persona.area_type || geo?.tipo_area;
  const ethnicity = persona.raca_cor || identity?.etnia;
  const religion = persona.macro_religion || persona.beliefs_json?.religião?.fé_ou_doutrina;
  const religionSubtype = persona.religiao_subtipo;
  const occupation = persona.career_json?.atuação_e_cargo?.cargo_atual;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Identidade Básica */}
      <SectionCard title="Identidade Básica" icon={User}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Nome</span><span>{persona.name || identity?.nome_completo}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Idade</span><span>{persona.age || identity?.idade} anos</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Gênero</span><span>{genderIdentity}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Raça/Cor</span><span>{ethnicity || 'Não informada'}</span></div>
          {identity?.altura_cm && <div className="flex justify-between"><span className="text-zinc-500">Altura</span><span>{identity.altura_cm} cm</span></div>}
          {identity?.peso_kg && <div className="flex justify-between"><span className="text-zinc-500">Peso</span><span>{identity.peso_kg} kg</span></div>}
        </div>
      </SectionCard>

      {/* Localização */}
      <SectionCard title="Localização" icon={MapPin}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Cidade</span><span>{persona.city || geo?.cidade}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Estado</span><span>{persona.state || geo?.estado}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Região</span><span>{regionBr}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Tipo de Área</span><span>{areaType}</span></div>
          {geo?.coordenadas && <div className="flex justify-between"><span className="text-zinc-500">Coordenadas</span><span className="text-xs text-zinc-400">{geo.coordenadas.latitude}, {geo.coordenadas.longitude}</span></div>}
        </div>
      </SectionCard>

      {/* Socioeconômico */}
      <SectionCard title="Perfil Socioeconômico" icon={TrendingUp}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Classe Social</span><span className="font-bold text-emerald-400">{socialClass}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Escolaridade</span><span>{educationLevel}</span></div>
          {occupation && <div className="flex justify-between"><span className="text-zinc-500">Ocupação</span><span className="text-right max-w-[150px] truncate">{occupation}</span></div>}
          {socio?.setor_economico && <div className="flex justify-between"><span className="text-zinc-500">Setor</span><span>{socio.setor_economico}</span></div>}
          <div className="flex justify-between"><span className="text-zinc-500">Geração</span><span>{persona.generation}</span></div>
          {persona.recebe_beneficio && <div className="flex justify-between"><span className="text-zinc-500">Recebe Benefício</span><span>{persona.recebe_beneficio}</span></div>}
          {persona.usa_transporte_publico && <div className="flex justify-between"><span className="text-zinc-500">Transporte Público</span><span>{persona.usa_transporte_publico}</span></div>}
        </div>
      </SectionCard>

      {/* Religião e Crenças */}
      <SectionCard title="Religião" icon={Sparkles}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Religião</span><span className="font-medium">{religion || 'Não informada'}</span></div>
          {religionSubtype && <div className="flex justify-between"><span className="text-zinc-500">Subtipo</span><span>{religionSubtype}</span></div>}
        </div>
      </SectionCard>

      {/* Família */}
      <SectionCard title="Família e Estado Civil" icon={Users}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Estado Civil</span><span>{civilStatus}</span></div>
          {family?.mora_com && <div className="flex justify-between"><span className="text-zinc-500">Mora com</span><span>{family.mora_com}</span></div>}
          {family?.tem_filhos != null && <div className="flex justify-between"><span className="text-zinc-500">Tem Filhos</span><span>{family.tem_filhos ? 'Sim' : 'Não'}</span></div>}
          {family?.dependentes != null && <div className="flex justify-between"><span className="text-zinc-500">Dependentes</span><span>{family.dependentes}</span></div>}
          {persona.time_futebol && <div className="flex justify-between"><span className="text-zinc-500">Time</span><span>{persona.time_futebol}</span></div>}
        </div>
      </SectionCard>

      {/* Dados Eleitorais */}
      <SectionCard title="Perfil Eleitoral" icon={Shield}>
        <div className="space-y-3 text-sm">
          {persona.voto_2022 && <div className="flex justify-between"><span className="text-zinc-500">Voto 2022</span><span className="font-bold">{persona.voto_2022}</span></div>}
          {persona.aprovacao_lula && <div className="flex justify-between"><span className="text-zinc-500">Aprovação Lula</span><span>{persona.aprovacao_lula}</span></div>}
          {persona.voto_2026 && <div className="flex justify-between"><span className="text-zinc-500">Intenção 2026</span><span>{persona.voto_2026}</span></div>}
          <div className="flex justify-between"><span className="text-zinc-500">Orientação</span><span>{persona.political_leaning}</span></div>
        </div>
      </SectionCard>

      {/* Temas Polêmicos */}
      {(persona.tema_aborto || persona.tema_armas || persona.tema_maconha) && (
        <SectionCard title="Posições Temáticas" icon={Target} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              ['Aborto', persona.tema_aborto],
              ['Armas', persona.tema_armas],
              ['Maconha', persona.tema_maconha],
              ['Privatizações', persona.tema_privatizacoes],
              ['Cotas Raciais', persona.tema_cotas_raciais],
              ['Casamento Gay', persona.tema_casamento_gay],
            ].filter(([, v]) => v).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'A favor': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Contra': 'bg-red-500/10 text-red-400 border-red-500/20',
                'Neutro': 'bg-zinc-800 text-zinc-400 border-zinc-700/50',
                'Indeciso': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border text-center ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="text-sm font-bold">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Confiança Institucional */}
      {(persona.q_confianca_stf != null || persona.q_confianca_congresso != null) && (
        <SectionCard title="Confiança Institucional" icon={Shield} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              ['STF', persona.q_confianca_stf],
              ['Congresso', persona.q_confianca_congresso],
              ['Imprensa', persona.q_confianca_imprensa],
              ['Polícia', persona.q_confianca_policia],
              ['Exército', persona.q_confianca_exercito],
              ['Igreja', persona.q_confianca_igreja],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const v = Number(value);
              const color = v >= 7 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : v >= 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20';
              return (
                <div key={label as string} className={`rounded-xl p-3 border text-center ${color}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="text-2xl font-bold">{value}<span className="text-xs opacity-60">/10</span></div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Opinião Política */}
      {(persona.q_maior_problema || persona.q_avaliacao_bolsonaro || persona.q_politico_favorito) && (
        <SectionCard title="Opinião Política" icon={Target} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Maior Problema', persona.q_maior_problema],
              ['Aval. Bolsonaro', persona.q_avaliacao_bolsonaro],
              ['Político Favorito', persona.q_politico_favorito],
              ['Sit. Econômica', persona.q_situacao_economica],
              ['Perspectiva Futuro', persona.q_perspectiva_futuro],
              ['Democracia', persona.q_democracia_importante ? `${persona.q_democracia_importante}/10` : null],
              ['Reeleição', persona.q_reeleicao],
              ['Voto Obrigatório', persona.q_voto_obrigatorio],
              ['Corrupção Problema', persona.q_corrupcao_problema],
              ['Impeachment Lula', persona.q_impeachment_lula],
              ['PT Comunista', persona.q_pt_comunista],
              ['Bolsonaro Ditador', persona.q_bolsonaro_ditador],
              ['Fake News Problema', persona.q_fake_news_problema],
              ['Censurar Redes', persona.q_redes_sociais_censuradas],
              ['Intervenção Militar', persona.q_intervencao_militar],
              ['Sist. Eleitoral Confiável', persona.q_sistema_eleitoral_confiavel],
              ['Voto Influenciado Por', persona.q_voto_influenciado_por],
              ['Muda Voto Fácil', persona.q_muda_voto_facilmente],
              ['Pesquisa Influencia', persona.q_pesquisa_influencia],
            ].filter(([, v]) => v != null).map(([label, value]) => (
              <div key={label as string} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">{label}</div>
                <div className="text-zinc-300 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Economia */}
      {(persona.q_salario_minimo_aumentar || persona.q_reforma_tributaria) && (
        <SectionCard title="Questões Econômicas" icon={TrendingUp} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Aumentar Salário Mínimo', persona.q_salario_minimo_aumentar],
              ['Reforma Tributária', persona.q_reforma_tributaria],
              ['Imposto p/ Ricos', persona.q_imposto_ricos],
              ['Tamanho do Estado', persona.q_estado_tamanho],
              ['Bolsa Família Bom', persona.q_bolsa_familia_bom],
              ['Auxílio Emergencial Voltar', persona.q_auxilio_emergencial_voltar],
              ['Desemprego Principal', persona.q_desemprego_principal],
              ['Inflação Controle', persona.q_inflacao_controle],
              ['Bitcoin Confiar', persona.q_bitcoin_confiar],
              ['BC Independente', persona.q_banco_central_independente],
              ['Teto de Gastos', persona.q_teto_gastos],
              ['Reforma Previdência', persona.q_previdencia_reforma],
              ['Manter 13º Salário', persona.q_13_salario_manter],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'Sim': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Não': 'bg-red-500/10 text-red-400 border-red-500/20',
                'A favor': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Contra': 'bg-red-500/10 text-red-400 border-red-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-900/50 text-zinc-300 border-zinc-800/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Costumes e Sociedade */}
      {(persona.q_familia_tradicional || persona.q_feminismo_bom) && (
        <SectionCard title="Costumes e Sociedade" icon={Users} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Família Tradicional', persona.q_familia_tradicional],
              ['Feminismo', persona.q_feminismo_bom],
              ['Racismo Estrutural', persona.q_racismo_estrutural],
              ['Meritocracia', persona.q_meritocracia],
              ['Gênero Biológico', persona.q_genero_biologico],
              ['Linguagem Neutra', persona.q_linguagem_neutra],
              ['Ideologia de Gênero Escola', persona.q_ideologia_genero_escola],
              ['Adoção Homoafetiva', persona.q_adocao_homoafetiva],
              ['Direitos LGBT', persona.q_direitos_lgbt],
              ['Mulher Presidente', persona.q_mulher_presidente],
              ['Facilitar Divórcio', persona.q_divorcio_facilitar],
              ['Religião na Política', persona.q_religiao_politica],
              ['Aborto em Caso de Estupro', persona.q_aborto_estupro],
              ['Legalizar Prostituição', persona.q_prostituicao_legalizar],
              ['Poligamia', persona.q_poligamia],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'Sim': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Não': 'bg-red-500/10 text-red-400 border-red-500/20',
                'A favor': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Contra': 'bg-red-500/10 text-red-400 border-red-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-900/50 text-zinc-300 border-zinc-800/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Segurança e Justiça */}
      {(persona.q_pena_morte || persona.q_policia_violenta) && (
        <SectionCard title="Segurança e Justiça" icon={Shield} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Pena de Morte', persona.q_pena_morte],
              ['Prisão Perpétua', persona.q_prisao_perpetua],
              ['Maioridade Penal 16', persona.q_maioridade_penal_16],
              ['Polícia Violenta', persona.q_policia_violenta],
              ['Descriminalizar Drogas', persona.q_drogas_descriminalizar],
              ['Internar Crack Forçado', persona.q_crack_internar_forcado],
              ['Segurança Prioridade', persona.q_seguranca_prioridade],
              ['Câmera Facial Aceita', persona.q_camera_facial_aceita],
              ['Sofreu Abordagem Policial', persona.q_abordagem_policial_ja_sofreu],
              ['Justiça Funciona', persona.q_justica_funciona],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'Sim': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Não': 'bg-red-500/10 text-red-400 border-red-500/20',
                'A favor': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Contra': 'bg-red-500/10 text-red-400 border-red-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-900/50 text-zinc-300 border-zinc-800/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Meio Ambiente e Ciência */}
      {(persona.q_mudanca_climatica_real || persona.q_vacinas_confiar) && (
        <SectionCard title="Meio Ambiente e Ciência" icon={Sparkles} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Mudança Climática Real', persona.q_mudanca_climatica_real],
              ['Preservar Amazônia', persona.q_amazonia_preservar],
              ['Agronegócio Desmata', persona.q_agronegocio_desmata],
              ['Energia Renovável', persona.q_energia_renovavel],
              ['Confiar em Vacinas', persona.q_vacinas_confiar],
              ['Ciência Importante', persona.q_ciencia_importante],
              ['Queimadas Criminosas', persona.q_queimadas_criminosas],
              ['Terra Plana', persona.q_terra_plana],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'Sim': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Não': 'bg-red-500/10 text-red-400 border-red-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-900/50 text-zinc-300 border-zinc-800/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Educação e Saúde */}
      {(persona.q_sus_funciona || persona.q_universidade_publica_gratuita) && (
        <SectionCard title="Educação e Saúde" icon={Heart} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['SUS Funciona', persona.q_sus_funciona],
              ['Universidade Pública Gratuita', persona.q_universidade_publica_gratuita],
              ['Homeschooling', persona.q_homeschooling],
              ['Ensino a Distância', persona.q_ensino_distancia],
              ['Escola Particular Melhor', persona.q_escola_particular_melhor],
              ['Medicina Pública Boa', persona.q_medicina_publica_boa],
              ['Tem Plano de Saúde', persona.q_plano_saude_tem],
              ['ENEM Justo', persona.q_enem_justo],
            ].filter(([, v]) => v != null).map(([label, value]) => {
              const colorMap: Record<string, string> = {
                'Sim': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Não': 'bg-red-500/10 text-red-400 border-red-500/20',
                'Bom': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                'Ruim': 'bg-red-500/10 text-red-400 border-red-500/20',
              };
              const colors = colorMap[value as string] || 'bg-zinc-900/50 text-zinc-300 border-zinc-800/50';
              return (
                <div key={label as string} className={`rounded-xl p-3 border ${colors}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Questionário — Mídia e Consumo Digital */}
      {(persona.q_midia_principal || persona.q_whatsapp_noticias) && (
        <SectionCard title="Mídia e Consumo Digital" icon={Tv} className="md:col-span-2 lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Mídia Principal', persona.q_midia_principal],
              ['WhatsApp p/ Notícias', persona.q_whatsapp_noticias],
              ['Usa Instagram', persona.q_instagram_usa],
              ['Usa TikTok', persona.q_tiktok_usa],
              ['Assiste YouTube', persona.q_youtube_assiste],
              ['Ouve Podcast', persona.q_podcast_ouve],
              ['Assina Streaming', persona.q_streaming_assina],
            ].filter(([, v]) => v != null).map(([label, value]) => (
              <div key={label as string} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">{label}</div>
                <div className="text-zinc-300 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Renda (only if JSON data available) */}
      {finance && (
        <SectionCard title="Renda e Finanças" icon={TrendingUp}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Renda Individual</span><span className="font-bold text-green-400">R$ {finance.renda_mensal_individual?.toLocaleString()}</span></div>
            {finance.renda_familiar_total && <div className="flex justify-between"><span className="text-zinc-500">Renda Familiar</span><span>R$ {finance.renda_familiar_total.toLocaleString()}</span></div>}
            {finance.faixa_renda_ibge && <div className="flex justify-between"><span className="text-zinc-500">Faixa IBGE</span><span>{finance.faixa_renda_ibge}</span></div>}
            {finance.poder_de_compra_nivel && <StatItem label="Poder de Compra" value={finance.poder_de_compra_nivel} color="bg-emerald-500" />}
          </div>
        </SectionCard>
      )}

      {/* IBGE (only if data available) */}
      {ibge && (
        <SectionCard title="Dados IBGE" icon={Compass}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">IDH Municipal</span><span className="font-bold">{ibge.indice_desenvolvimento_humano_municipal}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Densidade</span><span>{ibge.densidade_demografica_local}</span></div>
            {ibge.perfil_regional_ibge && <div className="text-zinc-400 text-xs mt-2">{ibge.perfil_regional_ibge}</div>}
          </div>
        </SectionCard>
      )}

      {/* Posicionamento Ideológico 2D */}
      {(persona.score_economico != null && persona.score_costumes != null) && (
        <SectionCard title="Posicionamento Ideológico 2D" icon={Target} className="md:col-span-2 lg:col-span-3">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* 2D Chart */}
            <div className="relative w-full max-w-[320px] aspect-square mx-auto lg:mx-0">
              {/* Grid background */}
              <div className="absolute inset-0 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden">
                {/* Quadrant colors */}
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-blue-500/[0.03]" />
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-violet-500/[0.03]" />
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-red-500/[0.03]" />
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-amber-500/[0.03]" />
                {/* Grid lines */}
                <div className="absolute left-1/2 top-0 w-px h-full bg-zinc-700/40" />
                <div className="absolute top-1/2 left-0 h-px w-full bg-zinc-700/40" />
                {/* Persona dot */}
                <div
                  className="absolute w-4 h-4 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40 -translate-x-1/2 -translate-y-1/2 ring-2 ring-emerald-400/20 z-10"
                  style={{
                    left: `${((persona.score_economico + 1) / 2) * 100}%`,
                    top: `${((persona.score_costumes + 1) / 2) * 100}%`,
                  }}
                />
              </div>
              {/* Axis labels */}
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full text-[9px] text-zinc-500 font-bold whitespace-nowrap">Estado forte</span>
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full text-[9px] text-zinc-500 font-bold whitespace-nowrap">Mercado livre</span>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] text-zinc-500 font-bold pb-1">Progressista</span>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full text-[9px] text-zinc-500 font-bold pt-1">Conservador</span>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-6">
              {persona.nome_grupo && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Cluster Ideológico</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <span className="text-emerald-400/60 font-bold text-sm">{persona.cluster_id}</span>
                    <span className="text-emerald-400 font-bold text-sm">{persona.nome_grupo}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Eixo Econômico</p>
                  <p className="text-2xl font-bold text-white">{persona.score_economico?.toFixed(3)}</p>
                  <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-zinc-400 to-blue-500 rounded-full"
                      style={{ width: '100%', clipPath: `inset(0 ${100 - ((persona.score_economico + 1) / 2) * 100}% 0 0)` }}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">
                    {persona.score_economico < -0.3 ? 'Redistributivo' : persona.score_economico > 0.3 ? 'Pró-mercado' : 'Centro econômico'}
                  </p>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Eixo Costumes</p>
                  <p className="text-2xl font-bold text-white">{persona.score_costumes?.toFixed(3)}</p>
                  <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 via-zinc-400 to-amber-500 rounded-full"
                      style={{ width: '100%', clipPath: `inset(0 ${100 - ((persona.score_costumes + 1) / 2) * 100}% 0 0)` }}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">
                    {persona.score_costumes < -0.3 ? 'Progressista' : persona.score_costumes > 0.3 ? 'Conservador' : 'Neutro'}
                  </p>
                </div>
              </div>

              <div className="text-xs text-zinc-500 space-y-1">
                <p>Orientação política: <span className="text-zinc-300">{persona.political_leaning}</span></p>
                <p>Voto 2022 baseado no perfil do cluster</p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function PsychologyTab({ persona }: { persona: any }) {
  const psych = persona.psychology_json;
  const bigFive = psych?.big_five_ocean;
  const disc = psych?.disc_profile;
  const enneagram = psych?.enneagram;
  const archetypes = psych?.archetypes;
  const values = psych?.core_values;
  const outlook = psych?.outlook;
  const astro = psych?.astrology;

  if (!psych || Object.keys(psych).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Brain size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados psicológicos detalhados não disponíveis para esta persona.</p>
        {persona.disc_main_factor && (
          <p className="text-zinc-400 text-sm mt-3">DISC Dominante: <span className="font-bold text-white">{persona.disc_main_factor}</span></p>
        )}
        {persona.archetype_primary && (
          <p className="text-zinc-400 text-sm mt-1">Arquétipo: <span className="font-bold text-white">{persona.archetype_primary}</span></p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Big Five */}
      <SectionCard title="Big Five (OCEAN)" icon={Brain} className="md:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{bigFive?.openness}</div>
              <div className="text-xs text-zinc-500 uppercase">Abertura</div>
            </div>
            <ProgressBar value={bigFive?.openness} color="bg-blue-500" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{bigFive?.conscientiousness}</div>
              <div className="text-xs text-zinc-500 uppercase">Conscienciosidade</div>
            </div>
            <ProgressBar value={bigFive?.conscientiousness} color="bg-green-500" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{bigFive?.extraversion}</div>
              <div className="text-xs text-zinc-500 uppercase">Extroversão</div>
            </div>
            <ProgressBar value={bigFive?.extraversion} color="bg-yellow-500" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{bigFive?.agreeableness}</div>
              <div className="text-xs text-zinc-500 uppercase">Amabilidade</div>
            </div>
            <ProgressBar value={bigFive?.agreeableness} color="bg-pink-500" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{bigFive?.neuroticism}</div>
              <div className="text-xs text-zinc-500 uppercase">Neuroticismo</div>
            </div>
            <ProgressBar value={bigFive?.neuroticism} color="bg-red-500" />
          </div>
        </div>
      </SectionCard>

      {/* DISC */}
      <SectionCard title="Perfil DISC" icon={Target}>
        <div className="space-y-4">
          <StatItem label="Dominância (D)" value={disc?.dominance} color="bg-red-500" />
          <StatItem label="Influência (I)" value={disc?.influence} color="bg-yellow-500" />
          <StatItem label="Estabilidade (S)" value={disc?.steadiness} color="bg-green-500" />
          <StatItem label="Conformidade (C)" value={disc?.compliance} color="bg-blue-500" />
        </div>
      </SectionCard>

      {/* Enneagram */}
      <SectionCard title="Eneagrama" icon={Sparkles}>
        <div className="text-center mb-4">
          <div className="text-5xl font-bold text-purple-400">{enneagram?.core_type}</div>
          <div className="text-zinc-400">Asa {enneagram?.wing}</div>
        </div>
        <StatItem label="Nível de Integração" value={enneagram?.integration_level} color="bg-purple-500" />
      </SectionCard>

      {/* Arquétipos */}
      <SectionCard title="Arquétipos Junguianos" icon={User}>
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="text-xs text-amber-400 uppercase mb-1">Primário</div>
            <div className="text-lg font-bold">{archetypes?.primary}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase mb-1">Secundário</div>
            <div className="font-medium">{archetypes?.secondary}</div>
          </div>
          <StatItem label="Nível de Influência" value={archetypes?.influence_level} color="bg-amber-500" />
        </div>
      </SectionCard>

      {/* Valores */}
      <SectionCard title="Valores Centrais" icon={Heart}>
        <div className="space-y-3">
          {values?.map((v: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300">{v.value}</span>
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <ProgressBar value={v.priority} color="bg-rose-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{v.priority}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Perspectiva */}
      <SectionCard title="Perspectiva de Vida" icon={TrendingUp}>
        <div className="space-y-4">
          <StatItem label="Otimismo" value={outlook?.optimism_level} color="bg-emerald-500" />
          <StatItem label="Pessimismo" value={outlook?.pessimism_level} color="bg-zinc-500" />
          <StatItem label="Resiliência" value={outlook?.resilience_score} color="bg-blue-500" />
        </div>
      </SectionCard>

      {/* Astrologia */}
      <SectionCard title="Astrologia" icon={Star} className="md:col-span-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="text-xs text-zinc-500 uppercase mb-1">Sol</div>
            <div className="font-bold text-yellow-400">{astro?.sun_sign}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="text-xs text-zinc-500 uppercase mb-1">Lua</div>
            <div className="font-bold text-blue-300">{astro?.moon_sign}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="text-xs text-zinc-500 uppercase mb-1">Ascendente</div>
            <div className="font-bold text-purple-400">{astro?.rising_sign}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="text-xs text-zinc-500 uppercase mb-1">Influência</div>
            <div className="font-bold">{astro?.astrological_map_influence}/10</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function BeliefsTab({ persona }: { persona: any }) {
  const beliefs = persona.beliefs_json;
  const religion = beliefs?.religião;
  const politics = beliefs?.orientação_política;
  const biases = beliefs?.vieses_cognitivos;
  const objections = beliefs?.objeções_padrões;
  const aversions = beliefs?.aversões;

  if (!beliefs || Object.keys(beliefs).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Shield size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados detalhados de crenças não disponíveis para esta persona.</p>
        <div className="mt-4 space-y-2 text-sm">
          {persona.macro_religion && <p className="text-zinc-400">Religião: <span className="font-bold text-white">{persona.macro_religion}</span></p>}
          {persona.political_leaning && <p className="text-zinc-400">Orientação Política: <span className="font-bold text-white">{persona.political_leaning}</span></p>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Religião */}
      <SectionCard title="Religião e Espiritualidade" icon={Sparkles}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Fé/Doutrina</span><span className="font-medium">{religion?.fé_ou_doutrina}</span></div>
          <StatItem label="Frequência de Prática" value={religion?.frequência_prática} color="bg-purple-500" />
          <StatItem label="Influência Dogmática" value={religion?.influência_dogmática} color="bg-purple-500" />
          <div className="mt-4">
            <div className="text-xs text-zinc-500 uppercase mb-2">Tabus Associados</div>
            <div className="flex flex-wrap gap-2">
              {religion?.tabus_associados?.map((t: string, i: number) => (
                <span key={i} className="px-2 py-1 bg-zinc-800 rounded text-xs">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Política */}
      <SectionCard title="Orientação Política" icon={Shield}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Espectro</span><span className="font-bold">{politics?.espectro}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Valor Prioritário</span><span>{politics?.valor_prioritário}</span></div>
          <StatItem label="Polarização" value={politics?.nível_de_polarização} color="bg-red-500" />
          <StatItem label="Engajamento Militante" value={politics?.engajamento_militante} color="bg-orange-500" />
        </div>
      </SectionCard>

      {/* Vieses Cognitivos */}
      <SectionCard title="Vieses Cognitivos" icon={Brain} className="md:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {biases?.map((bias: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
              <span className="text-zinc-300">{bias.nome}</span>
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <ProgressBar value={bias.nível} color="bg-amber-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{bias.nível}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Objeções */}
      <SectionCard title="Objeções Padrões" icon={AlertTriangle}>
        <div className="space-y-3">
          {objections?.map((obj: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300 text-sm">{obj.categoria}</span>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <ProgressBar value={obj.força} color="bg-red-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{obj.força}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Aversões */}
      <SectionCard title="Aversões" icon={Shield}>
        <div className="space-y-3">
          {aversions?.map((av: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300 text-sm">{av.alvo}</span>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <ProgressBar value={av.nível} color="bg-orange-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{av.nível}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function CareerTab({ persona }: { persona: any }) {
  const career = persona.career_json;
  const job = career?.atuação_e_cargo;
  const hardSkills = career?.hard_skills;
  const softSkills = career?.soft_skills;
  const context = career?.contexto_profissional;
  const comm = career?.comunicação_e_linguagem;

  if (!career || Object.keys(career).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Briefcase size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de carreira detalhados não disponíveis para esta persona.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Cargo Atual */}
      <SectionCard title="Atuação e Cargo" icon={Briefcase} className="md:col-span-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase mb-1">Cargo</div>
            <div className="font-bold text-emerald-400">{job?.cargo_atual}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase mb-1">Área</div>
            <div className="font-medium">{job?.área_principal}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase mb-1">Setor</div>
            <div className="font-medium">{job?.setor}</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase mb-1">Experiência</div>
            <div className="font-medium">{job?.tempo_experiência_anos} anos</div>
          </div>
        </div>
      </SectionCard>

      {/* Hard Skills */}
      <SectionCard title="Hard Skills" icon={Target}>
        <div className="space-y-3">
          {hardSkills?.map((skill: any, i: number) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-300">{skill.competência}</span>
                <span className="text-zinc-500">{skill.nível}/10</span>
              </div>
              <ProgressBar value={skill.nível} color="bg-cyan-500" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Soft Skills */}
      <SectionCard title="Soft Skills" icon={Users}>
        <div className="space-y-3">
          {softSkills?.map((skill: any, i: number) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-300">{skill.competência}</span>
                <span className="text-zinc-500">{skill.nível}/10</span>
              </div>
              <ProgressBar value={skill.nível} color="bg-pink-500" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Contexto Profissional */}
      <SectionCard title="Contexto Profissional" icon={TrendingUp}>
        <div className="space-y-4">
          <StatItem label="Satisfação na Carreira" value={context?.satisfação_carreira} color="bg-emerald-500" />
          <StatItem label="Ambição Profissional" value={context?.ambição_proffisional} color="bg-amber-500" />
          <StatItem label="Equilíbrio Vida/Trabalho" value={context?.equilíbrio_vida_trabalho} color="bg-blue-500" />
        </div>
      </SectionCard>

      {/* Comunicação */}
      <SectionCard title="Comunicação e Linguagem" icon={MessageSquare}>
        <div className="space-y-4">
          <StatItem label="Eloquência" value={comm?.eloquência} color="bg-purple-500" />
          <StatItem label="Assertividade" value={comm?.assertividade} color="bg-orange-500" />
          <StatItem label="Formalidade" value={comm?.nível_formalidade} color="bg-zinc-500" />
          <StatItem label="Jargão Técnico" value={comm?.uso_de_jargão_técnico} color="bg-cyan-500" />
          <StatItem label="Regionalismo" value={comm?.regionalismo_na_fala} color="bg-green-500" />
        </div>
      </SectionCard>
    </div>
  );
}

function LifestyleTab({ persona }: { persona: any }) {
  const lifestyle = persona.lifestyle_json;
  const rhythm = lifestyle?.ritmo_e_cronotipo;
  const media = lifestyle?.consumo_de_mídias;
  const habits = lifestyle?.hábitos_positivos;
  const addictions = lifestyle?.vícios_e_dependências;
  const interPersonal = lifestyle?.relações_interpessoais;
  const intraPersonal = lifestyle?.relações_intrapessoais_e_materiais;

  if (!lifestyle || Object.keys(lifestyle).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Activity size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de estilo de vida não disponíveis para esta persona.</p>
        {persona.cronotype && <p className="text-zinc-400 text-sm mt-3">Cronotipo: <span className="font-bold text-white">{persona.cronotype}</span></p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Cronotipo */}
      <SectionCard title="Ritmo e Cronotipo" icon={Clock}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Tipo</span><span className="font-bold">{rhythm?.tipo}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Pico de Energia</span><span>{rhythm?.pico_de_energia}</span></div>
          <StatItem label="Qualidade do Sono" value={rhythm?.qualidade_do_sono} color="bg-indigo-500" />
        </div>
      </SectionCard>

      {/* Consumo de Mídias */}
      <SectionCard title="Consumo de Mídias" icon={Tv}>
        <div className="space-y-4">
          <StatItem label="Notícias e Atualidades" value={media?.notícias_e_atualidades} color="bg-blue-500" />
          <StatItem label="Entretenimento/Streaming" value={media?.entretenimento_streaming} color="bg-red-500" />
          <StatItem label="Mídia Tradicional" value={media?.influência_da_mídia_tradicional} color="bg-zinc-500" />
          <div className="mt-4">
            <div className="text-xs text-zinc-500 uppercase mb-2">Redes Sociais</div>
            <div className="flex flex-wrap gap-2">
              {media?.redes_sociais_predominantes?.map((r: string, i: number) => (
                <span key={i} className="px-2 py-1 bg-zinc-800 rounded text-xs">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Hábitos Positivos */}
      <SectionCard title="Hábitos Positivos" icon={Sparkles}>
        <div className="space-y-3">
          {habits?.map((h: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300 text-sm">{h.hábito}</span>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <ProgressBar value={h.frequência_nível} color="bg-emerald-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{h.frequência_nível}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Vícios */}
      <SectionCard title="Vícios e Dependências" icon={AlertTriangle}>
        <div className="space-y-3">
          {addictions?.map((v: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300 text-sm">{v.tipo}</span>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <ProgressBar value={v.intensidade} color={v.intensidade > 5 ? 'bg-red-500' : 'bg-yellow-500'} />
                </div>
                <span className="text-xs text-zinc-500 w-6">{v.intensidade}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Relações Interpessoais */}
      <SectionCard title="Relações Interpessoais" icon={Users}>
        <div className="space-y-4">
          <StatItem label="Sociabilidade" value={interPersonal?.sociabilidade} color="bg-yellow-500" />
          <StatItem label="Vínculo Familiar" value={interPersonal?.vínculo_familiar} color="bg-pink-500" />
          <StatItem label="Confiança nas Pessoas" value={interPersonal?.confiança_nas_pessoas} color="bg-blue-500" />
          <StatItem label="Dependência de Aprovação" value={interPersonal?.dependência_de_aprovação_social} color="bg-orange-500" />
        </div>
      </SectionCard>

      {/* Relações Intrapessoais */}
      <SectionCard title="Relações Intrapessoais" icon={Heart}>
        <div className="space-y-4">
          <StatItem label="Autoestima" value={intraPersonal?.autoestima} color="bg-emerald-500" />
          <StatItem label="Foco em Autodesenvolvimento" value={intraPersonal?.foco_em_autodesenvolvimento} color="bg-purple-500" />
          <StatItem label="Materialismo" value={intraPersonal?.materialismo_e_consumo} color="bg-amber-500" />
          <StatItem label="Apego a Bens" value={intraPersonal?.apego_a_bens_físicos} color="bg-zinc-500" />
        </div>
      </SectionCard>
    </div>
  );
}

function HealthTab({ persona }: { persona: any }) {
  const health = persona.health_json;
  const physical = health?.atividades_fisicas;
  const leisure = health?.atividades_de_lazer;
  const conditions = health?.condições_e_doenças;
  const satisfaction = health?.satisfação_com_a_vida;
  const mental = health?.saude_mental_e_estresse;

  if (!health || Object.keys(health).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Heart size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de saúde não disponíveis para esta persona.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Atividades Físicas */}
      <SectionCard title="Atividades Físicas" icon={Dumbbell}>
        <div className="space-y-4">
          {physical?.map((a: any, i: number) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{a.tipo}</span>
                <span className="text-xs text-zinc-500">{a.frequência_nível}/10</span>
              </div>
              <div className="text-xs text-zinc-400">{a.objetivo}</div>
              <ProgressBar value={a.frequência_nível} color="bg-green-500" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Lazer */}
      <SectionCard title="Atividades de Lazer" icon={Sparkles}>
        <div className="space-y-3">
          {leisure?.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300 text-sm">{l.atividade}</span>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <ProgressBar value={l.interesse_nível} color="bg-purple-500" />
                </div>
                <span className="text-xs text-zinc-500 w-6">{l.interesse_nível}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Condições de Saúde */}
      <SectionCard title="Condições de Saúde" icon={Activity}>
        <div className="space-y-4 text-sm">
          <StatItem label="Qualidade da Alimentação" value={conditions?.qualidade_da_alimentação} color="bg-green-500" />
          <StatItem label="Disposição Física" value={conditions?.nível_de_disposição_física} color="bg-blue-500" />
          
          {conditions?.doenças_crônicas?.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 uppercase mb-2">Doenças Crônicas</div>
              <div className="flex flex-wrap gap-2">
                {conditions.doenças_crônicas.map((d: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs">{d}</span>
                ))}
              </div>
            </div>
          )}

          {conditions?.histórico_de_lesões?.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 uppercase mb-2">Histórico de Lesões</div>
              <div className="flex flex-wrap gap-2">
                {conditions.histórico_de_lesões.map((l: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-xs">{l}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Satisfação com a Vida */}
      <SectionCard title="Satisfação com a Vida" icon={Heart}>
        <div className="space-y-4">
          <StatItem label="Índice Geral" value={satisfaction?.índice_geral} color="bg-emerald-500" />
          <StatItem label="Equilíbrio Emocional" value={satisfaction?.equilíbrio_emocional} color="bg-blue-500" />
          <StatItem label="Percepção de Sucesso" value={satisfaction?.percepção_de_sucesso} color="bg-amber-500" />
        </div>
      </SectionCard>

      {/* Saúde Mental */}
      <SectionCard title="Saúde Mental e Estresse" icon={Brain} className="md:col-span-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <StatItem label="Estresse Crônico" value={mental?.nível_estresse_crônico} color="bg-red-500" />
          </div>
          <div className="space-y-2">
            <StatItem label="Resiliência Psicológica" value={mental?.resiliência_psicológica} color="bg-blue-500" />
          </div>
          <div className="space-y-2">
            <StatItem label="Cuidados com Saúde Mental" value={mental?.cuidados_com_saúde_mental} color="bg-green-500" />
          </div>
          <div className="space-y-2">
            <StatItem label="Terapia/Meditação" value={mental?.frequência_terapia_ou_meditação} color="bg-purple-500" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function TabuImplicitoTab({ persona }: { persona: any }) {
  const items: [string, string | null][] = [
    ['Racismo Latente', persona.q_ti_racismo_latente],
    ['Não Contrataria Negro na Chefia', persona.q_ti_nao_contrataria_negro_chefia],
    ['Vizinho Negro Incomoda', persona.q_ti_vizinho_negro_incomoda],
    ['Sonegaria Imposto', persona.q_ti_sonegaria_imposto],
    ['Aceitaria Propina', persona.q_ti_aceitaria_propina],
    ['Venderia Voto', persona.q_ti_venderia_voto],
    ['Bater em Filho é Normal', persona.q_ti_bater_filho_normal],
    ['Mulher com Roupa Curta é Culpada', persona.q_ti_mulher_roupa_culpada],
    ['Homofobia Violenta', persona.q_ti_homofobia_violenta],
    ['Apoiaria Linchamento', persona.q_ti_linchamento_apoiaria],
    ['Tortura de Preso é OK', persona.q_ti_tortura_preso_ok],
    ['Trabalho Infantil é OK', persona.q_ti_trabalho_infantil_ok],
    ['Jeitinho / Furar Fila', persona.q_ti_jeitinho_furar_fila],
    ['Assediaria Mulher na Rua', persona.q_ti_assediaria_mulher_rua],
    ['Intolerância Religiosa', persona.q_ti_intolerancia_religiosa],
    ['Preconceito com Nordestino', persona.q_ti_preconceito_nordestino],
    ['Violência Doméstica OK', persona.q_ti_violencia_domestica],
    ['Compraria Produto Roubado', persona.q_ti_compraria_produto_roubado],
    ['Menor de 14 Sabe o que Faz', persona.q_ti_menor14_sabe_o_que_faz],
    ['Nepotismo em Concurso', persona.q_ti_nepotismo_concurso],
  ];

  const hasAny = items.some(([, v]) => v != null);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <EyeOff size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de tabu implícito não disponíveis para esta persona.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          Estes dados representam vieses ocultos da persona — atitudes que geralmente não são expressas publicamente mas influenciam comportamento e opiniões. São fundamentais para a fidelidade da simulação.
        </p>
      </div>

      <SectionCard title="Tabu Implícito" icon={EyeOff} className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.filter(([, v]) => v != null).map(([label, value]) => {
            const isSim = value === 'Sim';
            const colors = isSim
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            return (
              <div key={label} className={`rounded-xl p-3 border ${colors} flex items-center justify-between`}>
                <span className="text-xs font-medium">{label}</span>
                <span className="text-xs font-bold">{value}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function VivenciasTab({ persona }: { persona: any }) {
  const items: [string, string | null][] = [
    ['Abuso Sexual na Infância', persona.q_vi_abuso_sexual_infancia],
    ['Passou Fome', persona.q_vi_passou_fome],
    ['Trabalho Infantil', persona.q_vi_trabalho_infantil],
    ['Já Foi Assaltado', persona.q_vi_ja_foi_assaltado],
    ['Perdeu Familiar por Violência', persona.q_vi_perdeu_familiar_violencia],
    ['Desempregado +1 Ano', persona.q_vi_desempregado_1ano],
    ['Pai Ausente', persona.q_vi_pai_ausente],
    ['Sofreu Racismo', persona.q_vi_sofreu_racismo],
    ['Sofreu Assédio Sexual', persona.q_vi_sofreu_assedio_sexual],
    ['Depressão / Ansiedade', persona.q_vi_depressao_ansiedade],
    ['Pensou em Suicídio', persona.q_vi_pensou_suicidio],
    ['Preso ou Familiar Preso', persona.q_vi_preso_ou_familiar_preso],
    ['Sofreu Violência Doméstica', persona.q_vi_sofreu_violencia_domestica],
    ['Já Dormiu na Rua', persona.q_vi_ja_dormiu_na_rua],
    ['Violência Policial', persona.q_vi_violencia_policial],
    ['Não Completou Estudo', persona.q_vi_nao_completou_estudo],
    ['Enchente / Desastre', persona.q_vi_enchente_desastre],
    ['Dependência Química', persona.q_vi_dependencia],
  ];

  const hasAny = items.some(([, v]) => v != null);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Flame size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de vivências não disponíveis para esta persona.</p>
      </div>
    );
  }

  const simItems = items.filter(([, v]) => v === 'Sim');
  const naoItems = items.filter(([, v]) => v === 'Não');

  return (
    <div className="space-y-6">
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-5">
        <p className="text-xs text-violet-400/80 leading-relaxed">
          Vivências e vulnerabilidades que moldaram a perspectiva de vida desta persona. Experiências traumáticas e de superação que influenciam profundamente como ela se posiciona em debates.
        </p>
      </div>

      {simItems.length > 0 && (
        <SectionCard title="Experiências Vividas" icon={Flame}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {simItems.map(([label]) => (
              <div key={label} className="rounded-xl p-3 border bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {naoItems.length > 0 && (
        <SectionCard title="Não Vivenciou" icon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {naoItems.map(([label]) => (
              <div key={label} className="rounded-xl p-3 border bg-zinc-800/50 text-zinc-500 border-zinc-700/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function HistoryTab({ persona }: { persona: any }) {
  const history = persona.history_json;
  const bio = history?.biografia_base;
  const family = history?.nucleo_familiar;
  const aspirations = history?.aspiracoes;
  const traumas = history?.traumas_e_feridas;
  const recentEvents = history?.eventos_recentes;
  const historicalEvents = history?.eventos_historicos_vivenciados;

  if (!history || Object.keys(history).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <BookOpen size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Dados de história pessoal não disponíveis para esta persona.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Biografia */}
      <SectionCard title="Biografia" icon={BookOpen} className="md:col-span-2">
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
          <p className="text-zinc-300 leading-relaxed">{bio?.resumo_narrativo}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Contexto de Origem</span>
            <p className="text-zinc-300">{bio?.contexto_de_origem}</p>
          </div>
          <div>
            <span className="text-zinc-500">Influência Educacional</span>
            <p className="text-zinc-300">{bio?.influencia_educacional}</p>
          </div>
        </div>
      </SectionCard>

      {/* Núcleo Familiar */}
      <SectionCard title="Núcleo Familiar" icon={Users}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Pais</span><span className="text-right max-w-[180px]">{family?.pais}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Parceiro(a)</span><span>{family?.parceiro_a}</span></div>
          <div className="mt-4">
            <span className="text-zinc-500">Dinâmica Relacional</span>
            <p className="text-zinc-300 mt-1">{family?.dinamica_relacional}</p>
          </div>
        </div>
      </SectionCard>

      {/* Aspirações */}
      <SectionCard title="Aspirações" icon={Target}>
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="text-xs text-amber-400 uppercase mb-1">Sonhos de Vida</div>
            <p className="text-zinc-300 text-sm">{aspirations?.sonhos_de_vida}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <div className="text-xs text-emerald-400 uppercase mb-1">Curto Prazo</div>
            <p className="text-zinc-300 text-sm">{aspirations?.objetivos_curto_prazo}</p>
          </div>
          <StatItem label="Medo do Fracasso" value={aspirations?.medo_do_fracasso} color="bg-red-500" />
        </div>
      </SectionCard>

      {/* Traumas */}
      <SectionCard title="Traumas e Feridas" icon={AlertTriangle} className="md:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {traumas?.map((trauma: any, i: number) => (
            <div key={i} className="bg-red-950/20 rounded-lg p-4 border border-red-900/30">
              <p className="text-zinc-300 font-medium mb-2">{trauma.descricao}</p>
              <StatItem label="Intensidade da Cicatriz" value={trauma.intensidade_da_cicatriz} color="bg-red-500" />
              <div className="flex flex-wrap gap-1 mt-3">
                {trauma.gatilhos?.map((g: string, j: number) => (
                  <span key={j} className="text-xs px-2 py-0.5 bg-red-900/40 text-red-300 rounded">{g}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Eventos Recentes */}
      <SectionCard title="Eventos Recentes" icon={Clock}>
        <div className="space-y-4">
          {recentEvents?.map((event: any, i: number) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
              <div className="font-medium text-zinc-200 mb-2">{event.evento}</div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Impacto Emocional: {event.impacto_emocional}/10</span>
                <span className={`px-2 py-0.5 rounded ${event.mudança_de_prioridade === 'Alta' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                  Prioridade: {event.mudança_de_prioridade}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Eventos Históricos */}
      <SectionCard title="Eventos Históricos Vivenciados" icon={BookOpen}>
        <div className="space-y-4">
          {historicalEvents?.map((event: any, i: number) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-zinc-200">{event.evento}</span>
                <span className="text-xs text-zinc-500">{event.nível_de_influência}/10</span>
              </div>
              <p className="text-xs text-zinc-400">{event.percepção_pessoal}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
