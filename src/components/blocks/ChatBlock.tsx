'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, MapPin, BrainCircuit, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: Date;
}

interface ChatBlockProps {
  data: {
    persona: any;
    chatId: string;
    messages: Message[];
    pendingResponses: number;
  };
  blockId: string;
  onUpdate: (data: any) => void;
}

export function ChatBlock({ data, blockId, onUpdate }: ChatBlockProps) {
  const { user } = useAuth();
  const { persona, chatId } = data;
  const [messages, setMessages] = useState<Message[]>(data.messages || []);
  const [pending, setPending] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());

  const archetype = persona.archetype_primary || persona.psychology_json?.archetypes?.primary || 'Neutro';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for messages from BottomInput
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.blockId === blockId && detail.message) {
        handleSend(detail.message);
      }
    };
    window.addEventListener('chat-message', handler);
    return () => window.removeEventListener('chat-message', handler);
  }, [blockId, chatId, persona]);

  const processSend = useCallback(async (messageToSend: string) => {
    try {
      const { data: savedMsg } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, user_id: user!.id, persona_id: persona.id, message: messageToSend, bot_message: false })
        .select('id, created_at')
        .single();

      const personaIdentity = {
        name: persona.name, age: persona.age,
        gender: persona.gender_identity || persona.gender,
        city: persona.city, state: persona.state, region: persona.region,
        political_leaning: persona.political_leaning,
        score_economico: persona.score_economico, score_costumes: persona.score_costumes,
        macro_religion: persona.macro_religion, education_level: persona.education_level,
        social_class: persona.social_class, generation: persona.generation,
        archetype_primary: persona.archetype_primary || persona.psychology_json?.archetypes?.primary,
        cluster_name: persona.nome_grupo,
        occupation: persona.career_json?.atuação_e_cargo?.cargo_atual || persona.demographic_json?.socioeconomico?.ocupacao_principal,
        core_values: (persona.psychology_json?.core_values || []).map((v: any) => v.value),
        political_detail: persona.beliefs_json?.orientação_política || {},
        religion_detail: persona.beliefs_json?.religião || {},
        aversions: (persona.beliefs_json?.aversões || []).map((a: any) => a.alvo),
        // Electoral
        voto_2022: persona.voto_2022,
        aprovacao_lula: persona.aprovacao_lula,
        voto_2026: persona.voto_2026,
        // Temas polêmicos
        tema_aborto: persona.tema_aborto,
        tema_armas: persona.tema_armas,
        tema_maconha: persona.tema_maconha,
        tema_privatizacoes: persona.tema_privatizacoes,
        tema_cotas_raciais: persona.tema_cotas_raciais,
        tema_casamento_gay: persona.tema_casamento_gay,
        // Questionnaire key
        q_maior_problema: persona.q_maior_problema,
        q_avaliacao_bolsonaro: persona.q_avaliacao_bolsonaro,
        q_situacao_economica: persona.q_situacao_economica,
        q_perspectiva_futuro: persona.q_perspectiva_futuro,
        // Confiança institucional
        q_confianca_stf: persona.q_confianca_stf,
        q_confianca_congresso: persona.q_confianca_congresso,
        q_confianca_imprensa: persona.q_confianca_imprensa,
        q_confianca_policia: persona.q_confianca_policia,
        q_confianca_exercito: persona.q_confianca_exercito,
        q_confianca_igreja: persona.q_confianca_igreja,
        // Tabu implícito (all 20)
        tabu: {
          q_ti_racismo_latente: persona.q_ti_racismo_latente,
          q_ti_nao_contrataria_negro_chefia: persona.q_ti_nao_contrataria_negro_chefia,
          q_ti_vizinho_negro_incomoda: persona.q_ti_vizinho_negro_incomoda,
          q_ti_sonegaria_imposto: persona.q_ti_sonegaria_imposto,
          q_ti_aceitaria_propina: persona.q_ti_aceitaria_propina,
          q_ti_venderia_voto: persona.q_ti_venderia_voto,
          q_ti_bater_filho_normal: persona.q_ti_bater_filho_normal,
          q_ti_mulher_roupa_culpada: persona.q_ti_mulher_roupa_culpada,
          q_ti_homofobia_violenta: persona.q_ti_homofobia_violenta,
          q_ti_linchamento_apoiaria: persona.q_ti_linchamento_apoiaria,
          q_ti_tortura_preso_ok: persona.q_ti_tortura_preso_ok,
          q_ti_trabalho_infantil_ok: persona.q_ti_trabalho_infantil_ok,
          q_ti_jeitinho_furar_fila: persona.q_ti_jeitinho_furar_fila,
          q_ti_assediaria_mulher_rua: persona.q_ti_assediaria_mulher_rua,
          q_ti_intolerancia_religiosa: persona.q_ti_intolerancia_religiosa,
          q_ti_preconceito_nordestino: persona.q_ti_preconceito_nordestino,
          q_ti_violencia_domestica: persona.q_ti_violencia_domestica,
          q_ti_compraria_produto_roubado: persona.q_ti_compraria_produto_roubado,
          q_ti_menor14_sabe_o_que_faz: persona.q_ti_menor14_sabe_o_que_faz,
          q_ti_nepotismo_concurso: persona.q_ti_nepotismo_concurso,
        },
        // Vivências (all 18)
        vivencias: {
          q_vi_passou_fome: persona.q_vi_passou_fome,
          q_vi_ja_foi_assaltado: persona.q_vi_ja_foi_assaltado,
          q_vi_desempregado_1ano: persona.q_vi_desempregado_1ano,
          q_vi_pai_ausente: persona.q_vi_pai_ausente,
          q_vi_sofreu_racismo: persona.q_vi_sofreu_racismo,
          q_vi_depressao_ansiedade: persona.q_vi_depressao_ansiedade,
          q_vi_violencia_policial: persona.q_vi_violencia_policial,
          q_vi_dependencia: persona.q_vi_dependencia,
          q_vi_abuso_sexual_infancia: persona.q_vi_abuso_sexual_infancia,
          q_vi_trabalho_infantil: persona.q_vi_trabalho_infantil,
          q_vi_perdeu_familiar_violencia: persona.q_vi_perdeu_familiar_violencia,
          q_vi_sofreu_assedio_sexual: persona.q_vi_sofreu_assedio_sexual,
          q_vi_pensou_suicidio: persona.q_vi_pensou_suicidio,
          q_vi_preso_ou_familiar_preso: persona.q_vi_preso_ou_familiar_preso,
          q_vi_sofreu_violencia_domestica: persona.q_vi_sofreu_violencia_domestica,
          q_vi_ja_dormiu_na_rua: persona.q_vi_ja_dormiu_na_rua,
          q_vi_nao_completou_estudo: persona.q_vi_nao_completou_estudo,
          q_vi_enchente_desastre: persona.q_vi_enchente_desastre,
        },
      };

      const response = await fetch(
        process.env.NEXT_PUBLIC_PERSONA_CHAT_API || 'https://webhook.aureatech.io/webhook/persona-aurea-conversa',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, user_id: user!.id, persona_id: persona.id, message: messageToSend, persona_identity: personaIdentity }),
        }
      );

      if (!response.ok) throw new Error('Falha na comunicacao com a IA');
      const resData = await response.json();

      const assistantMsg: Message = {
        id: (Date.now() + Math.random()).toString(),
        role: 'assistant',
        content: resData.response || resData.output || resData.message || 'Desculpe, tive um problema ao processar sua mensagem.',
        thought: resData.thought,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      await supabase.from('messages').insert({
        chat_id: chatId, user_id: user!.id, persona_id: persona.id,
        message: assistantMsg.content, bot_message: true,
      });
    } catch (err) {
      console.error('Erro ao enviar:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + Math.random()).toString(),
        role: 'assistant',
        content: 'Erro de conexao com o servidor de IA.',
        timestamp: new Date(),
      }]);
    } finally {
      setPending(prev => Math.max(0, prev - 1));
    }
  }, [user, persona, chatId]);

  const handleSend = useCallback((text?: string) => {
    const msg = text?.trim();
    if (!msg || !user?.id) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setPending(prev => prev + 1);

    sendQueueRef.current = sendQueueRef.current.then(() => processSend(msg));
  }, [user, processSend]);

  return (
    <div className="flex flex-col">
      {/* Persona header — compact bar, no card */}
      <div className="flex items-center gap-3 py-3 px-1 mb-4 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
          {persona.photo_path ? (
            <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <User size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-sm truncate">{persona.name}</h3>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><MapPin size={10} />{persona.city}, {persona.state}</span>
            <span>{persona.age} anos</span>
            <span className="text-violet-400">{archetype}</span>
          </div>
        </div>
        <Link
          href={`/persona/${persona.id}`}
          className="text-zinc-500 hover:text-white p-2 hover:bg-white/[0.06] rounded-xl transition-colors duration-200"
          title="Ver perfil completo"
        >
          <ExternalLink size={16} />
        </Link>
      </div>

      {/* Messages — flat, no card container */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">
            Inicie uma conversa com {persona.name}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-white text-black rounded-tr-sm'
                : 'bg-zinc-900/80 text-white rounded-tl-sm border border-zinc-800/50'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.thought && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-lg border border-zinc-800/50">
                <BrainCircuit size={10} className="text-zinc-400" />
                <span>{msg.thought}</span>
              </div>
            )}
            <span className="text-[10px] text-zinc-600 mt-1 px-2">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {pending > 0 && (
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs">{persona.name} esta digitando</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
