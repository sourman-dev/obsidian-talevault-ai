/**
 * Multi-provider LLM types
 * Supports multiple LLM providers with different auth methods and endpoints
 */

/** Model type categories */
export type ModelType = 'text' | 'extraction' | 'image';

/** Auth header types for different providers */
export type AuthHeaderType =
  | 'bearer'
  | 'x-goog-api-key'
  | 'x-api-key'
  | 'api-key';

/**
 * LLM Provider definition
 * Stored in plugin settings, represents a configured provider instance
 */
export interface LLMProvider {
  /** Unique identifier (crypto.randomUUID) */
  id: string;
  /** Display name for UI */
  name: string;
  /** API endpoint base URL */
  baseUrl: string;
  /** API authentication key */
  apiKey: string;
  /** Default model for this provider */
  defaultModel?: string;
  /** Auth header type (copied from preset or custom) */
  authHeader?: AuthHeaderType;
  /** Reference to preset template id */
  presetId?: string;
}

/**
 * Model selection reference
 * Points to a specific provider and model combination
 */
export interface ModelReference {
  providerId: string;
  model: string;
}

/**
 * Provider preset template
 * Pre-configured settings for known providers
 */
export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  /** Endpoint for fetching available models */
  modelsEndpoint: string;
  /** Auth header type for API calls */
  authHeader: AuthHeaderType;
  /** Suggested models by type */
  suggestedModels: {
    text: string[];
    extraction: string[];
  };
}
