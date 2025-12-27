import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/app-context';
import { MessageInput } from './MessageInput';
import { LLMOptionsPanel } from './LLMOptionsPanel';
import { LorebookIndicator } from './LorebookIndicator';
import { StatsPanel } from './StatsPanel';
import { useDialogue } from '../../hooks/use-dialogue';
import { useLlm } from '../../hooks/use-llm';
import type { LLMResponse } from '../../services/llm-service';
import type { CharacterCardWithPath, DialogueMessageWithContent, MessageTokenUsage } from '../../types';
import type { CharacterStats } from '../../types/stats';

interface ChatViewProps {
  character: CharacterCardWithPath | null;
}

/**
 * Chat view with message list (user input + file links for responses)
 * Mobile-first responsive design
 */
export function ChatView({ character }: ChatViewProps) {
  const { app } = useApp();
  const {
    messages,
    characterFolderPath,
    llmOptions,
    isLoading,
    error,
    sendMessage,
    addAssistantMessage,
    saveSuggestions,
    deleteMessage,
    updateLLMOptions,
    reloadMessageContent,
  } = useDialogue(character);

  const {
    isGenerating,
    error: llmError,
    streamingContent,
    generateResponse,
    clearError,
  } = useLlm();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [characterStats, setCharacterStats] = useState<CharacterStats | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isGenerating]);

  // Parse "Gợi ý" section from LLM response
  // Format: > **Gợi ý:** [action1] [action2] [action3]
  const parseSuggestedPrompts = useCallback((response: string): string[] => {
    // Match the Gợi ý line - greedy match to get entire line
    const goiYMatch = response.match(/>\s*\*\*Gợi ý:\*\*\s*(.+)$/m);
    if (!goiYMatch) return [];

    const goiYSection = goiYMatch[1];

    // Extract content inside [...] brackets
    const bracketMatches = goiYSection.match(/\[([^\]]+)\]/g);
    if (bracketMatches && bracketMatches.length > 0) {
      return bracketMatches
        .map((m) => m.slice(1, -1).trim()) // Remove brackets
        .filter((s) => s.length > 0 && s.length < 200)
        .slice(0, 3);
    }

    // Fallback: split by common separators
    const items = goiYSection
      .split(/(?:\d+\.\s*|[;]\s*|\n\s*[-•]\s*)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 200);

    return items.slice(0, 3);
  }, []);

  // Regenerate latest turn - triggered by command palette or button
  // Keeps user message, deletes only assistant response, then regenerates
  // IMPORTANT: Reloads user message content from file in case user edited it
  const regenerateLatestTurn = useCallback(async () => {
    if (!character || !characterFolderPath || isGenerating || isLoading) return;

    // Get fresh messages from store
    const currentMessages = [...messages];

    // Find latest user message index
    let latestUserIdx = -1;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'user') {
        latestUserIdx = i;
        break;
      }
    }
    if (latestUserIdx === -1) return;

    const latestUserMsg = currentMessages[latestUserIdx];

    // Reload user message content from file (in case user edited it)
    const freshContent = await reloadMessageContent(latestUserMsg.filePath);
    if (freshContent) {
      latestUserMsg.content = freshContent;
    }

    // Find assistant response after the user message (if exists)
    const assistantAfterUser = currentMessages[latestUserIdx + 1];

    // Delete only the assistant response (not the user message)
    if (assistantAfterUser && assistantAfterUser.role === 'assistant') {
      await deleteMessage(assistantAfterUser.filePath);
    }

    // Context for LLM = all messages up to and including the user message (with fresh content)
    const contextMessages = currentMessages.slice(0, latestUserIdx + 1);

    await generateResponse(
      character,
      contextMessages,
      async (responseContent, llmResponse?: LLMResponse) => {
        const tokenUsage: MessageTokenUsage | undefined = llmResponse
          ? {
              providerId: llmResponse.providerId,
              model: llmResponse.model,
              inputTokens: llmResponse.usage?.promptTokens,
              outputTokens: llmResponse.usage?.completionTokens,
            }
          : undefined;

        const assistantMsg = await addAssistantMessage(responseContent, tokenUsage);
        if (assistantMsg) {
          const prompts = parseSuggestedPrompts(responseContent);
          if (prompts.length > 0) {
            await saveSuggestions(assistantMsg.filePath, prompts);
          }
        }
      },
      llmOptions
    );
  }, [character, characterFolderPath, messages, isGenerating, isLoading, reloadMessageContent, deleteMessage, generateResponse, addAssistantMessage, parseSuggestedPrompts, saveSuggestions, llmOptions]);

  // Listen for regenerate command from command palette
  useEffect(() => {
    const handleRegenerateCommand = () => {
      regenerateLatestTurn();
    };

    window.addEventListener('talevault:regenerate-latest', handleRegenerateCommand);
    return () => {
      window.removeEventListener('talevault:regenerate-latest', handleRegenerateCommand);
    };
  }, [regenerateLatestTurn]);

  // Get suggestions from the LAST assistant message (even if empty - fallback to previous)
  const latestSuggestions = useMemo((): string[] => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        // Return suggestions if exists, otherwise continue searching
        const suggestions = messages[i].suggestions;
        if (suggestions && suggestions.length > 0) {
          return suggestions;
        }
      }
    }
    return [];
  }, [messages]);

  // Find last user message for button layout
  const lastUserIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return i;
    }
    return -1;
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!character || !content.trim()) return;

    const userMsg = await sendMessage(content);
    if (!userMsg) return;

    const messagesWithUser = [...messages, userMsg];
    await generateResponse(
      character,
      messagesWithUser,
      async (responseContent, llmResponse?: LLMResponse) => {
        // Build token usage from LLM response
        const tokenUsage: MessageTokenUsage | undefined = llmResponse
          ? {
              providerId: llmResponse.providerId,
              model: llmResponse.model,
              inputTokens: llmResponse.usage?.promptTokens,
              outputTokens: llmResponse.usage?.completionTokens,
            }
          : undefined;

        const assistantMsg = await addAssistantMessage(responseContent, tokenUsage);
        // Parse and save suggestions to the assistant message
        if (assistantMsg) {
          const prompts = parseSuggestedPrompts(responseContent);
          if (prompts.length > 0) {
            await saveSuggestions(assistantMsg.filePath, prompts);
          }
        }
      },
      llmOptions
    );
  };

  const handleSuggestionSelect = (suggestion: string) => {
    // Append to input instead of auto-send
    setInputValue((prev) => (prev ? `${prev} ${suggestion}` : suggestion));
  };

  const handleDeleteMessage = async (filePath: string) => {
    await deleteMessage(filePath);
  };

  // Regenerate from a specific message (button click)
  // If user message: keep it, delete assistant after, regenerate
  // If assistant message: delete it, keep user before, regenerate
  // IMPORTANT: Reloads user message content from file in case user edited it
  const handleRegenerate = async (msg: DialogueMessageWithContent) => {
    if (!character || !characterFolderPath) return;

    const currentMessages = [...messages];
    const msgIndex = currentMessages.findIndex((m) => m.filePath === msg.filePath);
    if (msgIndex === -1) return;

    let contextMessages: DialogueMessageWithContent[];

    if (msg.role === 'user') {
      // User message: delete assistant after it (if exists), keep user
      const assistantAfter = currentMessages[msgIndex + 1];
      if (assistantAfter && assistantAfter.role === 'assistant') {
        await deleteMessage(assistantAfter.filePath);
      }
      // Reload user message content from file (in case user edited it)
      const freshContent = await reloadMessageContent(msg.filePath);
      if (freshContent) {
        currentMessages[msgIndex].content = freshContent;
      }
      contextMessages = currentMessages.slice(0, msgIndex + 1);
    } else {
      // Assistant message: delete it, context is everything before
      await deleteMessage(msg.filePath);
      contextMessages = currentMessages.slice(0, msgIndex);
      // Reload last user message content
      const lastUserIdx = contextMessages.findLastIndex((m) => m.role === 'user');
      if (lastUserIdx !== -1) {
        const freshContent = await reloadMessageContent(contextMessages[lastUserIdx].filePath);
        if (freshContent) {
          contextMessages[lastUserIdx].content = freshContent;
        }
      }
    }

    // Need at least one user message to regenerate
    const hasUserMsg = contextMessages.some((m) => m.role === 'user');
    if (!hasUserMsg) return;

    await generateResponse(
      character,
      contextMessages,
      async (responseContent, llmResponse?: LLMResponse) => {
        const tokenUsage: MessageTokenUsage | undefined = llmResponse
          ? {
              providerId: llmResponse.providerId,
              model: llmResponse.model,
              inputTokens: llmResponse.usage?.promptTokens,
              outputTokens: llmResponse.usage?.completionTokens,
            }
          : undefined;

        const assistantMsg = await addAssistantMessage(responseContent, tokenUsage);
        if (assistantMsg) {
          const prompts = parseSuggestedPrompts(responseContent);
          if (prompts.length > 0) {
            await saveSuggestions(assistantMsg.filePath, prompts);
          }
        }
      },
      llmOptions
    );
  };

  const openMessageFile = (filePath: string) => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file) {
      app.workspace.getLeaf(false).openFile(file as any);
    }
  };

  const displayError = error || llmError;
  const isBusy = isLoading || isGenerating;

  return (
    <div className="mianix-chat-view">
      {/* Header */}
      {character && (
        <div className="mianix-chat-header">
          <div className="mianix-chat-character">
            {character.avatarUrl && (
              <img
                src={character.avatarUrl}
                alt={character.name}
                className="mianix-chat-avatar"
              />
            )}
            <span className="mianix-chat-name">{character.name}</span>
          </div>
          <div className="mianix-chat-header-actions">
            <StatsPanel
              characterFolderPath={characterFolderPath}
              onStatsChange={setCharacterStats}
            />
            <LorebookIndicator
              characterFolderPath={characterFolderPath}
              recentMessages={messages.map(m => m.content)}
            />
            <LLMOptionsPanel
              options={llmOptions}
              onChange={updateLLMOptions}
              disabled={isBusy}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {displayError && (
        <div className="mianix-error">
          <span>{displayError}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      {/* Message list */}
      <div className="mianix-message-list">
        {!character && (
          <div className="mianix-empty-state">
            <p>Select a character to start chatting</p>
          </div>
        )}

        {character && messages.length === 0 && !isBusy && (
          <div className="mianix-empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isLatestUser = msg.role === 'user' && index === lastUserIndex;
          const isFirstMessage = index === 0 && msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`mianix-message ${msg.role}`}
            >
              {msg.role === 'assistant' && (
                <div className="mianix-message-avatar">
                  {character?.avatarUrl ? (
                    <img src={character.avatarUrl} alt={character.name} />
                  ) : (
                    <span className="mianix-avatar-placeholder">
                      {character?.name?.[0] || 'A'}
                    </span>
                  )}
                </div>
              )}
              <div className="mianix-message-content">
                {msg.role === 'assistant' && (
                  <div className="mianix-message-name">{character?.name}</div>
                )}

                {/* Both user and assistant: truncated preview with link to file */}
                <div className="mianix-message-link-container">
                  <button
                    className={`mianix-message-link ${msg.role}`}
                    onClick={() => openMessageFile(msg.filePath)}
                    title="Click to open in editor"
                  >
                    {msg.role === 'user' ? '✏️' : '📄'} {msg.content.slice(0, 50)}
                    {msg.content.length > 50 ? '...' : ''}
                  </button>
                </div>

                <div className="mianix-message-footer">
                  <span className="mianix-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="mianix-message-actions">
                    {/* Latest user message: [regenerate, delete] */}
                    {isLatestUser && (
                      <>
                        <button
                          onClick={() => handleRegenerate(msg)}
                          title="Regenerate response"
                          className="mianix-action-btn"
                          disabled={isBusy}
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.filePath)}
                          title="Delete"
                          className="mianix-action-btn mianix-action-danger"
                          disabled={isBusy}
                        >
                          🗑️
                        </button>
                      </>
                    )}

                    {/* Assistant messages: only delete (except first message) */}
                    {msg.role === 'assistant' && !isFirstMessage && (
                      <button
                        onClick={() => handleDeleteMessage(msg.filePath)}
                        title="Delete"
                        className="mianix-action-btn mianix-action-danger"
                        disabled={isBusy}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Waiting/Generating state */}
        {isGenerating && (
          <div className="mianix-message assistant">
            <div className="mianix-message-avatar">
              {character?.avatarUrl ? (
                <img src={character.avatarUrl} alt={character?.name} />
              ) : (
                <span className="mianix-avatar-placeholder">
                  {character?.name?.[0] || 'A'}
                </span>
              )}
            </div>
            <div className="mianix-message-content">
              <div className="mianix-message-name">{character?.name}</div>
              {streamingContent ? (
                <div className="mianix-streaming-text">
                  {streamingContent}
                </div>
              ) : (
                <div className="mianix-waiting-state">
                  <div className="mianix-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="mianix-waiting-text">Đang chờ phản hồi...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mianix-input-area">
        {/* Suggestions dropdown - from latest assistant message with suggestions */}
        {latestSuggestions.length > 0 && (
          <div className="mianix-suggestions-dropdown">
            <label htmlFor="suggestion-select">Gợi ý:</label>
            <select
              id="suggestion-select"
              onChange={(e) => {
                if (e.target.value) {
                  handleSuggestionSelect(e.target.value);
                  e.target.value = ''; // Reset select
                }
              }}
              disabled={isBusy}
            >
              <option value="">-- Chọn gợi ý --</option>
              {latestSuggestions.map((s, i) => (
                <option key={i} value={s}>
                  {s.length > 60 ? s.slice(0, 57) + '...' : s}
                </option>
              ))}
            </select>
          </div>
        )}

        <MessageInput
          onSend={handleSend}
          disabled={!character || isBusy}
          placeholder={
            character
              ? `Message ${character.name}...`
              : 'Select a character first'
          }
          value={inputValue}
          onChange={setInputValue}
        />
      </div>
    </div>
  );
}
