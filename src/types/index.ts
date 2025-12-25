import type { App } from 'obsidian';

/** Plugin settings stored in data.json */
export interface MianixSettings {
  llm: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
}

/** Default settings */
export const DEFAULT_SETTINGS: MianixSettings = {
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelName: 'gpt-4-turbo',
  },
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

/** Dialogue message frontmatter */
export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  parentId: string | null;
  timestamp: string;
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
