import Link from 'next/link';
import { MapPin, MessageSquare, User } from 'lucide-react';

interface PersonaCardProps {
  persona: {
    id: string;
    name: string;
    age: number;
    city: string;
    state: string;
    psychology_json: any;
  };
}

export function PersonaCard({ persona }: PersonaCardProps) {
  const archetype = persona.psychology_json?.archetypes?.primary || persona.psychology_json?.archetype || 'Neutro';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
          <User size={24} />
        </div>
        <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
          {archetype}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-1">{persona.name}</h3>
      <div className="flex items-center text-zinc-400 text-sm mb-4">
        <MapPin size={14} className="mr-1" />
        {persona.age} anos • {persona.city}, {persona.state}
      </div>

      <div className="flex gap-2">
        <Link 
          href={`/chat/${persona.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-2 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
        >
          <MessageSquare size={16} />
          Chat
        </Link>
        <Link 
          href={`/persona/${persona.id}`}
          className="px-3 flex items-center justify-center bg-zinc-800 text-white py-2 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Perfil
        </Link>
      </div>
    </div>
  );
}
