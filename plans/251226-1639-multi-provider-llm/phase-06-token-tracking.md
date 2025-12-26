---
phase: 6
title: "Token Tracking Per Message"
status: pending
effort: 0.5h
depends: [phase-01, phase-05]
---

# Phase 6: Token Tracking Per Message

## Context

- Parent: [plan.md](./plan.md)
- Depends: [Phase 1](./phase-01-provider-types.md), [Phase 5](./phase-05-llm-service-refactor.md)

## Overview

Store per-turn token usage in message frontmatter. Useful for:
- Usage analytics
- Cost tracking
- Debugging context length issues

## Current State

DialogueMessage frontmatter:

```yaml
---
id: abc123
role: assistant
parentId: xyz789
timestamp: 2025-12-26T10:00:00.000Z
suggestions:
  - Option A
  - Option B
---
```

## Target State

```yaml
---
id: abc123
role: assistant
parentId: xyz789
timestamp: 2025-12-26T10:00:00.000Z
suggestions:
  - Option A
  - Option B
# Token tracking (only for assistant messages)
providerId: openai-main
model: gpt-4-turbo
inputTokens: 1234
outputTokens: 567
---
```

## Implementation

### 1. Update DialogueMessage Type

```typescript
// In types/index.ts

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  parentId: string | null;
  timestamp: string;
  suggestions?: string[];

  // Token tracking (optional, only on assistant messages)
  providerId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}
```

### 2. Update DialogueService

```typescript
// In dialogue-service.ts

export interface TokenUsage {
  providerId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class DialogueService {
  /**
   * Create assistant message with token tracking
   */
  async createAssistantMessage(
    characterId: string,
    content: string,
    parentId: string | null,
    suggestions?: string[],
    usage?: TokenUsage
  ): Promise<DialogueMessageWithContent> {
    const message: DialogueMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      parentId,
      timestamp: new Date().toISOString(),
      suggestions,
      // Add token tracking if provided
      ...(usage && {
        providerId: usage.providerId,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }),
    };

    // ... rest of file creation logic
  }
}
```

### 3. Update useLLM Hook

```typescript
// In use-llm.ts

const handleSend = async () => {
  // ... existing code ...

  // Call LLM with streaming
  const response = await llmService.chatStream(
    character,
    dialogueMessages,
    handleChunk,
    presets,
    session.llmOptions,
    context,
    session.modelConfig
  );

  // Parse suggestions from response
  const { content, suggestions } = parseSuggestions(response.content);

  // Create assistant message WITH token tracking
  const assistantMessage = await dialogueService.createAssistantMessage(
    characterId,
    content,
    userMessage.id,
    suggestions,
    // Pass usage info from LLM response
    response.usage ? {
      providerId: response.providerId,
      model: response.model,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
    } : {
      // Even without token counts, track provider/model
      providerId: response.providerId,
      model: response.model,
    }
  );

  // ... rest of logic
};
```

### 4. Display Token Usage (Optional UI)

```tsx
// In ChatMessage component (optional enhancement)

interface ChatMessageProps {
  message: DialogueMessageWithContent;
  showMetadata?: boolean;
}

export function ChatMessage({ message, showMetadata }: ChatMessageProps) {
  return (
    <div className="chat-message">
      {/* Existing message content */}
      <div className="message-content">
        {message.content}
      </div>

      {/* Optional: Show token usage for assistant messages */}
      {showMetadata && message.role === 'assistant' && message.inputTokens && (
        <div className="message-metadata">
          <span className="token-info">
            {message.model} · {message.inputTokens}→{message.outputTokens} tokens
          </span>
        </div>
      )}
    </div>
  );
}
```

```css
/* Optional CSS for metadata */
.message-metadata {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.token-info {
  font-family: var(--font-monospace);
}
```

## Provider Token Response Formats

Different providers return tokens differently:

| Provider | Format |
|----------|--------|
| OpenAI | `usage.prompt_tokens`, `usage.completion_tokens` |
| Google | `usageMetadata.promptTokenCount`, `usageMetadata.candidatesTokenCount` |
| Anthropic | `usage.input_tokens`, `usage.output_tokens` |
| OpenRouter | Same as OpenAI |

The LlmService (Phase 5) normalizes these to a consistent format.

## Files to Modify

| File | Action |
|------|--------|
| `src/types/index.ts` | Add token fields to DialogueMessage |
| `src/services/dialogue-service.ts` | Accept usage in createAssistantMessage |
| `src/hooks/use-llm.ts` | Pass usage from LLM response |
| `src/components/ChatMessage.tsx` | Optional: display token info |
| `styles.css` | Optional: token metadata styles |

## Success Criteria

- [ ] DialogueMessage type includes token fields
- [ ] Assistant messages store providerId + model
- [ ] Token counts saved when provider returns them
- [ ] Frontmatter correctly formatted in .md files
- [ ] (Optional) UI displays token usage

## Todo

- [ ] Add token fields to DialogueMessage type
- [ ] Update DialogueService.createAssistantMessage
- [ ] Update useLLM to pass usage info
- [ ] (Optional) Add token display in UI
