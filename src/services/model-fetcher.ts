/**
 * Model Fetcher Service
 * Fetches available models from LLM provider APIs with caching
 */

import type { LLMProvider, AuthHeaderType } from '../types/provider';
import { PROVIDER_PRESETS } from '../constants/provider-presets';

/** Fetched model from provider API */
export interface FetchedModel {
  id: string;
  name?: string;
  created?: number;
}

/** Cache entry with timestamp */
interface CacheEntry {
  models: FetchedModel[];
  fetchedAt: number;
}

/** Cache TTL: 30 minutes (model lists rarely change) */
const CACHE_TTL = 30 * 60 * 1000;

/** In-memory model cache keyed by provider */
const modelCache = new Map<string, CacheEntry>();

/**
 * Build auth headers based on provider auth type
 */
function buildAuthHeaders(
  apiKey: string,
  authHeader: AuthHeaderType = 'bearer'
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (authHeader) {
    case 'x-goog-api-key':
      headers['x-goog-api-key'] = apiKey;
      break;
    case 'x-api-key':
      headers['x-api-key'] = apiKey;
      break;
    case 'api-key':
      headers['api-key'] = apiKey;
      break;
    default:
      headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Parse models from OpenAI-compatible API response
 * Format: { data: [{ id, name?, created? }] }
 */
function parseOpenAIModels(data: unknown): FetchedModel[] {
  if (!data || typeof data !== 'object') return [];

  const response = data as Record<string, unknown>;
  if (!response.data || !Array.isArray(response.data)) return [];

  return response.data.map((m: Record<string, unknown>) => ({
    id: String(m.id || ''),
    name: m.name ? String(m.name) : undefined,
    created: typeof m.created === 'number' ? m.created : undefined,
  }));
}

/**
 * Parse models from Google AI API response
 * Format: { models: [{ name, displayName }] }
 */
function parseGoogleModels(data: unknown): FetchedModel[] {
  if (!data || typeof data !== 'object') return [];

  const response = data as Record<string, unknown>;
  if (!response.models || !Array.isArray(response.models)) return [];

  return response.models.map((m: Record<string, unknown>) => {
    const fullName = String(m.name || '');
    // Remove "models/" prefix from Google model names
    const id = fullName.replace(/^models\//, '');
    return {
      id,
      name: m.displayName ? String(m.displayName) : id,
    };
  });
}

/**
 * Parse models from direct array response
 * Format: [{ id, name }]
 */
function parseArrayModels(data: unknown): FetchedModel[] {
  if (!Array.isArray(data)) return [];

  return data.map((m: Record<string, unknown>) => ({
    id: String(m.id || m.name || ''),
    name: m.name ? String(m.name) : undefined,
  }));
}

/**
 * Model Fetcher Service
 * Singleton service for fetching and caching provider models
 */
export class ModelFetcherService {
  /**
   * Generate cache key from provider config
   * Uses last 4 chars of API key to differentiate same-URL providers
   */
  private getCacheKey(provider: LLMProvider): string {
    const keySuffix = provider.apiKey?.slice(-4) || 'nokey';
    return `${provider.baseUrl}-${keySuffix}`;
  }

  /**
   * Get auth header type from provider or preset
   */
  private getAuthHeader(provider: LLMProvider): AuthHeaderType {
    // Use provider's stored authHeader if available
    if (provider.authHeader) {
      return provider.authHeader;
    }

    // Fallback to preset lookup
    if (provider.presetId) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === provider.presetId);
      if (preset) {
        return preset.authHeader;
      }
    }

    return 'bearer';
  }

  /**
   * Get models endpoint from provider or preset
   */
  private getModelsEndpoint(provider: LLMProvider): string {
    if (provider.presetId) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === provider.presetId);
      if (preset) {
        return preset.modelsEndpoint;
      }
    }

    return '/models';
  }

  /**
   * Parse models based on provider type
   */
  private parseModels(data: unknown, presetId?: string): FetchedModel[] {
    // Google AI has different response format
    if (presetId === 'google') {
      return parseGoogleModels(data);
    }

    // Try OpenAI format first (most common)
    const openaiModels = parseOpenAIModels(data);
    if (openaiModels.length > 0) {
      return openaiModels;
    }

    // Fallback to array format
    return parseArrayModels(data);
  }

  /**
   * Fetch models from provider API
   * @param provider - Provider configuration
   * @param forceRefresh - Bypass cache and fetch fresh data
   * @returns Array of available models
   */
  async fetchModels(
    provider: LLMProvider,
    forceRefresh = false
  ): Promise<FetchedModel[]> {
    // Validate required fields
    if (!provider.baseUrl || !provider.apiKey) {
      console.warn('Model fetch skipped: missing baseUrl or apiKey');
      return [];
    }

    const cacheKey = this.getCacheKey(provider);

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = modelCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.models;
      }
    }

    const authHeader = this.getAuthHeader(provider);
    const endpoint = this.getModelsEndpoint(provider);
    const url = `${provider.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(provider.apiKey, authHeader),
      });

      if (!response.ok) {
        console.error(`Model fetch failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const models = this.parseModels(data, provider.presetId);

      // Cache results
      modelCache.set(cacheKey, {
        models,
        fetchedAt: Date.now(),
      });

      return models;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  /**
   * Clear cache for a specific provider
   */
  clearCache(provider: LLMProvider): void {
    const cacheKey = this.getCacheKey(provider);
    modelCache.delete(cacheKey);
  }

  /**
   * Clear all cached models
   */
  clearAllCache(): void {
    modelCache.clear();
  }

  /**
   * Get cached models without fetching
   * Returns null if not cached or expired
   */
  getCached(provider: LLMProvider): FetchedModel[] | null {
    const cacheKey = this.getCacheKey(provider);
    const cached = modelCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.models;
    }

    return null;
  }
}

/** Singleton instance */
export const modelFetcher = new ModelFetcherService();
