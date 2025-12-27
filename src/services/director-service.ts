/**
 * Director Service - First agent in Director-Narrator system
 * Decides WHAT happens in the story (action-only, no internal thoughts)
 */

import type {
  MianixSettings,
  CharacterCardWithPath,
  DialogueMessageWithContent,
} from '../types';
import type { LLMContext, LoadedPresets } from './llm-service';
import {
  resolveProvider,
  buildAuthHeaders,
  isMultiProviderConfigured,
} from '../utils/provider-resolver';

/** Director output - scene instructions for Narrator */
export interface DirectorOutput {
  /** Raw scene instructions text */
  instructions: string;
  /** Token usage (if available) */
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * DirectorService generates scene instructions (WHAT happens)
 * Output is then filtered by POV mode before passing to Narrator
 */
export class DirectorService {
  constructor(private settings: MianixSettings) {}

  /**
   * Build Director system prompt
   * Director is omniscient but outputs only observable actions
   */
  buildDirectorSystemPrompt(
    character: CharacterCardWithPath,
    presets: LoadedPresets,
    context?: LLMContext
  ): string {
    const parts: string[] = [];

    // Director identity and rules
    parts.push(presets.directorPrompt || this.getDefaultDirectorPrompt());

    // World context (Director sees everything)
    if (context?.lorebookContext) {
      parts.push('\n\n---\n## World Information\n');
      parts.push(context.lorebookContext);
    }

    // All character info (omniscient view)
    parts.push('\n\n---\n## Characters\n');
    parts.push(`**${character.name}:** ${character.description || ''}`);
    if (character.personality) {
      parts.push(`\nPersonality: ${character.personality}`);
    }

    // Memories (Director has full access)
    if (context?.relevantMemories) {
      parts.push('\n\n---\n## Story Context\n');
      parts.push(context.relevantMemories);
    }

    return parts.join('');
  }

  /**
   * Build Director user prompt with recent history
   */
  buildDirectorUserPrompt(
    character: CharacterCardWithPath,
    messages: DialogueMessageWithContent[]
  ): string {
    const parts: string[] = [];

    // Recent conversation context
    if (messages.length > 0) {
      parts.push('## Recent Events\n');
      const recentMessages = messages.slice(-10); // Last 10 for context
      for (const msg of recentMessages) {
        const speaker = msg.role === 'user' ? 'User' : character.name;
        parts.push(`**${speaker}:** ${msg.content}\n`);
      }
    }

    parts.push('\n---\n## Direction Request\n');
    parts.push('Describe what happens next in this scene. Focus on:');
    parts.push('\n- Physical actions and movements');
    parts.push('\n- Dialogue spoken aloud');
    parts.push('\n- Environmental details and events');
    parts.push('\n\n**Keep it concise (50-100 words). No internal thoughts.**');

    return parts.join('');
  }

  /**
   * Generate scene instructions (non-streaming, internal use)
   * Returns action-only scene description for Narrator
   */
  async generateSceneInstructions(
    character: CharacterCardWithPath,
    messages: DialogueMessageWithContent[],
    presets: LoadedPresets,
    context?: LLMContext
  ): Promise<DirectorOutput> {
    const resolved = this.getProvider();

    const systemPrompt = this.buildDirectorSystemPrompt(character, presets, context);
    const userPrompt = this.buildDirectorUserPrompt(character, messages);

    const response = await fetch(`${resolved.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAuthHeaders(resolved.provider),
      body: JSON.stringify({
        model: resolved.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.7, // Slightly lower for consistency
        max_tokens: 200, // Concise output
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Director API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      instructions: data.choices[0]?.message?.content || '',
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    };
  }

  /**
   * Get text provider (uses same as main LLM)
   */
  private getProvider() {
    if (isMultiProviderConfigured(this.settings)) {
      const resolved = resolveProvider(this.settings, 'text');
      if (resolved) return resolved;
    }

    // Fallback to legacy
    const { baseUrl, apiKey, modelName } = this.settings.llm;
    if (!apiKey) {
      throw new Error('No LLM provider configured');
    }

    return {
      provider: {
        id: 'legacy',
        name: 'Legacy Provider',
        baseUrl,
        apiKey,
        defaultModel: modelName,
      },
      model: modelName,
      providerId: 'legacy',
    };
  }

  /**
   * Default Director prompt (used if preset file missing)
   */
  private getDefaultDirectorPrompt(): string {
    return `## Role: Story Director
You are an omniscient director who knows everything about all characters.
Your job is to decide WHAT HAPPENS, not how it's described.

## Output Format
Describe the scene in terms of:
- Physical actions characters take
- Dialogue spoken aloud
- Events that occur (sounds, environment, sensory details)

## CRITICAL RULES
1. NEVER write internal thoughts of any character
2. NEVER reveal hidden motivations or secrets
3. Only describe OBSERVABLE actions
4. Keep descriptions concise (50-100 words max)`;
  }
}
