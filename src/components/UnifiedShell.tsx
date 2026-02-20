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
import { type Mode } from './ActionChips';

// Mode components
import { ArenaMode } from './modes/ArenaMode';
import { ElectoralMode } from './modes/ElectoralMode';
import { ChatMode } from './modes/ChatMode';

// Block renderers
import { ArenaResultBlock } from './blocks/ArenaResultBlock';
import { ProcessingBlock } from './blocks/ProcessingBlock';
import { MediaScannerBlock } from './blocks/MediaScannerBlock';
import { ElectoralResultBlock } from './blocks/ElectoralResultBlock';
import { ChatBlock } from './blocks/ChatBlock';
import { PersonaSelectorDrawer } from './PersonaSelectorDrawer';
import { CandidateSelector } from './arena-eleitoral/CandidateSelector';
import { NeuralBackground } from './NeuralBackground';
import type { Politician } from '@/lib/arena-eleitoral/types';

export function UnifiedShell() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPersonaDrawer, setShowPersonaDrawer] = useState(false);
  const { blocks, addBlock, updateBlock, replaceBlock, removeBlock, clearAll } = useConversation();
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

  const handleSelectMode = useCallback((mode: Mode) => {
    // Chat mode: open persona selector drawer
    if (mode === 'chat') {
      setActiveMode('chat');
      setShowPersonaDrawer(true);
      return;
    }

    setActiveMode(prev => {
      // If switching to electoral mode, add candidate selector block
      if (mode === 'eleitoral' && prev !== 'eleitoral') {
        const existing = blocks.find(b => b.type === 'electoral-setup');
        if (!existing) {
          addBlock({
            id: crypto.randomUUID(),
            type: 'electoral-setup',
            timestamp: new Date(),
            data: {},
          });
        }
      }
      return prev === mode ? null : mode;
    });
  }, [blocks, addBlock]);

  const renderBlock = useCallback((block: ConversationBlock) => {
    switch (block.type) {
      case 'processing':
        return <ProcessingBlock data={block.data} />;
      case 'media-scanning':
        return <MediaScannerBlock data={block.data} />;
      case 'arena-result':
        return <ArenaResultBlock data={block.data} />;
      case 'electoral-result':
        return <ElectoralResultBlock data={block.data} />;
      case 'electoral-setup':
        return (
          <CandidateSelector
            onStart={(candidateA: Politician, candidateB: Politician) => {
              removeBlock(block.id);
              window.dispatchEvent(new CustomEvent('electoral-start', {
                detail: { candidateA, candidateB },
              }));
            }}
          />
        );
      case 'chat-session':
        return <ChatBlock data={block.data} blockId={block.id} onUpdate={(data) => updateBlock(block.id, { data })} />;
      default:
        return null;
    }
  }, [addBlock, updateBlock, removeBlock]);

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
      <TopBar personaCount={personaCache.count} />

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

        {/* Mode-specific input handlers (invisible - they control submit logic) */}
        {activeMode === 'arena' && (
          <ArenaMode
            personaCache={personaCache}
            onAddBlock={addBlock}
            onReplaceBlock={replaceBlock}
            onProcessing={setIsProcessing}
          />
        )}
        {activeMode === 'eleitoral' && (
          <ElectoralMode
            personaCache={personaCache}
            onAddBlock={addBlock}
            onReplaceBlock={replaceBlock}
            onUpdateBlock={updateBlock}
            onProcessing={setIsProcessing}
          />
        )}
        {activeMode === 'chat' && (
          <ChatMode
            onAddBlock={addBlock}
            onUpdateBlock={updateBlock}
            onProcessing={setIsProcessing}
          />
        )}

        <BottomInput
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          onSubmit={(value) => {
            // Default: if no mode selected, treat as arena
            if (!activeMode) {
              setActiveMode('arena');
            }
            // Dispatch to the active mode's submit handler via custom event
            window.dispatchEvent(new CustomEvent('unified-submit', { detail: { value, mode: activeMode || 'arena' } }));
          }}
          isProcessing={isProcessing}
          hasBlocks={blocks.length > 0}
        />
      </div>

      <PersonaSelectorDrawer
        isOpen={showPersonaDrawer}
        onClose={() => setShowPersonaDrawer(false)}
        onSelect={(personaId) => {
          setShowPersonaDrawer(false);
          window.dispatchEvent(new CustomEvent('chat-select-persona', {
            detail: { personaId },
          }));
        }}
      />
    </div>
  );
}
