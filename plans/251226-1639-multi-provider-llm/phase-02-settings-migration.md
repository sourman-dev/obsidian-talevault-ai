---
phase: 2
title: "Settings Migration & Storage"
status: pending
effort: 1.5h
depends: [phase-01]
---

# Phase 2: Settings Migration & Storage

## Context

- Parent: [plan.md](./plan.md)
- Depends: [Phase 1](./phase-01-provider-types.md)

## Overview

Migrate existing settings format sang new multi-provider format với backward compatibility.

## Requirements

1. Detect old settings format và migrate
2. Preserve existing API keys
3. Create default provider from old config
4. Update DEFAULT_SETTINGS

## Current Settings Format

```typescript
{
  llm: { baseUrl, apiKey, modelName },
  extractionModel?: { baseUrl, apiKey, modelName },
  enableMemoryExtraction: boolean
}
```

## New Settings Format

```typescript
{
  providers: [
    { id, name, baseUrl, apiKey, type: 'custom' }
  ],
  defaults: {
    text: { providerId, model },
    extraction?: { providerId, model }
  },
  enableMemoryExtraction: boolean
}
```

## Implementation

### 1. Migration Function (`src/utils/settings-migration.ts`)

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { MianixSettings, LLMProviderConfig } from '../types';
import type { LLMProvider, ModelSelection } from '../types/provider';

interface LegacySettings {
  llm?: LLMProviderConfig;
  extractionModel?: LLMProviderConfig;
  enableMemoryExtraction?: boolean;
}

export function migrateSettings(old: LegacySettings): MianixSettings {
  // Already migrated?
  if ('providers' in old && Array.isArray((old as any).providers)) {
    return old as MianixSettings;
  }

  const providers: LLMProvider[] = [];
  let textDefault: ModelSelection | undefined;
  let extractionDefault: ModelSelection | undefined;

  // Migrate main LLM
  if (old.llm?.apiKey) {
    const mainProvider: LLMProvider = {
      id: uuidv4(),
      name: detectProviderName(old.llm.baseUrl),
      baseUrl: old.llm.baseUrl,
      apiKey: old.llm.apiKey,
      type: 'custom',
    };
    providers.push(mainProvider);
    textDefault = { providerId: mainProvider.id, model: old.llm.modelName };
  }

  // Migrate extraction model (if different)
  if (old.extractionModel?.apiKey && old.extractionModel.baseUrl !== old.llm?.baseUrl) {
    const extractProvider: LLMProvider = {
      id: uuidv4(),
      name: `${detectProviderName(old.extractionModel.baseUrl)} (Extraction)`,
      baseUrl: old.extractionModel.baseUrl,
      apiKey: old.extractionModel.apiKey,
      type: 'custom',
    };
    providers.push(extractProvider);
    extractionDefault = {
      providerId: extractProvider.id,
      model: old.extractionModel.modelName,
    };
  } else if (old.extractionModel && textDefault) {
    // Same provider, different model
    extractionDefault = {
      providerId: textDefault.providerId,
      model: old.extractionModel.modelName,
    };
  }

  return {
    providers,
    defaults: {
      text: textDefault || { providerId: '', model: '' },
      extraction: extractionDefault,
    },
    enableMemoryExtraction: old.enableMemoryExtraction || false,
  };
}

function detectProviderName(baseUrl: string): string {
  if (baseUrl.includes('openai.com')) return 'OpenAI';
  if (baseUrl.includes('googleapis.com')) return 'Google AI';
  if (baseUrl.includes('openrouter.ai')) return 'OpenRouter';
  if (baseUrl.includes('groq.com')) return 'Groq';
  return 'Custom Provider';
}
```

### 2. Updated Default Settings

```typescript
export const DEFAULT_SETTINGS: MianixSettings = {
  providers: [],
  defaults: {
    text: { providerId: '', model: '' },
  },
  enableMemoryExtraction: false,
};
```

### 3. Update Plugin Load (`src/main.ts`)

```typescript
async loadSettings() {
  const data = await this.loadData();
  const migrated = migrateSettings(data || {});
  this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/utils/settings-migration.ts` | Create |
| `src/types/index.ts` | Update DEFAULT_SETTINGS |
| `src/main.ts` | Update loadSettings() |

## Success Criteria

- [ ] Old settings auto-migrate on load
- [ ] API keys preserved
- [ ] New users get empty providers list
- [ ] No data loss during migration

## Todo

- [ ] Create migration utility
- [ ] Update DEFAULT_SETTINGS
- [ ] Modify loadSettings() in main.ts
- [ ] Test migration with existing data
