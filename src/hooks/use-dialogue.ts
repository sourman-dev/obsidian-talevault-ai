import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/app-context';
import { DialogueService } from '../services/dialogue-service';
import { useRoleplayStore } from '../store';
import { DEFAULT_LLM_OPTIONS } from '../presets';
import type {
  CharacterCardWithPath,
  DialogueMessageWithContent,
  LLMOptions,
  MessageTokenUsage,
} from '../types';

/**
 * Hook to manage dialogue for a character.
 *
 * Simplified structure: messages/ directly under character folder.
 * Session is initialized when character is imported (in CharacterService).
 * This hook loads existing session and appends messages.
 */
export function useDialogue(character: CharacterCardWithPath | null) {
  const { app } = useApp();
  const { messages, setMessages, addMessage, setLoading, isLoading } =
    useRoleplayStore();
  const [llmOptions, setLlmOptionsState] = useState<LLMOptions>({
    ...DEFAULT_LLM_OPTIONS,
  });
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(() => new DialogueService(app), [app]);

  // Character folder path is used directly for dialogue operations
  const characterFolderPath = character?.folderPath ?? null;

  // Load dialogue when character changes
  useEffect(() => {
    if (!character) {
      setMessages([]);
      setLlmOptionsState({ ...DEFAULT_LLM_OPTIONS });
      return;
    }

    const loadDialogue = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await service.loadDialogue(character.folderPath);

        if (result) {
          setMessages(result.messages);
          setLlmOptionsState(result.session.llmOptions);
        } else {
          // No session yet - initialize one as fallback
          await service.initializeSession(character.folderPath, character.id);
          setLlmOptionsState({ ...DEFAULT_LLM_OPTIONS });

          if (character.firstMessage) {
            const firstMsg = await service.createFirstMessage(
              character.folderPath,
              character.firstMessage
            );
            setMessages([firstMsg]);
          } else {
            setMessages([]);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dialogue');
      } finally {
        setLoading(false);
      }
    };

    loadDialogue();
  }, [character, service, setMessages, setLoading]);

  // Send user message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!characterFolderPath || !content.trim()) return null;

      const parentId = messages.length > 0 ? messages[messages.length - 1].id : null;

      try {
        const userMsg = await service.appendMessage(
          characterFolderPath,
          'user',
          content.trim(),
          parentId
        );
        addMessage(userMsg);
        return userMsg;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send message');
        return null;
      }
    },
    [characterFolderPath, messages, service, addMessage]
  );

  // Add assistant message (for LLM response)
  // Uses store.getState() to get latest messages (avoids stale closure)
  const addAssistantMessage = useCallback(
    async (content: string, tokenUsage?: MessageTokenUsage) => {
      if (!characterFolderPath) return null;

      // Get latest messages from store to avoid stale closure
      const currentMessages = useRoleplayStore.getState().messages;
      const parentId = currentMessages.length > 0
        ? currentMessages[currentMessages.length - 1].id
        : null;

      try {
        const assistantMsg = await service.appendMessage(
          characterFolderPath,
          'assistant',
          content,
          parentId,
          tokenUsage
        );
        addMessage(assistantMsg);
        return assistantMsg;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add response');
        return null;
      }
    },
    [characterFolderPath, service, addMessage]
  );

  // Update message content (for editing)
  const editMessage = useCallback(
    async (filePath: string, content: string) => {
      try {
        await service.updateMessageContent(filePath, content);
        setMessages(
          messages.map((m) => (m.filePath === filePath ? { ...m, content } : m))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to edit message');
      }
    },
    [service, messages, setMessages]
  );

  // Save suggestions to message file
  const saveSuggestions = useCallback(
    async (filePath: string, suggestions: string[]) => {
      try {
        await service.updateMessageSuggestions(filePath, suggestions);
        setMessages(
          messages.map((m) =>
            m.filePath === filePath ? { ...m, suggestions } : m
          )
        );
      } catch (e) {
        console.error('Failed to save suggestions:', e);
      }
    },
    [service, messages, setMessages]
  );

  // Delete a single message
  const deleteMessage = useCallback(
    async (filePath: string) => {
      try {
        await service.deleteMessage(filePath);
        setMessages(messages.filter((m) => m.filePath !== filePath));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete message');
      }
    },
    [service, messages, setMessages]
  );

  // Delete message and all after (for regenerate)
  // Returns messages that were kept (to use for LLM context)
  const deleteMessagesFrom = useCallback(
    async (filePath: string): Promise<DialogueMessageWithContent[]> => {
      if (!characterFolderPath) return messages;

      try {
        const remaining = await service.deleteMessagesFrom(characterFolderPath, filePath);
        setMessages(remaining);
        return remaining;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete messages');
        return messages;
      }
    },
    [characterFolderPath, service, messages, setMessages]
  );

  // Update LLM options for this session
  const updateLLMOptions = useCallback(
    async (newOptions: LLMOptions) => {
      if (!characterFolderPath) return;

      try {
        await service.updateLLMOptions(characterFolderPath, newOptions);
        setLlmOptionsState(newOptions);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update LLM options');
      }
    },
    [characterFolderPath, service]
  );

  return {
    messages,
    characterFolderPath,
    llmOptions,
    isLoading,
    error,
    sendMessage,
    addAssistantMessage,
    editMessage,
    saveSuggestions,
    deleteMessage,
    deleteMessagesFrom,
    updateLLMOptions,
  };
}
