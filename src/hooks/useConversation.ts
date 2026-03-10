'use client';

import { useState, useCallback } from 'react';

export type BlockType =
  | 'arena-result'
  | 'arena-live'
  | 'electoral-result'
  | 'electoral-setup'
  | 'chat-session'
  | 'processing'
  | 'media-scanning';

export interface ConversationBlock {
  id: string;
  type: BlockType;
  timestamp: Date;
  data: any;
}

export function useConversation() {
  const [blocks, setBlocks] = useState<ConversationBlock[]>([]);

  const addBlock = useCallback((block: ConversationBlock) => {
    setBlocks(prev => [...prev, block]);
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<ConversationBlock>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const replaceBlock = useCallback((id: string, newBlock: ConversationBlock) => {
    setBlocks(prev => prev.map(b => (b.id === id ? newBlock : b)));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const clearAll = useCallback(() => setBlocks([]), []);

  return { blocks, addBlock, updateBlock, replaceBlock, removeBlock, clearAll };
}
