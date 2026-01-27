'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
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
  Menu
} from 'lucide-react';

export default function PersonaProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [persona, setPersona] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-black text-white flex overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-zinc-900">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <Menu size={24} />
              </button>
              <Link href="/" className="text-zinc-500 hover:text-white transition-all p-2 hover:bg-zinc-900 rounded-xl">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="font-bold text-lg md:text-xl tracking-tight truncate">Perfil da Persona</h1>
            </div>
            <Link 
              href={`/chat/${id}`}
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
          {activeTab === 'psychology' && <PsychologyTab persona={persona} />}
          {activeTab === 'beliefs' && <BeliefsTab persona={persona} />}
          {activeTab === 'career' && <CareerTab persona={persona} />}
          {activeTab === 'lifestyle' && <LifestyleTab persona={persona} />}
          {activeTab === 'health' && <HealthTab persona={persona} />}
          {activeTab === 'history' && <HistoryTab persona={persona} />}
        </main>
      </div>
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Identidade Básica */}
      <SectionCard title="Identidade Básica" icon={User}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Nome</span><span>{identity?.nome_completo}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Idade</span><span>{identity?.idade} anos</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Gênero</span><span>{genderIdentity}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Etnia</span><span>{identity?.etnia}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Altura</span><span>{identity?.altura_cm} cm</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Peso</span><span>{identity?.peso_kg} kg</span></div>
        </div>
      </SectionCard>

      {/* Localização */}
      <SectionCard title="Localização" icon={MapPin}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Cidade</span><span>{geo?.cidade}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Estado</span><span>{geo?.estado}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Região</span><span>{regionBr}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Tipo de Área</span><span>{areaType}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Coordenadas</span><span className="text-xs text-zinc-400">{geo?.coordenadas?.latitude}, {geo?.coordenadas?.longitude}</span></div>
        </div>
      </SectionCard>

      {/* Socioeconômico */}
      <SectionCard title="Perfil Socioeconômico" icon={TrendingUp}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Classe Social</span><span className="font-bold text-emerald-400">{socialClass}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Escolaridade</span><span>{educationLevel}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Setor</span><span>{socio?.setor_economico}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Ocupação</span><span className="text-right max-w-[150px] truncate">{socio?.ocupacao_principal}</span></div>
        </div>
      </SectionCard>

      {/* Renda */}
      <SectionCard title="Renda e Finanças" icon={TrendingUp}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Renda Individual</span><span className="font-bold text-green-400">R$ {finance?.renda_mensal_individual?.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Renda Familiar</span><span>R$ {finance?.renda_familiar_total?.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Faixa IBGE</span><span>{finance?.faixa_renda_ibge}</span></div>
          <StatItem label="Poder de Compra" value={finance?.poder_de_compra_nivel} color="bg-emerald-500" />
        </div>
      </SectionCard>

      {/* Família */}
      <SectionCard title="Família e Estado Civil" icon={Users}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Estado Civil</span><span>{civilStatus}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Mora com</span><span>{family?.mora_com}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Tem Filhos</span><span>{family?.tem_filhos ? 'Sim' : 'Não'}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Dependentes</span><span>{family?.dependentes}</span></div>
        </div>
      </SectionCard>

      {/* IBGE */}
      <SectionCard title="Dados IBGE" icon={Compass}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">IDH Municipal</span><span className="font-bold">{ibge?.indice_desenvolvimento_humano_municipal}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Densidade</span><span>{ibge?.densidade_demografica_local}</span></div>
          <div className="text-zinc-400 text-xs mt-2">{ibge?.perfil_regional_ibge}</div>
        </div>
      </SectionCard>
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

function HistoryTab({ persona }: { persona: any }) {
  const history = persona.history_json;
  const bio = history?.biografia_base;
  const family = history?.nucleo_familiar;
  const aspirations = history?.aspiracoes;
  const traumas = history?.traumas_e_feridas;
  const recentEvents = history?.eventos_recentes;
  const historicalEvents = history?.eventos_historicos_vivenciados;

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
