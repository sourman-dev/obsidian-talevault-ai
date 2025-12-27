import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/app-context';
import { LlmService, type LLMContext, type LLMResponse } from '../services/llm-service';
import { PresetService } from '../services/preset-service';
import { DialogueService } from '../services/dialogue-service';
import { MemoryExtractionService } from '../services/memory-extraction-service';
import { LorebookService } from '../services/lorebook-service';
import { StatsService } from '../services/stats-service';
import { isMultiProviderConfigured } from '../utils/provider-resolver';
import { DEFAULT_LLM_OPTIONS } from '../presets';
import type {
  CharacterCardWithPath,
  DialogueMessageWithContent,
  LLMOptions,
} from '../types';

/** Number of recent messages to include in context */
const RECENT_MESSAGES_COUNT = 10;

/**
 * Hook for LLM chat completion with BM25 memory retrieval
 */
export function useLlm() {
  const { app, settings } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  const llmService = useMemo(() => new LlmService(settings), [settings]);
  const presetService = useMemo(() => new PresetService(app), [app]);
  const dialogueService = useMemo(() => new DialogueService(app), [app]);
  const lorebookService = useMemo(() => new LorebookService(app), [app]);
  const statsService = useMemo(() => new StatsService(app), [app]);

  /**
   * Check if LLM is properly configured
   */
  const isConfigured = useCallback((): boolean => {
    // Check new multi-provider system
    if (isMultiProviderConfigured(settings)) {
      return true;
    }
    // Fallback to legacy settings
    return !!settings.llm.apiKey;
  }, [settings]);

  /**
   * Generate response with streaming
   * Uses BM25 to retrieve relevant memories from past conversations
   */
  const generateResponse = useCallback(
    async (
      character: CharacterCardWithPath,
      messages: DialogueMessageWithContent[],
      onComplete: (content: string, response?: LLMResponse) => Promise<void>,
      llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS
    ) => {
      if (!isConfigured()) {
        setError('No LLM provider configured. Go to Settings > TaleVault AI.');
        return;
      }

      setIsGenerating(true);
      setError(null);
      setStreamingContent('');

      try {
        // Load presets from vault
        const presets = await presetService.loadAllPresets();

        // Get user's last message for memory search
        const lastUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === 'user');

        // Build context with BM25 memory search + lorebook
        const context: LLMContext = {};
        if (lastUserMessage) {
          const relevantMemories = await dialogueService.searchMemories(
            character.folderPath,
            lastUserMessage.content,
            5 // Top 5 relevant memories
          );
          if (relevantMemories) {
            context.relevantMemories = relevantMemories;
          }
        }

        // Get active lorebook entries based on recent message content
        const recentContent = messages.slice(-settings.lorebookScanDepth).map(m => m.content);
        const activeEntries = await lorebookService.getActiveEntries(
          character.folderPath,
          recentContent,
          settings.lorebookScanDepth
        );
        if (activeEntries.length > 0) {
          context.lorebookContext = lorebookService.formatForContext(activeEntries);
        }

        // Get character stats for context injection
        const stats = await statsService.loadStats(character.folderPath);
        if (stats) {
          context.statsContext = statsService.formatForContext(stats);
        }

        // Use only recent messages (not all history)
        const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);

        // TODO: Pass character-level model overrides when implemented
        // Currently using global defaults only
        const response = await llmService.chatStream(
          character,
          recentMessages,
          (chunk, done) => {
            if (!done) {
              setStreamingContent((prev) => prev + chunk);
            }
          },
          presets,
          llmOptions,
          context
          // session.modelConfig // Future: character-level override
        );

        // IMPORTANT: Set isGenerating false BEFORE onComplete
        // This ensures UI shows the saved message, not the streaming state
        setIsGenerating(false);
        setStreamingContent('');

        // Save completed message with response metadata
        await onComplete(response.content, response);

        // Run memory extraction in background (async, non-blocking)
        if (settings.enableMemoryExtraction && lastUserMessage) {
          runMemoryExtraction(
            character.folderPath,
            lastUserMessage.content,
            response.content,
            lastUserMessage.id
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate response');
        setIsGenerating(false);
        setStreamingContent('');
      }
    },
    [llmService, presetService, dialogueService, lorebookService, statsService, settings, isConfigured]
  );

  /**
   * Run memory extraction in background
   * Does not block UI, errors are silently logged
   */
  const runMemoryExtraction = useCallback(
    async (
      characterFolderPath: string,
      userMessage: string,
      aiMessage: string,
      messageId: string
    ) => {
      try {
        // Use new multi-provider system through MemoryExtractionService
        const extractionService = new MemoryExtractionService(settings);
        const memories = await extractionService.extractMemories(
          userMessage,
          aiMessage,
          messageId
        );

        if (memories.length > 0) {
          const indexService = dialogueService.getIndexService();
          for (const memory of memories) {
            await indexService.addMemory(characterFolderPath, memory);
          }
          console.log(`✅ Extracted ${memories.length} memories`);
        }
      } catch (error) {
        console.error('Memory extraction failed:', error);
        // Don't show error to user - extraction is optional
      }
    },
    [settings, dialogueService]
  );

  return {
    isGenerating,
    error,
    streamingContent,
    generateResponse,
    clearError: () => setError(null),
    isConfigured,
  };
}
