import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/app-context';
import { MessageInput } from './MessageInput';
import { LLMOptionsPanel } from './LLMOptionsPanel';
import { useDialogue } from '../../hooks/use-dialogue';
import { useLlm } from '../../hooks/use-llm';
import type { LLMResponse } from '../../services/llm-service';
import type { CharacterCardWithPath, DialogueMessageWithContent, MessageTokenUsage } from '../../types';

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
    deleteMessagesFrom,
    updateLLMOptions,
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isGenerating]);

  // Parse "Gợi ý" section from LLM response
  // Format: > **Gợi ý:** [action1] [action2] [action3]
  const parseSuggestedPrompts = useCallback((response: string): string[] => {
    // Match the Gợi ý line
    const goiYMatch = response.match(/>\s*\*\*Gợi ý:\*\*\s*(.+?)(?:\n|$)/s);
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

  // Get suggestions from the last assistant message
  const lastAssistantWithSuggestions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].suggestions?.length) {
        return messages[i];
      }
    }
    return null;
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

  const handleRegenerate = async (msg: DialogueMessageWithContent) => {
    if (!character || !characterFolderPath) return;

    // Delete from this message onwards
    const remaining = await deleteMessagesFrom(msg.filePath);

    // Find last user message to regenerate from
    const lastUserMsg = remaining.filter((m) => m.role === 'user').pop();
    if (!lastUserMsg) return;

    await generateResponse(
      character,
      remaining,
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
          <LLMOptionsPanel
            options={llmOptions}
            onChange={updateLLMOptions}
            disabled={isBusy}
          />
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

        {messages.map((msg, index) => (
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

              {msg.role === 'user' ? (
                // User message: show content directly
                <div className="mianix-message-text">{msg.content}</div>
              ) : (
                // Assistant message: show as clickable link
                <div className="mianix-message-link-container">
                  <button
                    className="mianix-message-link"
                    onClick={() => openMessageFile(msg.filePath)}
                    title="Click to open in editor"
                  >
                    📄 {msg.content.slice(0, 80)}
                    {msg.content.length > 80 ? '...' : ''}
                  </button>
                </div>
              )}

              <div className="mianix-message-footer">
                <span className="mianix-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                <div className="mianix-message-actions">
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleRegenerate(msg)}
                      title="Regenerate"
                      className="mianix-action-btn"
                      disabled={isBusy}
                    >
                      🔄
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(msg.filePath)}
                    title="Delete"
                    className="mianix-action-btn mianix-action-danger"
                    disabled={isBusy}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

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
        {/* Suggestions dropdown */}
        {lastAssistantWithSuggestions?.suggestions &&
          lastAssistantWithSuggestions.suggestions.length > 0 && (
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
                {lastAssistantWithSuggestions.suggestions.map((s, i) => (
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
