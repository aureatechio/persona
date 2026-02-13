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
  BrainCircuit,
  MapPin,
  Briefcase,
  Heart,
  Target,
  Menu
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
        <aside 
          className={`hidden lg:flex bg-zinc-950 border-l border-zinc-900 transition-all duration-300 flex-col shrink-0 ${showSidebar ? 'w-96' : 'w-0 opacity-0 pointer-events-none'}`}
        >
          <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
            <h2 className="font-bold text-xl">Perfil</h2>
            <button onClick={() => setShowSidebar(false)} className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-900 rounded-xl transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Avatar e Info Básica */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-zinc-800 mx-auto mb-4 flex items-center justify-center text-zinc-500 shadow-xl overflow-hidden">
                {persona.photo_path ? (
                  <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} />
                )}
              </div>
              <h3 className="text-xl font-bold">{persona.name}</h3>
              <p className="text-zinc-500 text-sm flex items-center justify-center gap-1 mt-1">
                <MapPin size={12} />
                {persona.age} anos • {persona.city}, {persona.state}
              </p>
              <span className="inline-block mt-3 px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300">
                {archetype}
              </span>
            </div>

            {/* Ocupação */}
            {occupation && (
              <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 text-zinc-500 mb-2">
                  <Briefcase size={14} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Ocupação</span>
                </div>
                <p className="text-zinc-200 text-sm font-semibold">{occupation}</p>
                {sector && <p className="text-zinc-500 text-xs mt-1">{sector}</p>}
              </div>
            )}

            {/* História */}
            <div>
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Heart size={12} />
                História
              </h4>
              <p className="text-zinc-400 text-sm leading-relaxed bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900/50">
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
      </div>
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
