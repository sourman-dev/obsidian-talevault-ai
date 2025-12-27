import type { LLMOptions } from '../types';

/** Default LLM options (matching mianix-userscript defaults) */
export const DEFAULT_LLM_OPTIONS: LLMOptions = {
  temperature: 0.8,
  topP: 0.9,
  responseLength: 800, // Target word count in response (used in prompt)
};

/** Preset file names */
export const PRESET_FILES = {
  MULTI_MODE: 'multi-mode-prompt.md',
  CHAIN_OF_THOUGHT: 'chain-of-thought-prompt.md',
  OUTPUT_STRUCTURE: 'output-structure-prompt.md',
  OUTPUT_FORMAT: 'output-format-prompt.md',
} as const;

export type PresetFileName = (typeof PRESET_FILES)[keyof typeof PRESET_FILES];
