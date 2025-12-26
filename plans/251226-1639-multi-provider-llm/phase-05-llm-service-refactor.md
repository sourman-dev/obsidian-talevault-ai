---
phase: 5
title: "LLM Service Refactor"
status: completed
completed_date: 2025-12-26
effort: 1.5h
depends: [phase-01, phase-02]
review: ../reports/code-reviewer-251226-2145-phase-5-llm-service.md
---

# Phase 5: LLM Service Refactor

## Context

- Parent: [plan.md](./plan.md)
- Depends: [Phase 1](./phase-01-provider-types.md), [Phase 2](./phase-02-settings-migration.md)

## Overview

Refactor LlmService và MemoryExtractionService để sử dụng multi-provider system thay vì hardcoded single provider.

## Current State

```typescript
// llm-service.ts
const { baseUrl, apiKey, modelName } = this.settings.llm;

// memory-extraction-service.ts
const config = this.settings.extractionModel || this.settings.llm;
```

## Target State

```typescript
// Use provider resolver to get active provider config
const providerConfig = resolveProvider(settings, 'text', characterConfig);
// Returns: { provider: LLMProvider, model: string }
```

## Implementation

### 1. Provider Resolver Helper (`src/utils/provider-resolver.ts`)

```typescript
import type { MianixSettings, LLMProvider, ModelReference } from '../types';

export interface ResolvedProvider {
  provider: LLMProvider;
  model: string;
  /** For token tracking */
  providerId: string;
}

/**
 * Resolve which provider+model to use for a given model type
 *
 * Resolution chain:
 * 1. Character-level override (if provided)
 * 2. Global defaults
 * 3. Fallback: first provider with its defaultModel
 */
export function resolveProvider(
  settings: MianixSettings,
  modelType: 'text' | 'extraction' | 'image',
  characterOverride?: Partial<Record<'text' | 'extraction' | 'image', ModelReference>>
): ResolvedProvider | null {
  const providers = settings.providers || [];

  if (providers.length === 0) {
    return null;
  }

  // 1. Check character override
  const override = characterOverride?.[modelType];
  if (override?.providerId) {
    const provider = providers.find(p => p.id === override.providerId);
    if (provider) {
      return {
        provider,
        model: override.model || provider.defaultModel || '',
        providerId: provider.id,
      };
    }
  }

  // 2. Check global defaults
  const defaultRef = settings.defaults[modelType];
  if (defaultRef?.providerId) {
    const provider = providers.find(p => p.id === defaultRef.providerId);
    if (provider) {
      return {
        provider,
        model: defaultRef.model || provider.defaultModel || '',
        providerId: provider.id,
      };
    }
  }

  // 3. For extraction, fallback to text provider if not configured
  if (modelType === 'extraction') {
    return resolveProvider(settings, 'text', characterOverride);
  }

  // 4. Fallback: first provider
  const firstProvider = providers[0];
  return {
    provider: firstProvider,
    model: firstProvider.defaultModel || '',
    providerId: firstProvider.id,
  };
}

/**
 * Build request headers based on provider preset
 */
export function buildAuthHeaders(provider: LLMProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Determine auth header from preset
  const authHeader = provider.authHeader || 'bearer';

  switch (authHeader) {
    case 'x-goog-api-key':
      headers['x-goog-api-key'] = provider.apiKey;
      break;
    case 'x-api-key':
      headers['x-api-key'] = provider.apiKey;
      break;
    case 'api-key':
      headers['api-key'] = provider.apiKey;
      break;
    default:
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  return headers;
}
```

### 2. Refactored LlmService (`src/services/llm-service.ts`)

```typescript
import type {
  MianixSettings,
  CharacterCardWithPath,
  DialogueMessageWithContent,
  LLMOptions,
  ModelReference,
} from '../types';
import { resolveProvider, buildAuthHeaders, type ResolvedProvider } from '../utils/provider-resolver';
import { DEFAULT_LLM_OPTIONS } from '../presets';

// ... existing interfaces ...

/** LLM response with usage info */
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  providerId: string;
  model: string;
}

export class LlmService {
  constructor(private settings: MianixSettings) {}

  /**
   * Resolve provider for text generation
   */
  private getTextProvider(
    characterOverride?: Partial<Record<'text' | 'extraction' | 'image', ModelReference>>
  ): ResolvedProvider {
    const resolved = resolveProvider(this.settings, 'text', characterOverride);
    if (!resolved) {
      throw new Error('No LLM provider configured. Please add a provider in settings.');
    }
    return resolved;
  }

  // ... existing buildSystemPrompt and buildMessages methods unchanged ...

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
    characterOverride?: Partial<Record<'text' | 'extraction' | 'image', ModelReference>>
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
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
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
    characterOverride?: Partial<Record<'text' | 'extraction' | 'image', ModelReference>>
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
    let usage: LLMResponse['usage'];

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
```

### 3. Refactored MemoryExtractionService

```typescript
// In memory-extraction-service.ts

import { resolveProvider, buildAuthHeaders } from '../utils/provider-resolver';

export class MemoryExtractionService {
  constructor(
    private app: App,
    private settings: MianixSettings
  ) {}

  async extractMemories(
    characterId: string,
    messages: DialogueMessageWithContent[]
  ): Promise<ExtractedMemory[]> {
    // Use extraction provider, falls back to text provider
    const resolved = resolveProvider(this.settings, 'extraction');

    if (!resolved) {
      console.warn('No provider configured for extraction');
      return [];
    }

    const { provider, model } = resolved;

    // ... rest of extraction logic using provider.baseUrl, model, buildAuthHeaders(provider)
  }
}
```

### 4. Update useLLM Hook

```typescript
// In use-llm.ts

// Pass character config to LLM service
const response = await llmService.chatStream(
  character,
  dialogueMessages,
  onChunk,
  presets,
  session.llmOptions,
  context,
  session.modelConfig // Pass character-level override
);

// Store usage in message metadata
if (response.usage) {
  // This will be handled in Phase 6
}
```

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/utils/provider-resolver.ts` | Create |
| `src/services/llm-service.ts` | Refactor |
| `src/services/memory-extraction-service.ts` | Update |
| `src/hooks/use-llm.ts` | Update |

## Success Criteria

- [x] ✅ resolveProvider correctly chains: character → default → fallback
- [x] ✅ LLM calls use resolved provider config
- [x] ✅ Auth headers match provider type
- [x] ✅ Extraction falls back to text provider when not configured
- [x] ✅ LLMResponse includes usage info when available
- [x] ✅ Character-level model override works (infrastructure ready, UI integration pending)

## Todo

- [x] ✅ Create provider-resolver.ts
- [x] ✅ Refactor LlmService to use resolver
- [x] ✅ Update MemoryExtractionService
- [x] ✅ Update useLLM hook to pass character config
- [x] ✅ Test with different providers

## Code Review Results

**Review Date:** 2025-12-26
**Status:** ✅ PASSED (Grade: A - 9/10)
**Report:** [code-reviewer-251226-2145-phase-5-llm-service.md](../reports/code-reviewer-251226-2145-phase-5-llm-service.md)

**Summary:**
- ✅ All success criteria met
- ✅ Security: No vulnerabilities, API keys properly handled
- ✅ Performance: Efficient provider lookup, no redundant calls
- ✅ Architecture: Clean separation, backward compatible
- ⚠️ Medium priority: Minor code quality improvements recommended (see report)

**Recommended Follow-up Actions:**
1. Refactor MemoryExtractionService header handling (medium priority)
2. Add debug logging to stream parsing errors (medium priority)
3. Extract common provider resolution logic (low priority)

**Ready for Phase 6:** ✅ YES
