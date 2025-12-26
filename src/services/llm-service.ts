/**
 * LLM Service for OpenAI-compatible APIs
 * Supports: OpenAI, Google AI, OpenRouter, Groq, local models, etc.
 */

import type {
  MianixSettings,
  CharacterCardWithPath,
  DialogueMessageWithContent,
  LLMOptions,
} from '../types';
import {
  resolveProvider,
  buildAuthHeaders,
  isMultiProviderConfigured,
  type ModelOverrides,
  type ResolvedProvider,
} from '../utils/provider-resolver';
import { DEFAULT_LLM_OPTIONS } from '../presets';

/** OpenAI-compatible message format */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Presets loaded from vault */
export interface LoadedPresets {
  multiModePrompt: string;
  outputFormatPrompt: string;
}

/** Context for LLM including memories */
export interface LLMContext {
  /** Retrieved memories from BM25 search (formatted string) */
  relevantMemories?: string;
}

/** Token usage info */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** LLM response with usage info for token tracking */
export interface LLMResponse {
  content: string;
  usage?: TokenUsage;
  providerId: string;
  model: string;
}

/** Streaming callback */
type OnChunk = (chunk: string, done: boolean) => void;

/**
 * LLM Service for multi-provider chat completions
 */
export class LlmService {
  constructor(private settings: MianixSettings) {}

  /**
   * Resolve provider for text generation
   * Falls back to legacy settings if new system not configured
   */
  private getTextProvider(characterOverride?: ModelOverrides): ResolvedProvider {
    // Try new multi-provider system first
    if (isMultiProviderConfigured(this.settings)) {
      const resolved = resolveProvider(this.settings, 'text', characterOverride);
      if (resolved) {
        return resolved;
      }
    }

    // Fallback to legacy settings
    const { baseUrl, apiKey, modelName } = this.settings.llm;
    if (!apiKey) {
      throw new Error('No LLM provider configured. Please add a provider in settings.');
    }

    return {
      provider: {
        id: 'legacy',
        name: 'Legacy Provider',
        baseUrl,
        apiKey,
        defaultModel: modelName,
      },
      model: modelName,
      providerId: 'legacy',
    };
  }

  /**
   * Build system prompt from character card + presets + memories
   */
  buildSystemPrompt(
    character: CharacterCardWithPath,
    presets: LoadedPresets,
    llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS,
    context?: LLMContext
  ): string {
    const parts: string[] = [];

    // 1. Multi-mode roleplay prompt (persona system)
    parts.push(presets.multiModePrompt);

    // 2. Character card info
    parts.push('\n\n---\n## Character Information\n');
    parts.push(`**Name:** ${character.name}`);

    if (character.description) {
      parts.push(`\n**Description:** ${character.description}`);
    }

    if (character.personality) {
      parts.push(`\n**Personality:** ${character.personality}`);
    }

    if (character.scenario) {
      parts.push(`\n**Scenario:** ${character.scenario}`);
    }

    // 3. Long-term memories (from BM25 search)
    if (context?.relevantMemories) {
      parts.push('\n\n---\n## Long-term Memory\n');
      parts.push('**Thông tin quan trọng từ các cuộc trò chuyện trước:**\n');
      parts.push(context.relevantMemories);
    }

    // 4. Output format with responseLength
    const outputFormat = presets.outputFormatPrompt.replace(
      '${responseLength}',
      llmOptions.responseLength.toString()
    );
    parts.push('\n\n---\n');
    parts.push(outputFormat);

    return parts.join('');
  }

  /**
   * Build messages array for API call
   */
  buildMessages(
    character: CharacterCardWithPath,
    dialogueMessages: DialogueMessageWithContent[],
    presets: LoadedPresets,
    llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS,
    context?: LLMContext
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt (includes memories if provided)
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(character, presets, llmOptions, context),
    });

    // Dialogue history (only recent messages, not all)
    for (const msg of dialogueMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return messages;
  }

  /**
   * Send chat completion request (non-streaming)
   * Returns content + usage info for token tracking
   */
  async chat(
    character: CharacterCardWithPath,
    dialogueMessages: DialogueMessageWithContent[],
    presets: LoadedPresets,
    llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS,
    context?: LLMContext,
    characterOverride?: ModelOverrides
  ): Promise<LLMResponse> {
    const { provider, model, providerId } = this.getTextProvider(characterOverride);

    const messages = this.buildMessages(
      character,
      dialogueMessages,
      presets,
      llmOptions,
      context
    );

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: llmOptions.temperature,
        top_p: llmOptions.topP,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      providerId,
      model,
    };
  }

  /**
   * Send chat completion request with streaming
   * Note: Token counts may not be available in streaming mode for all providers
   */
  async chatStream(
    character: CharacterCardWithPath,
    dialogueMessages: DialogueMessageWithContent[],
    onChunk: OnChunk,
    presets: LoadedPresets,
    llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS,
    context?: LLMContext,
    characterOverride?: ModelOverrides
  ): Promise<LLMResponse> {
    const { provider, model, providerId } = this.getTextProvider(characterOverride);

    const messages = this.buildMessages(
      character,
      dialogueMessages,
      presets,
      llmOptions,
      context
    );

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: llmOptions.temperature,
        top_p: llmOptions.topP,
        // Request usage in stream (OpenAI supports this)
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: TokenUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk('', true);
              return { content: fullContent, usage, providerId, model };
            }

            try {
              const parsed = JSON.parse(data);

              // Capture usage from final chunk (OpenAI format)
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                };
              }

              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onChunk(content, false);
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk('', true);
    return { content: fullContent, usage, providerId, model };
  }
}
