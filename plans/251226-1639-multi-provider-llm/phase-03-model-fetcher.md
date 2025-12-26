---
phase: 3
title: "Model Fetcher Service"
status: pending
effort: 1.5h
depends: [phase-01]
---

# Phase 3: Model Fetcher Service

## Context

- Parent: [plan.md](./plan.md)
- Depends: [Phase 1](./phase-01-provider-types.md)
- Research: [Provider APIs](./research/researcher-01-llm-provider-apis.md)

## Overview

Service để fetch available models từ provider API với caching.

## Requirements

1. Fetch models từ `/models` endpoint
2. Handle different auth headers per provider
3. Cache results với TTL (5 minutes)
4. Manual refresh capability
5. Error handling cho network failures

## Implementation

### 1. Model Fetcher Service (`src/services/model-fetcher.ts`)

```typescript
import type { LLMProvider } from '../types/provider';
import { PROVIDER_PRESETS } from '../constants/provider-presets';

interface FetchedModel {
  id: string;
  name?: string;
  created?: number;
}

interface CacheEntry {
  models: FetchedModel[];
  fetchedAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const modelCache = new Map<string, CacheEntry>();

export class ModelFetcherService {
  /**
   * Fetch models from provider API
   * @param provider - Provider config
   * @param forceRefresh - Bypass cache
   */
  async fetchModels(
    provider: LLMProvider,
    forceRefresh = false
  ): Promise<FetchedModel[]> {
    const cacheKey = `${provider.baseUrl}-${provider.apiKey.slice(-4)}`;

    // Check cache
    if (!forceRefresh) {
      const cached = modelCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.models;
      }
    }

    // Determine endpoint and headers
    const preset = PROVIDER_PRESETS.find((p) => p.id === provider.presetId);
    const endpoint = preset?.modelsEndpoint || '/models';
    const authHeader = preset?.authHeader || 'bearer';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Set auth header based on provider type
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

    try {
      const response = await fetch(`${provider.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const models = this.parseModels(data, provider.presetId);

      // Cache results
      modelCache.set(cacheKey, { models, fetchedAt: Date.now() });

      return models;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  /**
   * Parse models from different API response formats
   */
  private parseModels(data: any, presetId?: string): FetchedModel[] {
    // Google AI format: { models: [...] }
    if (presetId === 'google' && data.models) {
      return data.models.map((m: any) => ({
        id: m.name?.replace('models/', '') || m.id,
        name: m.displayName || m.name,
      }));
    }

    // OpenAI/OpenRouter format: { data: [...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        created: m.created,
      }));
    }

    // Direct array format
    if (Array.isArray(data)) {
      return data.map((m: any) => ({
        id: m.id || m.name,
        name: m.name || m.id,
      }));
    }

    return [];
  }

  /**
   * Clear cache for a provider
   */
  clearCache(provider: LLMProvider): void {
    const cacheKey = `${provider.baseUrl}-${provider.apiKey.slice(-4)}`;
    modelCache.delete(cacheKey);
  }

  /**
   * Clear all cached models
   */
  clearAllCache(): void {
    modelCache.clear();
  }
}

// Singleton instance
export const modelFetcher = new ModelFetcherService();
```

### 2. Usage in Settings Tab

```typescript
// When provider is selected/configured
const models = await modelFetcher.fetchModels(provider);
// Populate dropdown with models

// Manual refresh button
await modelFetcher.fetchModels(provider, true);
```

## Files to Create

| File | Action |
|------|--------|
| `src/services/model-fetcher.ts` | Create |

## Success Criteria

- [ ] Fetches models from OpenAI-compatible APIs
- [ ] Handles Google's different response format
- [ ] Caches results for 5 minutes
- [ ] Manual refresh works
- [ ] Graceful error handling

## Todo

- [ ] Create ModelFetcherService
- [ ] Handle different auth headers
- [ ] Parse different response formats
- [ ] Implement caching
- [ ] Add manual refresh function
