'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TopBar } from './TopBar';
import { BottomInput } from './BottomInput';
import { ConversationArea } from './ConversationArea';
import { WelcomeScreen } from './WelcomeScreen';
import { useConversation, type ConversationBlock } from '@/hooks/useConversation';
import { usePersonaCache } from '@/hooks/usePersonaCache';
// Mode components
import { ArenaMode } from './modes/ArenaMode';

// Block renderers
import { ArenaLiveBlock } from './blocks/ArenaLiveBlock';
import { ProcessingBlock } from './blocks/ProcessingBlock';
import { MediaScannerBlock } from './blocks/MediaScannerBlock';
import { NeuralBackground } from './NeuralBackground';

export function UnifiedShell() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const { blocks, addBlock, replaceBlock, clearAll } = useConversation();
  const personaCache = usePersonaCache();

  // Load persona count on mount
  useEffect(() => {
    personaCache.loadCount();
  }, []);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!session) router.push('/login');
  }, [authLoading, session, router]);

  const handleNewChat = useCallback(() => {
    clearAll();
    setIsProcessing(false);
    // Tell ArenaMode to broadcast reset via its persistent BroadcastChannel
    window.dispatchEvent(new CustomEvent('arena-new-chat'));
  }, [clearAll]);

  const renderBlock = useCallback((block: ConversationBlock) => {
    switch (block.type) {
      case 'processing':
        return <ProcessingBlock data={block.data} />;
      case 'media-scanning':
        return <MediaScannerBlock data={block.data} />;
      case 'arena-live':
        return <ArenaLiveBlock data={block.data} />;
      default:
        return null;
    }
  }, []);

  // Loading screen
  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      <TopBar personaCount={personaCache.count} hasBlocks={blocks.length > 0} onNewChat={handleNewChat} />

      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Animated neural network background */}
        {blocks.length === 0 && <NeuralBackground />}

        {/* Background glow orbs */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/[0.03] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-fuchsia-600/[0.02] rounded-full blur-[100px] pointer-events-none" />

        <ConversationArea
          blocks={blocks}
          renderBlock={renderBlock}
          welcomeScreen={<WelcomeScreen personaCount={personaCache.count} />}
        />

        {/* Arena mode handler (invisible - controls submit logic) */}
        <ArenaMode
          personaCache={personaCache}
          onAddBlock={addBlock}
          onReplaceBlock={replaceBlock}
          onProcessing={setIsProcessing}
        />

        <BottomInput
          onSubmit={(value) => {
            // Clear previous blocks + abort any running simulation + reset presentation screens
            clearAll();
            setIsProcessing(false);
            window.dispatchEvent(new CustomEvent('arena-new-chat'));
            window.dispatchEvent(new CustomEvent('unified-submit', { detail: { value, mode: 'arena' } }));
          }}
          isProcessing={isProcessing}
          hasBlocks={blocks.length > 0}
          personaCount={personaCache.count}
        />
      </div>
    </div>
  );
}
