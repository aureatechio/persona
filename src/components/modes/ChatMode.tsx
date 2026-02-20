'use client';

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationBlock } from '@/hooks/useConversation';

interface ChatModeProps {
  onAddBlock: (block: ConversationBlock) => void;
  onUpdateBlock: (id: string, updates: Partial<ConversationBlock>) => void;
  onProcessing: (processing: boolean) => void;
}

export function ChatMode({ onAddBlock, onUpdateBlock, onProcessing }: ChatModeProps) {
  const { user } = useAuth();
  const activeChatBlockRef = useRef<string | null>(null);

  // Start chat with a specific persona
  const startChat = useCallback(async (personaId: string) => {
    if (!user?.id) return;

    onProcessing(true);
    try {
      const { data: persona } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (!persona) return;

      // Create or get chat
      const { data: existingChats } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', user.id)
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false })
        .limit(1);

      let chatId: string;
      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat } = await supabase
          .from('chats')
          .insert({ user_id: user.id, persona_id: personaId })
          .select('id')
          .single();
        chatId = newChat!.id;
      }

      // Load existing messages
      const { data: messageData } = await supabase
        .from('messages')
        .select('id, message, created_at, bot_message')
        .eq('chat_id', chatId)
        .order('created_at');

      const messages = (messageData || []).map((msg: any) => ({
        id: msg.id,
        role: msg.bot_message ? 'assistant' : 'user',
        content: msg.message ?? '',
        timestamp: new Date(msg.created_at),
      }));

      const blockId = crypto.randomUUID();
      activeChatBlockRef.current = blockId;

      onAddBlock({
        id: blockId,
        type: 'chat-session',
        timestamp: new Date(),
        data: {
          persona,
          chatId,
          messages,
          pendingResponses: 0,
        },
      });
    } catch (err) {
      console.error('[Chat] Start failed:', err);
    } finally {
      onProcessing(false);
    }
  }, [user, onAddBlock, onProcessing]);

  // Listen for submit events — send messages to active chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.mode === 'chat' && activeChatBlockRef.current) {
        window.dispatchEvent(new CustomEvent('chat-message', {
          detail: { blockId: activeChatBlockRef.current, message: detail.value },
        }));
      }
    };
    window.addEventListener('unified-submit', handler);
    return () => window.removeEventListener('unified-submit', handler);
  }, []);

  // Listen for persona selection from drawer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.personaId) {
        startChat(detail.personaId);
      }
    };
    window.addEventListener('chat-select-persona', handler);
    return () => window.removeEventListener('chat-select-persona', handler);
  }, [startChat]);

  return null;
}
