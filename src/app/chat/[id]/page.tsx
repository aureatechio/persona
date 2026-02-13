'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import {
  Send,
  ArrowLeft,
  Info,
  Plus,
  User,
  ChevronRight,
  ChevronDown,
  BrainCircuit,
  MapPin,
  Briefcase,
  Heart,
  Target,
  Menu,
  Brain,
  Shield,
  Sparkles,
  Activity,
  BookOpen,
  Users,
  Star,
  TrendingUp,
  Clock,
  Tv,
  Dumbbell,
  AlertTriangle,
  Compass,
  ExternalLink,
  Zap
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: Date;
}

interface ChatSummary {
  id: string;
  createdAt: string;
  messageCount: number;
  lastMessageAt: string | null;
}

export default function ChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const personaId = Array.isArray(id) ? id[0] : id;
  const [persona, setPersona] = useState<any>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingResponses, setPendingResponses] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());


  useEffect(() => {
    fetchPersona();
  }, [personaId]);

  useEffect(() => {
    if (user?.id && personaId) {
      fetchChats();
    }
  }, [user?.id, personaId]);

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchPersona() {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .single();

    if (error || !data) {
      router.push('/');
      return;
    }
    setPersona(data);
  }

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Sem mensagens';
    const date = new Date(value);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fetchChats = async () => {
    if (!user?.id || !personaId) return;

    const { data: chatData, error } = await supabase
      .from('chats')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar chats:', error);
      setChats([]);
      setActiveChatId(null);
      return;
    }

    const chatList = (chatData || []).map((chat: any) => ({
      id: chat.id,
      createdAt: chat.created_at,
      messageCount: 0,
      lastMessageAt: null,
    }));

    if (chatList.length === 0) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    const chatIds = chatList.map((chat) => chat.id);
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('chat_id, created_at')
      .in('chat_id', chatIds);

    if (messageError) {
      console.error('Erro ao buscar mensagens do histórico:', messageError);
      setChats(chatList);
      setActiveChatId(chatList[0]?.id ?? null);
      return;
    }

    const summaryByChat = messageData?.reduce<Record<string, { count: number; lastAt: string | null }>>((acc, message: any) => {
      const chatId = message.chat_id;
      const createdAt = message.created_at as string;
      if (!acc[chatId]) {
        acc[chatId] = { count: 0, lastAt: createdAt };
      }
      acc[chatId].count += 1;
      if (!acc[chatId].lastAt || new Date(createdAt) > new Date(acc[chatId].lastAt as string)) {
        acc[chatId].lastAt = createdAt;
      }
      return acc;
    }, {});

    const enrichedChats = chatList.map((chat) => {
      const summary = summaryByChat?.[chat.id];
      return {
        ...chat,
        messageCount: summary?.count ?? 0,
        lastMessageAt: summary?.lastAt ?? null,
      };
    });

    setChats(enrichedChats);
    setActiveChatId((current) => {
      if (current && enrichedChats.some((chat) => chat.id === current)) {
        return current;
      }
      return enrichedChats[0]?.id ?? null;
    });
  };

  const fetchMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, message, created_at, bot_message')
      .eq('chat_id', chatId)
      .order('created_at');

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      setMessages([]);
      return;
    }

    const mappedMessages: Message[] = (data || []).map((msg: any) => ({
      id: msg.id,
      role: msg.bot_message ? 'assistant' : 'user',
      content: msg.message ?? '',
      timestamp: new Date(msg.created_at),
    }));

    setMessages(mappedMessages);
  };

  const ensureChat = async () => {
    if (!user?.id || !personaId) return null;
    if (activeChatId) return activeChatId;

    const { data, error } = await supabase
      .from('chats')
      .insert({ user_id: user.id, persona_id: personaId })
      .select('id, created_at')
      .single();

    if (error || !data) {
      console.error('Erro ao criar chat:', error);
      return null;
    }

    const newChat: ChatSummary = {
      id: data.id,
      createdAt: data.created_at,
      messageCount: 0,
      lastMessageAt: null,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(data.id);
    return data.id;
  };

  const handleCreateChat = async () => {
    await ensureChat();
  };

  const updateChatSummary = (chatId: string, lastMessageAt: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messageCount: chat.messageCount + 1,
          lastMessageAt,
        };
      })
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const processSend = useCallback(async (chatId: string, messageToSend: string) => {
    try {
      const { data: savedUserMessage, error: saveUserError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          user_id: user!.id,
          persona_id: personaId,
          message: messageToSend,
          bot_message: false,
        })
        .select('id, created_at')
        .single();

      if (saveUserError) {
        console.error('Erro ao salvar mensagem do usuário:', saveUserError);
      } else if (savedUserMessage?.created_at) {
        updateChatSummary(chatId, savedUserMessage.created_at);
      }

      const response = await fetch(process.env.NEXT_PUBLIC_PERSONA_CHAT_API || 'https://webhook.aureatech.io/webhook/persona-aurea-conversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: user!.id,
          persona_id: personaId,
          message: messageToSend,
        })
      });

      if (!response.ok) throw new Error('Falha na comunicação com a IA');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + Math.random()).toString(),
        role: 'assistant',
        content: data.response || data.output || data.message || 'Desculpe, tive um problema ao processar sua mensagem.',
        thought: data.thought,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const { data: savedBotMessage, error: saveBotError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          user_id: user!.id,
          persona_id: personaId,
          message: assistantMessage.content,
          bot_message: true,
        })
        .select('id, created_at')
        .single();

      if (saveBotError) {
        console.error('Erro ao salvar mensagem do bot:', saveBotError);
      } else if (savedBotMessage?.created_at) {
        updateChatSummary(chatId, savedBotMessage.created_at);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        id: (Date.now() + Math.random()).toString(),
        role: 'assistant',
        content: 'Erro de conexão com o servidor de IA.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setPendingResponses(prev => Math.max(0, prev - 1));
    }
  }, [user, personaId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!user?.id) return;

    const chatId = await ensureChat();
    if (!chatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setPendingResponses(prev => prev + 1);

    // Foco no input
    setTimeout(() => inputRef.current?.focus(), 0);

    // Serializa envios: cada mensagem espera a anterior terminar
    // assim o backend sempre tem o historico completo no Supabase
    sendQueueRef.current = sendQueueRef.current.then(
      () => processSend(chatId, messageToSend)
    );
  };

  if (!persona) return null;

  // Extrair dados da estrutura JSON
  const archetype = persona.archetype_primary || persona.psychology_json?.archetypes?.primary || 'Neutro';
  const biography = persona.history_json?.biografia_base?.resumo_narrativo || 'Nenhuma história disponível.';
  const dreams = persona.history_json?.aspiracoes?.sonhos_de_vida || '';
  const shortTermGoals = persona.history_json?.aspiracoes?.objetivos_curto_prazo || '';
  const occupation = persona.career_json?.atuação_e_cargo?.cargo_atual || persona.demographic_json?.socioeconomico?.ocupacao_principal || '';
  const sector = persona.career_json?.atuação_e_cargo?.área_principal || persona.demographic_json?.socioeconomico?.setor_economico || '';
  const coreValues = persona.psychology_json?.core_values || [];

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex overflow-hidden relative lg:pl-64">
        {/* Histórico de Chats */}
        <aside className="hidden lg:flex w-72 shrink-0 bg-zinc-950 border-r border-zinc-900 flex-col">
          <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
            <h2 className="font-bold text-lg">Histórico</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chats.length === 0 && (
              <div className="text-xs text-zinc-500 text-center py-6">
                Nenhum chat encontrado para esta persona.
              </div>
            )}
            {chats.map((chat, index) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  chat.id === activeChatId
                    ? 'bg-white text-black border-white shadow-lg shadow-white/5'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Chat {index + 1}</span>
                  <span className={`text-[10px] uppercase tracking-widest ${chat.id === activeChatId ? 'text-black/60' : 'text-zinc-500'}`}>
                    {chat.messageCount} msgs
                  </span>
                </div>
                <div className={`text-[10px] ${chat.id === activeChatId ? 'text-black/60' : 'text-zinc-500'}`}>
                  Última mensagem: {formatDateTime(chat.lastMessageAt ?? chat.createdAt)}
                </div>
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-zinc-900">
            <button
              onClick={handleCreateChat}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors py-3 rounded-2xl border border-zinc-800 hover:border-zinc-600"
            >
              <Plus size={16} />
              Novo chat
            </button>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative">
          {/* Header */}
          <header className="h-20 border-b border-zinc-900 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <Menu size={24} />
              </button>
              <Link href="/" className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-zinc-900 rounded-xl">
                <ArrowLeft size={20} />
              </Link>

              {!showSidebar && (
                <button onClick={() => setShowSidebar(true)} className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-900 rounded-xl">
                  <Info size={20} />
                </button>
              )}
              <div>
                <h1 className="font-bold text-lg">{persona.name}</h1>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Online</span>
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {!activeChatId ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-zinc-500">
                <p className="text-sm font-medium">Selecione um chat ou crie um novo.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center text-zinc-700 border border-zinc-800">
                  <MessageSquare size={40} />
                </div>
                <div className="max-w-xs">
                  <p className="text-zinc-400 font-medium">Inicie uma conversa com {persona.name}</p>
                  <p className="text-zinc-600 text-xs mt-2 leading-relaxed">Respostas baseadas no perfil psicológico completo, crenças e história de vida.</p>
                </div>
              </div>
            ) : null}
            
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[75%] p-5 rounded-3xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-white text-black rounded-tr-none font-medium' 
                      : 'bg-zinc-900 text-white rounded-tl-none border border-zinc-800'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {msg.thought && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-sm">
                    <BrainCircuit size={12} className="text-zinc-400" />
                    <span className="font-medium">{msg.thought}</span>
                  </div>
                )}
                
                <span className="text-[10px] text-zinc-600 mt-2 px-2 font-bold tracking-tighter">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-zinc-900 bg-black">
            {/* Typing indicator */}
            {pendingResponses > 0 && (
              <div className="px-8 pt-4 pb-0 max-w-5xl mx-auto">
                <div className="flex items-center gap-3 text-zinc-400">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs font-medium">{persona.name} está digitando</span>
                </div>
              </div>
            )}
            <div className="p-8 pt-4">
              <form onSubmit={handleSendMessage} className="relative flex items-center gap-4 max-w-5xl mx-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeChatId ? `Mensagem para ${persona.name}...` : 'Selecione um chat para conversar'}
                  disabled={!activeChatId}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-8 pr-16 focus:outline-none focus:border-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || !activeChatId}
                  className="absolute right-2.5 w-11 h-11 bg-white text-black rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:bg-zinc-800 shadow-xl active:scale-95"
                >
                  <Send size={20} />
                </button>
              </form>
              <p className="text-[10px] text-zinc-700 text-center mt-6 uppercase tracking-[0.2em] font-black">
                Persona AI • Respostas baseadas em dados sintéticos
              </p>
            </div>
          </div>
        </main>

        {/* Sidebar de Contexto */}
        <ProfileSidebar
          persona={persona}
          showSidebar={showSidebar}
          onClose={() => setShowSidebar(false)}
          archetype={archetype}
          occupation={occupation}
          sector={sector}
          biography={biography}
          dreams={dreams}
          shortTermGoals={shortTermGoals}
          coreValues={coreValues}
        />
      </div>
    </div>
  );
}




