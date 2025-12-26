import type { App } from 'obsidian';

// Re-export provider types for convenience
export type {
  ModelType,
  AuthHeaderType,
  LLMProvider,
  ModelReference,
  ProviderPreset,
} from './provider';

/**
 * Legacy LLM provider configuration
 * @deprecated Use LLMProvider instead - kept for migration
 */
export interface LLMProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

// Import new types
import type { LLMProvider, ModelReference } from './provider';

/**
 * Plugin settings stored in data.json
 * Supports both legacy and new multi-provider format
 */
export interface MianixSettings {
  // === New multi-provider system ===
  /** Configured LLM providers */
  providers?: LLMProvider[];
  /** Default model selections by type */
  defaults?: {
    text: ModelReference;
    extraction?: ModelReference;
    image?: ModelReference;
  };

  // === Feature toggles ===
  /** Enable memory extraction after each response */
  enableMemoryExtraction: boolean;

  // === Legacy fields (kept for backward compatibility until Phase 2 migration) ===
  /** Main LLM config - will be migrated to providers[] in Phase 2 */
  llm: LLMProviderConfig;
  /** Extraction model config - will be migrated to defaults.extraction in Phase 2 */
  extractionModel?: LLMProviderConfig;
}

/** Default settings - imported from migration utility */
export { getDefaultSettings } from '../utils/settings-migration';

/** Default settings constant for backward compatibility */
export const DEFAULT_SETTINGS: MianixSettings = {
  providers: [],
  defaults: {
    text: { providerId: '', model: '' },
  },
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
  enableMemoryExtraction: false,
};

/** Character card frontmatter */
export interface CharacterCard {
  id: string;
  name: string;
  avatar?: string; // Relative path to avatar image (e.g., "avatar.png")
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  createdAt: string;
}

/** Character card with file path info */
export interface CharacterCardWithPath extends CharacterCard {
  folderPath: string;
  filePath: string;
  avatarUrl?: string; // Data URL or vault resource URL for avatar
}

/** Form data for creating/editing characters */
export interface CharacterFormData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
}

/** LLM options per session */
export interface LLMOptions {
  temperature: number;
  topP: number;
  responseLength: number; // Target word count in response (used in prompt)
}

/** Dialogue session metadata (stored in session.json) */
export interface DialogueSession {
  id: string;
  characterId: string;
  createdAt: string;
  llmOptions: LLMOptions;
}

/** Token usage info for assistant messages */
export interface MessageTokenUsage {
  providerId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Dialogue message frontmatter */
export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  parentId: string | null;
  timestamp: string;
  /** Suggested prompts extracted from assistant response */
  suggestions?: string[];
  /** Token tracking (assistant messages only) */
  providerId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Dialogue message with content */
export interface DialogueMessageWithContent extends DialogueMessage {
  content: string;
  filePath: string;
}

/** App context for React components */
export interface AppContextType {
  app: App;
  settings: MianixSettings;
  saveSettings: () => Promise<void>;
}
