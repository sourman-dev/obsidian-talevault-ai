---
phase: 1
title: "Type Definitions & Provider Presets"
status: completed
effort: 1h
completed: 2025-12-26
review: plans/reports/code-reviewer-251226-1927-multi-provider-phase1.md
---

# Phase 1: Type Definitions & Provider Presets

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: None (first phase)

## Overview

Define TypeScript types cho multi-provider system và preset configurations.

## Requirements

1. Provider type với id, name, baseUrl, apiKey
2. Model selection type cho text/extraction/image
3. Preset templates cho known providers
4. Backward-compatible với existing settings

## Implementation

### 1. New Types (`src/types/provider.ts`)

```typescript
/** Model type categories */
export type ModelType = 'text' | 'extraction' | 'image';

/** Auth header types for different providers */
export type AuthHeaderType =
  | 'bearer'
  | 'x-goog-api-key'
  | 'x-api-key'
  | 'api-key';

/** LLM Provider definition */
export interface LLMProvider {
  id: string;                    // UUID (crypto.randomUUID)
  name: string;                  // Display name
  baseUrl: string;               // API endpoint
  apiKey: string;                // Auth key
  defaultModel?: string;         // Default model for this provider
  authHeader?: AuthHeaderType;   // Auth header type (from preset or custom)
  presetId?: string;             // Reference to preset template
  // Note: Removed 'type' field - use presetId presence to determine preset vs custom
}

/** Model reference pointing to a specific provider+model */
export interface ModelReference {
  providerId: string;
  model: string;
}

/** Provider preset template */
export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  modelsEndpoint: string;  // e.g., "/models" or "/v1beta/models"
  authHeader: 'bearer' | 'x-goog-api-key' | 'x-api-key' | 'api-key';
  suggestedModels: {
    text: string[];
    extraction: string[];
  };
}
```

### 2. Provider Presets (`src/constants/provider-presets.ts`)

```typescript
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    suggestedModels: {
      text: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'],
      extraction: ['gpt-4o-mini'],
    },
  },
  {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    authHeader: 'x-goog-api-key',
    suggestedModels: {
      text: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
      extraction: ['gemini-2.0-flash-exp'],
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    suggestedModels: {
      text: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp:free'],
      extraction: ['google/gemini-2.0-flash-exp:free'],
    },
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    suggestedModels: {
      text: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
      extraction: ['llama-3.1-8b-instant'],
    },
  },
  {
    id: 'custom',
    name: 'OpenAI Compatible',
    baseUrl: '',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    suggestedModels: { text: [], extraction: [] },
  },
];
```

### 3. Updated Settings Types (`src/types/index.ts`)

```typescript
import type { LLMProvider, ModelReference } from './provider';

/** Plugin settings - NEW structure */
export interface MianixSettings {
  // === New multi-provider system ===
  providers?: LLMProvider[];  // Optional for backward compat
  defaults?: {
    text: ModelReference;
    extraction?: ModelReference;
    image?: ModelReference;
  };

  // === Feature toggles ===
  enableMemoryExtraction: boolean;

  // === Legacy fields (kept until Phase 2 migration) ===
  llm: LLMProviderConfig;              // Required for existing code
  extractionModel?: LLMProviderConfig; // Optional legacy field
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/provider.ts` | Create |
| `src/constants/provider-presets.ts` | Create |
| `src/types/index.ts` | Modify |

## Success Criteria

- [x] All types compile without errors ✅
- [x] Presets cover 5 providers ✅ (OpenAI, Google, OpenRouter, Groq, Custom)
- [x] Types support backward compatibility ✅

## Todo

- [x] Create `src/types/provider.ts` ✅
- [x] Create `src/constants/provider-presets.ts` ✅
- [x] Update `src/types/index.ts` with new MianixSettings ✅
- [x] Export types from `src/types/index.ts` ✅

## Implementation Notes

**Changes from spec:**
1. Renamed `ModelSelection` → `ModelReference` (clearer semantics)
2. Removed `type: 'preset' | 'custom'` field (redundant - use `presetId` presence)
3. Added `defaultModel?: string` to `LLMProvider` (useful for UI)
4. Added `authHeader?: AuthHeaderType` to `LLMProvider` (copied from preset)

**Rationale:**
- DRY compliance: No duplicate state tracking
- KISS: Simpler type structure
- Better naming: "Reference" is clearer than "Selection"
- Future-ready: `defaultModel` enables better UX in Phase 4

**Review:** See [code-reviewer-251226-1927-multi-provider-phase1.md](../reports/code-reviewer-251226-1927-multi-provider-phase1.md)
