import type { ProviderPreset } from '../types/provider';

/**
 * Pre-configured provider templates
 * Users select a preset to auto-fill baseUrl and auth settings
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    authHeader: 'bearer',
    suggestedModels: {
      text: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'o1-mini'],
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
      text: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp'],
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
      text: [
        'anthropic/claude-3.5-sonnet',
        'google/gemini-2.0-flash-exp:free',
        'deepseek/deepseek-chat',
      ],
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

/**
 * Find preset by id
 */
export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
