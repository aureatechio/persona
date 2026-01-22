'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Send, 
  ArrowLeft, 
  Info, 
  RotateCcw, 
  User, 
  ChevronRight,
  BrainCircuit,
  MapPin,
  Briefcase,
  Heart,
  Target
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: Date;
}

export default function ChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const [persona, setPersona] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersona();
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://webhook.aureatech.io/webhook/persona-aurea-conversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: id,
          message: messageToSend
        })
      });

      if (!response.ok) throw new Error('Falha na comunicação com a IA');

      const data = await response.json();

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || data.output || data.message || 'Desculpe, tive um problema ao processar sua mensagem.',
        thought: data.thought,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Erro de conexão com o servidor de IA. Verifique o webhook do n8n.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
  };

  if (!persona) return null;

  // Extrair dados da estrutura JSON
  const archetype = persona.psychology_json?.archetypes?.primary || 'Neutro';
  const biography = persona.history_json?.biografia_base?.resumo_narrativo || 'Nenhuma história disponível.';
  const dreams = persona.history_json?.aspiracoes?.sonhos_de_vida || '';
  const shortTermGoals = persona.history_json?.aspiracoes?.objetivos_curto_prazo || '';
  const occupation = persona.career_json?.atuação_e_cargo?.cargo_atual || persona.demographic_json?.socioeconomico?.ocupacao_principal || '';
  const sector = persona.career_json?.atuação_e_cargo?.área_principal || persona.demographic_json?.socioeconomico?.setor_economico || '';
  const coreValues = persona.psychology_json?.core_values || [];

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar de Contexto */}
      <aside 
        className={`bg-zinc-950 border-r border-zinc-800 transition-all duration-300 flex flex-col ${showSidebar ? 'w-96' : 'w-0 opacity-0 pointer-events-none'}`}
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="font-bold text-xl">Perfil</h2>
          <button onClick={() => setShowSidebar(false)} className="text-zinc-500 hover:text-white">
            <ChevronRight className="rotate-180" size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar e Info Básica */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 mx-auto mb-3 flex items-center justify-center text-zinc-500">
              <User size={40} />
            </div>
            <h3 className="text-lg font-bold">{persona.name}</h3>
            <p className="text-zinc-500 text-sm flex items-center justify-center gap-1">
              <MapPin size={12} />
              {persona.age} anos • {persona.city}, {persona.state}
            </p>
            <span className="inline-block mt-2 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-medium text-zinc-300">
              {archetype}
            </span>
          </div>

          {/* Ocupação */}
          {occupation && (
            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Briefcase size={14} />
                <span className="text-xs uppercase tracking-wider font-medium">Ocupação</span>
              </div>
              <p className="text-zinc-200 text-sm font-medium">{occupation}</p>
              {sector && <p className="text-zinc-500 text-xs mt-1">{sector}</p>}
            </div>
          )}

          {/* História */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Heart size={12} />
              História
            </h4>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {biography}
            </p>
          </div>

          {/* Valores Centrais */}
          {coreValues.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Valores</h4>
              <div className="flex flex-wrap gap-2">
                {coreValues.slice(0, 5).map((v: any, i: number) => (
                  <span 
                    key={i} 
                    className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
                  >
                    {v.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sonhos e Objetivos */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Target size={12} />
              Sonhos e Objetivos
            </h4>
            <div className="space-y-3">
              {dreams && (
                <div className="bg-zinc-900/30 rounded-lg p-3 border-l-2 border-amber-500/50">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Sonho de Vida</p>
                  <p className="text-zinc-300 text-sm">{dreams}</p>
                </div>
              )}
              {shortTermGoals && (
                <div className="bg-zinc-900/30 rounded-lg p-3 border-l-2 border-emerald-500/50">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Curto Prazo</p>
                  <p className="text-zinc-300 text-sm">{shortTermGoals}</p>
                </div>
              )}
            </div>
          </div>

          {/* Traumas (se existirem) */}
          {persona.history_json?.traumas_e_feridas?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Gatilhos Emocionais</h4>
              <div className="space-y-2">
                {persona.history_json.traumas_e_feridas.slice(0, 2).map((trauma: any, i: number) => (
                  <div key={i} className="bg-red-950/20 rounded-lg p-3 border border-red-900/30">
                    <p className="text-zinc-300 text-sm">{trauma.descricao}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {trauma.gatilhos?.map((g: string, j: number) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            {!showSidebar && (
              <button onClick={() => setShowSidebar(true)} className="text-zinc-500 hover:text-white">
                <Info size={20} />
              </button>
            )}
            <div>
              <h1 className="font-bold">{persona.name}</h1>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Online</span>
              </div>
            </div>
          </div>

          <button 
            onClick={resetChat}
            className="text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors"
          >
            <RotateCcw size={16} />
            Reiniciar
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                <MessageSquare size={32} />
              </div>
              <div>
                <p className="text-zinc-400">Inicie uma conversa com {persona.name}</p>
                <p className="text-zinc-600 text-sm">Respostas baseadas no perfil psicológico completo.</p>
              </div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-white text-black rounded-tr-none' 
                    : 'bg-zinc-900 text-white rounded-tl-none border border-zinc-800'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              
              {msg.thought && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-900">
                  <BrainCircuit size={12} />
                  <span>{msg.thought}</span>
                </div>
              )}
              
              <span className="text-[10px] text-zinc-600 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-zinc-800 bg-black">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-4">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Mensagem para ${persona.name}...`}
              disabled={loading}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full py-3 px-6 pr-14 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:bg-zinc-800"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
          <p className="text-[10px] text-zinc-600 text-center mt-4 uppercase tracking-widest font-bold">
            Persona AI • Respostas baseadas em dados sintéticos
          </p>
        </div>
      </main>
    </div>
  );
}

function MessageSquare({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
