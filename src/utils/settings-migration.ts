/**
 * Settings migration utility
 * Migrates legacy single-provider settings to multi-provider format
 */

import type { MianixSettings, LLMProviderConfig } from '../types';
import type { LLMProvider, ModelReference } from '../types/provider';
import { PROVIDER_PRESETS } from '../constants/provider-presets';

/**
 * Legacy settings format (pre-multi-provider)
 */
interface LegacySettings {
  llm?: LLMProviderConfig;
  extractionModel?: LLMProviderConfig;
  enableMemoryExtraction?: boolean;
  enableStats?: boolean;
  enableNPCExtraction?: boolean;
  lorebookScanDepth?: number;
}

/**
 * Detect provider preset from baseUrl
 */
function detectPresetFromUrl(baseUrl: string): {
  name: string;
  presetId?: string;
  authHeader?: string;
} {
  const normalizedUrl = baseUrl.toLowerCase();

  for (const preset of PROVIDER_PRESETS) {
    if (preset.baseUrl && normalizedUrl.includes(new URL(preset.baseUrl).host)) {
      return {
        name: preset.name,
        presetId: preset.id,
        authHeader: preset.authHeader,
      };
    }
  }

  // Custom provider detection by common patterns
  if (normalizedUrl.includes('openai.com')) {
    return { name: 'OpenAI', presetId: 'openai', authHeader: 'bearer' };
  }
  if (normalizedUrl.includes('googleapis.com') || normalizedUrl.includes('generativelanguage')) {
    return { name: 'Google AI', presetId: 'google', authHeader: 'x-goog-api-key' };
  }
  if (normalizedUrl.includes('openrouter.ai')) {
    return { name: 'OpenRouter', presetId: 'openrouter', authHeader: 'bearer' };
  }
  if (normalizedUrl.includes('groq.com')) {
    return { name: 'Groq', presetId: 'groq', authHeader: 'bearer' };
  }

  return { name: 'Custom Provider', authHeader: 'bearer' };
}

/**
 * Check if settings are already in new format
 */
function isNewFormat(settings: unknown): settings is MianixSettings {
  if (!settings || typeof settings !== 'object') return false;
  const s = settings as Record<string, unknown>;
  return Array.isArray(s.providers) && s.providers.length > 0;
}

/**
 * Migrate legacy settings to new multi-provider format
 * Preserves existing API keys and configurations
 */
export function migrateSettings(data: unknown): MianixSettings {
  // Handle empty/null data
  if (!data || typeof data !== 'object') {
    return getDefaultSettings();
  }

  // Already migrated - return as-is with defaults merged
  if (isNewFormat(data)) {
    return mergeWithDefaults(data as MianixSettings);
  }

  const old = data as LegacySettings;
  const providers: LLMProvider[] = [];
  let textDefault: ModelReference = { providerId: '', model: '' };
  let extractionDefault: ModelReference | undefined;

  // Migrate main LLM provider
  if (old.llm?.apiKey && old.llm?.baseUrl) {
    const detected = detectPresetFromUrl(old.llm.baseUrl);
    const mainProvider: LLMProvider = {
      id: crypto.randomUUID(),
      name: detected.name,
      baseUrl: old.llm.baseUrl,
      apiKey: old.llm.apiKey,
      defaultModel: old.llm.modelName,
      authHeader: detected.authHeader as LLMProvider['authHeader'],
      presetId: detected.presetId,
    };
    providers.push(mainProvider);
    textDefault = { providerId: mainProvider.id, model: old.llm.modelName };

    // Migrate extraction model
    if (old.extractionModel?.modelName) {
      const isSameProvider =
        !old.extractionModel.apiKey ||
        old.extractionModel.baseUrl === old.llm.baseUrl;

      if (isSameProvider) {
        // Same provider, different model
        extractionDefault = {
          providerId: mainProvider.id,
          model: old.extractionModel.modelName,
        };
      } else if (old.extractionModel.apiKey && old.extractionModel.baseUrl) {
        // Different provider
        const extractDetected = detectPresetFromUrl(old.extractionModel.baseUrl);
        const extractProvider: LLMProvider = {
          id: crypto.randomUUID(),
          name: `${extractDetected.name} (Extraction)`,
          baseUrl: old.extractionModel.baseUrl,
          apiKey: old.extractionModel.apiKey,
          defaultModel: old.extractionModel.modelName,
          authHeader: extractDetected.authHeader as LLMProvider['authHeader'],
          presetId: extractDetected.presetId,
        };
        providers.push(extractProvider);
        extractionDefault = {
          providerId: extractProvider.id,
          model: old.extractionModel.modelName,
        };
      }
    }
  }

  // Build migrated settings
  const migrated: MianixSettings = {
    providers,
    defaults: {
      text: textDefault,
      extraction: extractionDefault,
    },
    enableMemoryExtraction: old.enableMemoryExtraction ?? false,
    enableStats: old.enableStats ?? false,
    enableNPCExtraction: old.enableNPCExtraction ?? false,
    lorebookScanDepth: old.lorebookScanDepth ?? 5,
    // Keep legacy fields for backward compatibility with existing code
    llm: old.llm ?? {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4-turbo',
    },
    extractionModel: old.extractionModel,
  };

  return migrated;
}

/**
 * Get default settings for new installations
 */
export function getDefaultSettings(): MianixSettings {
  return {
    providers: [],
    defaults: {
      text: { providerId: '', model: '' },
    },
    enableMemoryExtraction: false,
    enableStats: false,
    enableNPCExtraction: false,
    lorebookScanDepth: 5,
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4-turbo',
    },
    extractionModel: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4o-mini',
    },
  };
}

/**
 * Merge settings with defaults
 */
function mergeWithDefaults(settings: MianixSettings): MianixSettings {
  const defaults = getDefaultSettings();
  return {
    ...defaults,
    ...settings,
    defaults: {
      text: settings.defaults?.text ?? defaults.defaults!.text,
      extraction: settings.defaults?.extraction,
      image: settings.defaults?.image,
    },
  };
}
