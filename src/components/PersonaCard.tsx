import Link from 'next/link';
import { MapPin, MessageSquare, User, Briefcase, Shield, Sparkles, Target, Compass, Users, TrendingUp } from 'lucide-react';

interface PersonaCardProps {
  persona: {
    id: string;
    name: string;
    age: number;
    city: string;
    state: string;
    gender: string;
    photo_path?: string;
    gender_identity?: string;
    civil_status?: string;
    social_class?: string;
    education_level?: string;
    generation?: string;
    political_leaning?: string;
    archetype_primary?: string;
    disc_main_factor?: string;
    macro_religion?: string;
    cronotype?: string;
    region_br?: string;
    area_type?: string;
    apelido_politico?: string;
    cluster_id?: string;
    nome_grupo?: string;
    score_economico?: number;
    score_costumes?: number;
    psychology_json: any;
    career_json: any;
    beliefs_json: any;
    demographic_json: any;
  };
}

function IdeologyDot({ scoreEco, scoreCost }: { scoreEco: number; scoreCost: number }) {
  // Map -1..+1 to 0..100%
  const left = ((scoreEco + 1) / 2) * 100;
  const top = ((scoreCost + 1) / 2) * 100;
  return (
    <div className="relative w-10 h-10 bg-zinc-800/60 rounded-lg border border-zinc-700/30 shrink-0" title={`Eco: ${scoreEco.toFixed(2)} | Cost: ${scoreCost.toFixed(2)}`}>
      <div className="absolute w-px h-full left-1/2 top-0 bg-zinc-700/40" />
      <div className="absolute h-px w-full top-1/2 left-0 bg-zinc-700/40" />
      <div
        className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${left}%`, top: `${top}%` }}
      />
    </div>
  );
}

export function PersonaCard({ persona }: PersonaCardProps) {
  const archetype = persona.archetype_primary || persona.psychology_json?.archetypes?.primary || 'Neutro';
  const occupation = persona.career_json?.atuação_e_cargo?.cargo_atual || 'Não informado';
  const religion = persona.macro_religion || persona.beliefs_json?.religião?.fé_ou_doutrina || 'Não informada';
  const politics = persona.political_leaning || persona.beliefs_json?.orientação_política?.espectro || 'Não informada';
  const disc = persona.psychology_json?.disc_profile;
  const maritalStatus = persona.civil_status || persona.demographic_json?.familia_e_estado_civil?.estado_civil || 'Não informado';
  const income = persona.demographic_json?.renda_e_financas?.renda_mensal_individual;
  const clusterLabel = persona.nome_grupo || null;
  const hasScores = persona.score_economico != null && persona.score_costumes != null;

  // Encontrar o perfil DISC dominante
  const discDominante = persona.disc_main_factor || (disc ? Object.entries(disc).reduce((a, b) => (a[1] as number) > (b[1] as number) ? a : b)[0] : null);
  const discLabels: Record<string, string> = {
    Dominância: 'Dominância (D)',
    Influência: 'Influência (I)',
    Estabilidade: 'Estabilidade (S)',
    Conformidade: 'Conformidade (C)',
    dominance: 'Dominância (D)',
    influence: 'Influência (I)',
    steadiness: 'Estabilidade (S)',
    compliance: 'Conformidade (C)'
  };
  const discDisplay = discDominante ? (discLabels[discDominante] || discDominante) : 'Não calculado';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-4 md:p-6 hover:border-zinc-700 transition-all group shadow-sm hover:shadow-xl hover:shadow-white/5 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
      {/* Avatar e Identidade Básica */}
      <div className="flex items-center gap-4 min-w-[240px]">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-700 transition-colors shrink-0 shadow-inner overflow-hidden border border-zinc-700/50">
          {persona.photo_path ? (
            <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <User size={32} />
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1 group-hover:text-white transition-colors">{persona.name}</h3>
          <div className="flex items-center text-zinc-500 text-sm font-medium">
            <MapPin size={14} className="mr-1.5 shrink-0" />
            <span className="truncate">{persona.age} anos • {persona.city}, {persona.state}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
              {archetype}
            </span>
            {clusterLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {persona.cluster_id && <span className="opacity-60">{persona.cluster_id}</span>}
                {clusterLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Informações Dinâmicas */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-8 w-full py-2 border-y lg:border-y-0 lg:border-x border-zinc-800/50 px-0 lg:px-8">
        <div className="flex items-start gap-3">
          <Briefcase size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Cargo</p>
            <p className="text-sm text-zinc-300 font-medium line-clamp-1">{occupation}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Sparkles size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Religião</p>
            <p className="text-sm text-zinc-300 font-medium line-clamp-1">{religion}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Shield size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Política</p>
              <p className="text-sm text-zinc-300 font-medium line-clamp-1">{politics}</p>
            </div>
            {hasScores && (
              <IdeologyDot scoreEco={persona.score_economico!} scoreCost={persona.score_costumes!} />
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Target size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">DISC Dominante</p>
            <p className="text-sm text-zinc-300 font-medium">{discDisplay}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Users size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Estado Civil</p>
            <p className="text-sm text-zinc-300 font-medium line-clamp-1">{maritalStatus}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <TrendingUp size={16} className="text-zinc-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Renda Mensal</p>
            <p className="text-sm text-zinc-300 font-medium line-clamp-1">
              {income ? `R$ ${income.toLocaleString('pt-BR')}` : 'Não informada'}
            </p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex lg:flex-col gap-3 w-full lg:w-40 shrink-0">
        <Link 
          href={`/chat/${persona.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5 text-sm"
        >
          <MessageSquare size={18} />
          Chat
        </Link>
        <Link 
          href={`/persona/${persona.id}`}
          className="px-6 lg:px-4 flex items-center justify-center bg-zinc-800 text-white py-3 rounded-2xl hover:bg-zinc-700 transition-all active:scale-95 border border-zinc-700 text-sm font-bold"
        >
          Perfil
        </Link>
      </div>
    </div>
  );
}


