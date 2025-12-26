/**
 * Provider Resolver Utility
 * Resolves which provider + model to use for a given model type
 *
 * Resolution chain:
 * 1. Character-level override (if provided)
 * 2. Global defaults
 * 3. Fallback: first provider with its defaultModel
 */

import type { MianixSettings, LLMProvider, ModelReference, AuthHeaderType } from '../types';

/** Resolved provider config ready for API call */
export interface ResolvedProvider {
  provider: LLMProvider;
  model: string;
  /** For token tracking */
  providerId: string;
}

/** Character-level model overrides */
export type ModelOverrides = Partial<Record<'text' | 'extraction' | 'image', ModelReference>>;

/**
 * Resolve provider + model for a given model type
 *
 * @param settings - Plugin settings
 * @param modelType - Type of model needed (text, extraction, image)
 * @param characterOverride - Character-level overrides
 * @returns Resolved provider or null if no providers configured
 */
export function resolveProvider(
  settings: MianixSettings,
  modelType: 'text' | 'extraction' | 'image',
  characterOverride?: ModelOverrides
): ResolvedProvider | null {
  const providers = settings.providers || [];

  if (providers.length === 0) {
    return null;
  }

  // 1. Check character override
  const override = characterOverride?.[modelType];
  if (override?.providerId) {
    const provider = providers.find((p) => p.id === override.providerId);
    if (provider) {
      return {
        provider,
        model: override.model || provider.defaultModel || '',
        providerId: provider.id,
      };
    }
  }

  // 2. Check global defaults
  const defaultRef = settings.defaults?.[modelType];
  if (defaultRef?.providerId) {
    const provider = providers.find((p) => p.id === defaultRef.providerId);
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
 * Build auth headers based on provider's auth type
 */
export function buildAuthHeaders(provider: LLMProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader: AuthHeaderType = provider.authHeader || 'bearer';

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

/**
 * Check if multi-provider system is configured
 * Returns true if providers exist and text default is set
 */
export function isMultiProviderConfigured(settings: MianixSettings): boolean {
  return (
    Array.isArray(settings.providers) &&
    settings.providers.length > 0 &&
    !!settings.defaults?.text?.providerId
  );
}