/* ─── Collapsible Section ─── */
function ProfileSection({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
  accentColor = 'zinc',
}: {
  icon: any;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    sky: 'text-sky-400 bg-sky-500/10',
    red: 'text-red-400 bg-red-500/10',
    pink: 'text-pink-400 bg-pink-500/10',
    zinc: 'text-zinc-400 bg-zinc-800/50',
  };
  const iconClass = colorMap[accentColor] || colorMap.zinc;

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors duration-200"
      >
        <div className={`p-1.5 rounded-lg ${iconClass}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex-1 text-left">{label}</span>
        <ChevronDown
          size={14}
          className={`text-zinc-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Mini Progress Bar ─── */
function MiniBar({ value, max = 10, color = 'emerald' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    red: 'bg-red-500',
    pink: 'bg-pink-500',
  };
  return (
    <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden flex-1 min-w-[60px]">
      <div
        className={`h-full rounded-full ${colorMap[color] || colorMap.emerald} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Skill Row ─── */
function SkillRow({ label, level, color = 'emerald' }: { label: string; level: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-28 truncate shrink-0">{label}</span>
      <MiniBar value={level} color={color} />
      <span className="text-[10px] text-zinc-500 font-mono w-5 text-right">{level}</span>
    </div>
  );
}

/* ─── Profile Sidebar ─── */
function ProfileSidebar({
  persona,
  showSidebar,
  onClose,
  archetype,
  occupation,
  sector,
  biography,
  dreams,
  shortTermGoals,
  coreValues,
}: {
  persona: any;
  showSidebar: boolean;
  onClose: () => void;
  archetype: string;
  occupation: string;
  sector: string;
  biography: string;
  dreams: string;
  shortTermGoals: string;
  coreValues: any[];
}) {
  // Extrair dados completos
  const psychology = persona.psychology_json || {};
  const beliefs = persona.beliefs_json || {};
  const career = persona.career_json || {};
  const lifestyle = persona.lifestyle_json || {};
  const health = persona.health_json || {};
  const history = persona.history_json || {};
  const demographic = persona.demographic_json || {};

  // Demographics
  const gender = persona.gender_identity || persona.gender || demographic?.genero;
  const civilStatus = persona.civil_status || demographic?.estado_civil;
  const generation = persona.generation || demographic?.geracao;
  const education = persona.education_level || demographic?.educacao?.nivel_instrucao;
  const socialClass = persona.social_class || demographic?.socioeconomico?.classe_social;
  const income = demographic?.socioeconomico?.renda_mensal;
  const religion = persona.macro_religion || beliefs?.religião?.fé_ou_doutrina;
  const politicalLeaning = persona.political_leaning || beliefs?.orientação_política?.espectro;

  // Psychology
  const bigFive = psychology.big_five_ocean || {};
  const disc = psychology.disc_profile || {};
  const enneagram = psychology.enneagram || {};
  const archetypes = psychology.archetypes || {};
  const outlook = psychology.outlook || {};
  const astrology = psychology.astrology || {};

  // Career
  const hardSkills = career.hard_skills || [];
  const softSkills = career.soft_skills || [];
  const careerContext = career.contexto_profissional || {};
  const communication = career.comunicação_e_linguagem || {};
  const experienceYears = career.atuação_e_cargo?.tempo_experiência_anos;

  // Lifestyle
  const chronotype = lifestyle.ritmo_e_cronotipo || {};
  const media = lifestyle.consumo_de_mídias || {};
  const habits = lifestyle.hábitos_positivos || [];
  const addictions = lifestyle.vícios_e_dependências || [];
  const interpersonal = lifestyle.relações_interpessoais || {};
  const intrapersonal = lifestyle.relações_intrapessoais_e_materiais || {};

  // Health
  const activities = health.atividades_fisicas || [];
  const leisure = health.atividades_de_lazer || [];
  const conditions = health.condições_e_doenças || {};
  const lifeSatisfaction = health.satisfação_com_a_vida || {};
  const mentalHealth = health.saude_mental_e_estresse || {};

  // History
  const family = history.nucleo_familiar || {};
  const aspirations = history.aspiracoes || {};
  const traumas = history.traumas_e_feridas || [];
  const recentEvents = history.eventos_recentes || [];

  // Beliefs
  const religiousDetail = beliefs.religião || {};
  const politicalDetail = beliefs.orientação_política || {};
  const biases = beliefs.vieses_cognitivos || [];
  const objections = beliefs.objeções_padrões || [];
  const aversions = beliefs.aversões || [];

  // Cluster
  const clusterName = persona.nome_grupo;

  return (
    <aside
      className={`hidden lg:flex bg-zinc-950/90 backdrop-blur-2xl border-l border-white/[0.06] transition-all duration-300 flex-col shrink-0 ${showSidebar ? 'w-[420px]' : 'w-0 opacity-0 pointer-events-none'}`}
    >
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06] flex justify-between items-center">
        <h2 className="font-bold text-lg tracking-tight">Perfil</h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/persona/${persona.id}`}
            className="text-zinc-500 hover:text-white p-2 hover:bg-white/[0.06] rounded-xl transition-colors duration-200"
            title="Ver perfil completo"
          >
            <ExternalLink size={16} />
          </Link>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-2 hover:bg-white/[0.06] rounded-xl transition-colors duration-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* ─── Avatar & Identity ─── */}
        <div className="text-center pb-2">
          <div className="w-24 h-24 rounded-3xl bg-white/[0.04] border border-white/[0.08] mx-auto mb-4 flex items-center justify-center text-zinc-500 shadow-xl shadow-black/30 overflow-hidden">
            {persona.photo_path ? (
              <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
            ) : (
              <User size={48} />
            )}
          </div>
          <h3 className="text-xl font-bold tracking-tight">{persona.name}</h3>
          {persona.apelido_politico && (
            <p className="text-zinc-500 text-xs mt-0.5">&ldquo;{persona.apelido_politico}&rdquo;</p>
          )}
          <p className="text-zinc-500 text-sm flex items-center justify-center gap-1.5 mt-1.5">
            <MapPin size={12} />
            {persona.age} anos • {persona.city}, {persona.state}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <span className="px-3 py-1 bg-white/[0.05] border border-white/[0.08] rounded-full text-xs font-semibold text-zinc-300">
              {archetype}
            </span>
            {clusterName && (
              <span className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-medium text-violet-400">
                {clusterName}
              </span>
            )}
          </div>
        </div>

        {/* ─── Quick Facts Grid ─── */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Gênero', value: gender },
            { label: 'Estado Civil', value: civilStatus },
            { label: 'Geração', value: generation },
            { label: 'Educação', value: education },
            { label: 'Classe Social', value: socialClass },
            { label: 'Religião', value: religion },
            { label: 'Posição Política', value: politicalLeaning },
            { label: 'Renda', value: income ? `R$ ${Number(income).toLocaleString('pt-BR')}` : undefined },
          ]
            .filter((item) => item.value)
            .map((item, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3"
              >
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block">{item.label}</span>
                <span className="text-xs text-zinc-300 font-medium mt-0.5 block truncate">{item.value}</span>
              </div>
            ))}
        </div>

        {/* ─── Occupation ─── */}
        {occupation && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <Briefcase size={14} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Ocupação</span>
            </div>
            <p className="text-zinc-200 text-sm font-semibold">{occupation}</p>
            {sector && <p className="text-zinc-500 text-xs mt-0.5">{sector}</p>}
            {experienceYears && (
              <p className="text-zinc-600 text-xs mt-1">{experienceYears} anos de experiência</p>
            )}
          </div>
        )}

        {/* ─── Biography ─── */}
        <ProfileSection icon={BookOpen} label="História" defaultOpen={true} accentColor="amber">
          <p className="text-zinc-400 text-sm leading-relaxed">{biography}</p>
          {history.biografia_base?.contexto_de_origem && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Origem</span>
              <p className="text-zinc-400 text-xs leading-relaxed">{history.biografia_base.contexto_de_origem}</p>
            </div>
          )}
          {family.dinamica_relacional && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Família</span>
              {family.pais && <p className="text-zinc-400 text-xs">{family.pais}</p>}
              {family.parceiro_a && <p className="text-zinc-400 text-xs">{family.parceiro_a}</p>}
              <p className="text-zinc-500 text-xs mt-1">{family.dinamica_relacional}</p>
            </div>
          )}
        </ProfileSection>

        {/* ─── Psychology ─── */}
        <ProfileSection icon={Brain} label="Psicologia" accentColor="violet">
          {/* Big Five */}
          {bigFive.openness !== undefined && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Big Five (OCEAN)</span>
              <SkillRow label="Abertura" level={bigFive.openness} color="violet" />
              <SkillRow label="Consciência" level={bigFive.conscientiousness} color="violet" />
              <SkillRow label="Extroversão" level={bigFive.extraversion} color="violet" />
              <SkillRow label="Amabilidade" level={bigFive.agreeableness} color="violet" />
              <SkillRow label="Neuroticismo" level={bigFive.neuroticism} color="violet" />
            </div>
          )}
          {/* DISC */}
          {disc.dominance !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Perfil DISC</span>
              <SkillRow label="Dominância" level={disc.dominance} color="amber" />
              <SkillRow label="Influência" level={disc.influence} color="amber" />
              <SkillRow label="Estabilidade" level={disc.steadiness} color="amber" />
              <SkillRow label="Conformidade" level={disc.compliance} color="amber" />
            </div>
          )}
          {/* Enneagram */}
          {enneagram.core_type && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block">Eneagrama</span>
                <span className="text-sm text-zinc-300 font-medium">Tipo {enneagram.core_type}w{enneagram.wing}</span>
              </div>
              {enneagram.integration_level && (
                <span className="text-xs text-zinc-500">Integração: {enneagram.integration_level}/10</span>
              )}
            </div>
          )}
          {/* Archetypes */}
          {archetypes.secondary && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Arquétipos</span>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs text-violet-400 font-medium">{archetypes.primary}</span>
                <span className="px-2.5 py-1 bg-zinc-800/50 border border-white/[0.06] rounded-full text-xs text-zinc-400">{archetypes.secondary}</span>
              </div>
            </div>
          )}
          {/* Outlook */}
          {outlook.optimism_level !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Perspectiva de Vida</span>
              <SkillRow label="Otimismo" level={outlook.optimism_level} color="emerald" />
              <SkillRow label="Resiliência" level={outlook.resilience_score} color="emerald" />
            </div>
          )}
          {/* Astrology */}
          {astrology.sun_sign && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Astrologia</span>
              <div className="flex gap-3 text-xs">
                <span className="text-zinc-400"><span className="text-zinc-600">Sol:</span> {astrology.sun_sign}</span>
                <span className="text-zinc-400"><span className="text-zinc-600">Lua:</span> {astrology.moon_sign}</span>
                <span className="text-zinc-400"><span className="text-zinc-600">Asc:</span> {astrology.rising_sign}</span>
              </div>
            </div>
          )}
        </ProfileSection>

        {/* ─── Values ─── */}
        {coreValues.length > 0 && (
          <ProfileSection icon={Star} label="Valores Centrais" defaultOpen={true} accentColor="emerald">
            <div className="flex flex-wrap gap-2">
              {coreValues.map((v: any, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium"
                >
                  {v.value}
                  {v.priority && <span className="text-emerald-600 text-[10px]">#{v.priority}</span>}
                </span>
              ))}
            </div>
          </ProfileSection>
        )}

        {/* ─── Beliefs ─── */}
        <ProfileSection icon={Shield} label="Crenças & Política" accentColor="sky">
          {/* Religion */}
          {religiousDetail.fé_ou_doutrina && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block">Religião</span>
              <p className="text-sm text-zinc-300">{religiousDetail.fé_ou_doutrina}</p>
              {religiousDetail.frequência_prática !== undefined && (
                <SkillRow label="Prática" level={religiousDetail.frequência_prática} color="sky" />
              )}
              {religiousDetail.influência_dogmática !== undefined && (
                <SkillRow label="Dogma" level={religiousDetail.influência_dogmática} color="sky" />
              )}
            </div>
          )}
          {/* Political */}
          {politicalDetail.espectro && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block">Política</span>
              <p className="text-sm text-zinc-300">{politicalDetail.espectro}</p>
              {politicalDetail.valor_prioritário && (
                <p className="text-xs text-zinc-500">Prioridade: {politicalDetail.valor_prioritário}</p>
              )}
              {politicalDetail.nível_de_polarização !== undefined && (
                <SkillRow label="Polarização" level={politicalDetail.nível_de_polarização} color="red" />
              )}
              {/* Ideological scores */}
              {(persona.score_economico !== null || persona.score_costumes !== null) && (
                <div className="flex gap-3 pt-1">
                  {persona.score_economico !== null && (
                    <span className="text-[10px] text-zinc-500">
                      Econ: <span className="text-zinc-400 font-mono">{Number(persona.score_economico).toFixed(2)}</span>
                    </span>
                  )}
                  {persona.score_costumes !== null && (
                    <span className="text-[10px] text-zinc-500">
                      Cost: <span className="text-zinc-400 font-mono">{Number(persona.score_costumes).toFixed(2)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Cognitive Biases */}
          {biases.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Vieses Cognitivos</span>
              {biases.map((b: any, i: number) => (
                <SkillRow key={i} label={b.nome} level={b.nível} color="amber" />
              ))}
            </div>
          )}
          {/* Aversions */}
          {aversions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold w-full">Aversões</span>
              {aversions.map((a: any, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400">
                  {a.alvo} ({a.nível}/10)
                </span>
              ))}
            </div>
          )}
        </ProfileSection>

        {/* ─── Career & Skills ─── */}
        <ProfileSection icon={Briefcase} label="Carreira & Skills" accentColor="emerald">
          {/* Hard Skills */}
          {hardSkills.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Hard Skills</span>
              {hardSkills.map((s: any, i: number) => (
                <SkillRow key={i} label={s.competência} level={s.nível} color="emerald" />
              ))}
            </div>
          )}
          {/* Soft Skills */}
          {softSkills.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Soft Skills</span>
              {softSkills.map((s: any, i: number) => (
                <SkillRow key={i} label={s.competência} level={s.nível} color="sky" />
              ))}
            </div>
          )}
          {/* Career Context */}
          {careerContext.satisfação_carreira !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Contexto Profissional</span>
              <SkillRow label="Satisfação" level={careerContext.satisfação_carreira} color="emerald" />
              <SkillRow label="Ambição" level={careerContext.ambição_profissional} color="amber" />
              <SkillRow label="Work-Life Balance" level={careerContext.equilíbrio_vida_trabalho} color="sky" />
            </div>
          )}
          {/* Communication */}
          {communication.eloquência !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Comunicação</span>
              <SkillRow label="Eloquência" level={communication.eloquência} color="violet" />
              <SkillRow label="Assertividade" level={communication.assertividade} color="violet" />
              <SkillRow label="Formalidade" level={communication.nível_formalidade} color="violet" />
            </div>
          )}
        </ProfileSection>

        {/* ─── Lifestyle ─── */}
        <ProfileSection icon={Activity} label="Estilo de Vida" accentColor="pink">
          {/* Chronotype */}
          {chronotype.tipo && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Cronotipo</span>
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-zinc-500" />
                <span className="text-sm text-zinc-300">{chronotype.tipo}</span>
                {chronotype.pico_de_energia && (
                  <span className="text-xs text-zinc-500">Pico: {chronotype.pico_de_energia}</span>
                )}
              </div>
            </div>
          )}
          {/* Social media */}
          {media.redes_sociais_predominantes?.length > 0 && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-2">Redes Sociais</span>
              <div className="flex flex-wrap gap-1.5">
                {media.redes_sociais_predominantes.map((r: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-xs text-pink-400">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Habits */}
          {habits.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Hábitos Positivos</span>
              {habits.map((h: any, i: number) => (
                <SkillRow key={i} label={h.hábito} level={h.frequência_nível} color="emerald" />
              ))}
            </div>
          )}
          {/* Addictions */}
          {addictions.length > 0 && addictions.some((a: any) => a.intensidade > 0) && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Vícios</span>
              {addictions.filter((a: any) => a.intensidade > 0).map((a: any, i: number) => (
                <SkillRow key={i} label={a.tipo} level={a.intensidade} color="red" />
              ))}
            </div>
          )}
          {/* Interpersonal */}
          {interpersonal.sociabilidade !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Relações</span>
              <SkillRow label="Sociabilidade" level={interpersonal.sociabilidade} color="pink" />
              <SkillRow label="Vínculo Familiar" level={interpersonal.vínculo_familiar} color="pink" />
              <SkillRow label="Confiança" level={interpersonal.confiança_nas_pessoas} color="pink" />
            </div>
          )}
          {/* Intrapersonal */}
          {intrapersonal.autoestima !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Autoconhecimento</span>
              <SkillRow label="Autoestima" level={intrapersonal.autoestima} color="violet" />
              <SkillRow label="Autodesenvolvimento" level={intrapersonal.foco_em_autodesenvolvimento} color="violet" />
              <SkillRow label="Materialismo" level={intrapersonal.materialismo_e_consumo} color="amber" />
            </div>
          )}
        </ProfileSection>

        {/* ─── Health ─── */}
        <ProfileSection icon={Heart} label="Saúde" accentColor="red">
          {/* Physical Activities */}
          {activities.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Atividades Físicas</span>
              {activities.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{a.tipo}</span>
                  <span className="text-zinc-600">{a.objetivo}</span>
                </div>
              ))}
            </div>
          )}
          {/* Leisure */}
          {leisure.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Lazer</span>
              {leisure.map((l: any, i: number) => (
                <SkillRow key={i} label={l.atividade} level={l.interesse_nível} color="pink" />
              ))}
            </div>
          )}
          {/* Life Satisfaction */}
          {lifeSatisfaction.índice_geral !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Satisfação com a Vida</span>
              <SkillRow label="Índice Geral" level={lifeSatisfaction.índice_geral} color="emerald" />
              <SkillRow label="Equilíbrio Emocional" level={lifeSatisfaction.equilíbrio_emocional} color="emerald" />
              <SkillRow label="Percepção de Sucesso" level={lifeSatisfaction.percepção_de_sucesso} color="emerald" />
            </div>
          )}
          {/* Mental Health */}
          {mentalHealth.nível_estresse_crônico !== undefined && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Saúde Mental</span>
              <SkillRow label="Estresse Crônico" level={mentalHealth.nível_estresse_crônico} color="red" />
              <SkillRow label="Resiliência" level={mentalHealth.resiliência_psicológica} color="emerald" />
              <SkillRow label="Terapia/Meditação" level={mentalHealth.frequência_terapia_ou_meditação} color="sky" />
            </div>
          )}
          {/* Chronic Conditions */}
          {conditions.doenças_crônicas?.length > 0 && (
            <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-1">Condições Crônicas</span>
              <div className="flex flex-wrap gap-1.5">
                {conditions.doenças_crônicas.map((d: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ProfileSection>

        {/* ─── Dreams & Goals ─── */}
        <ProfileSection icon={Target} label="Sonhos & Objetivos" defaultOpen={true} accentColor="amber">
          {dreams && (
            <div className="bg-white/[0.03] rounded-xl p-3 border-l-2 border-amber-500/50">
              <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-1">Sonho de Vida</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{dreams}</p>
            </div>
          )}
          {shortTermGoals && (
            <div className="bg-white/[0.03] rounded-xl p-3 border-l-2 border-emerald-500/50">
              <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-1">Curto Prazo</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{shortTermGoals}</p>
            </div>
          )}
          {aspirations.medo_do_fracasso !== undefined && (
            <SkillRow label="Medo do Fracasso" level={aspirations.medo_do_fracasso} color="red" />
          )}
        </ProfileSection>

        {/* ─── Traumas & Events ─── */}
        {(traumas.length > 0 || recentEvents.length > 0) && (
          <ProfileSection icon={AlertTriangle} label="Traumas & Eventos" accentColor="red">
            {traumas.map((trauma: any, i: number) => (
              <div key={i} className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                <p className="text-zinc-300 text-sm leading-relaxed">{trauma.descricao}</p>
                {trauma.intensidade_da_cicatriz && (
                  <div className="mt-2">
                    <SkillRow label="Intensidade" level={trauma.intensidade_da_cicatriz} color="red" />
                  </div>
                )}
                {trauma.gatilhos?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {trauma.gatilhos.map((g: string, j: number) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {recentEvents.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Eventos Recentes</span>
                {recentEvents.map((event: any, i: number) => (
                  <div key={i} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                    <p className="text-zinc-300 text-xs">{event.evento}</p>
                    {event.mudança_de_prioridade && (
                      <p className="text-zinc-600 text-[10px] mt-1">Mudança: {event.mudança_de_prioridade}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ProfileSection>
        )}
      </div>
    </aside>
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
