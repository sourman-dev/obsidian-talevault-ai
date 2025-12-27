/**
 * NPC Extraction Service
 * Extracts NPCs from character descriptions using LLM
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import type { MianixSettings } from '../types';
import type { NPCCharacter, NPCRole } from '../types/stats';
import {
  resolveProvider,
  buildAuthHeaders,
  isMultiProviderConfigured,
} from '../utils/provider-resolver';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

/** NPC extraction prompt */
const NPC_EXTRACTION_PROMPT = `Analyze this character description and extract any named NPCs (Non-Player Characters) mentioned.

Character Description:
{description}

For each NPC found, provide:
1. Name - exact name as mentioned
2. Role - one of: ally, enemy, neutral, unknown
3. Brief description (1-2 sentences max)
4. Relationship to main character
5. Any stats mentioned (strength, dexterity, constitution, intelligence, wisdom, charisma)

Return ONLY a JSON array, no explanation:
[{"name": "...", "role": "...", "description": "...", "relationship": "...", "stats": {...}}]

If no NPCs found, return: []`;

/** LLM response structure for NPC */
interface ExtractedNPC {
  name: string;
  role: string;
  description: string;
  relationship?: string;
  stats?: Record<string, number>;
}

export class NPCExtractionService {
  constructor(
    private app: App,
    private settings: MianixSettings
  ) {}

  /**
   * Extract NPCs from character description using LLM
   * @param characterDescription Full character description text
   * @param characterId Parent character's ID for linking
   * @returns Array of extracted NPCs (max 10)
   */
  async extractNPCs(
    characterDescription: string,
    characterId: string
  ): Promise<NPCCharacter[]> {
    if (!characterDescription.trim()) {
      return [];
    }

    // Sanitize input to prevent prompt injection
    const sanitizedDescription = this.sanitizePromptInput(characterDescription);
    const prompt = NPC_EXTRACTION_PROMPT.replace('{description}', sanitizedDescription);

    try {
      const response = await this.callExtractionLLM(prompt);
      const extracted = this.parseExtractionResponse(response);

      // Convert to NPCCharacter, limit to 10
      return extracted.slice(0, 10).map((npc) => ({
        id: uuidv4(),
        name: this.sanitizeName(npc.name),
        role: this.validateRole(npc.role),
        description: npc.description || '',
        relationship: npc.relationship,
        stats: this.validateStats(npc.stats),
        extractedFrom: characterId,
        createdAt: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('NPC extraction failed:', e);
      return [];
    }
  }

  /**
   * Save extracted NPCs to character folder
   * Creates {character}/characters/{npc-slug}.md files
   */
  async saveNPCs(
    characterFolderPath: string,
    npcs: NPCCharacter[]
  ): Promise<void> {
    const npcsFolder = normalizePath(`${characterFolderPath}/characters`);
    await this.ensureFolderExists(npcsFolder);

    for (const npc of npcs) {
      const slug = this.slugify(npc.name);
      const filePath = normalizePath(`${npcsFolder}/${slug}.md`);

      // Build frontmatter
      const frontmatter = {
        id: npc.id,
        name: npc.name,
        role: npc.role,
        extractedFrom: npc.extractedFrom,
        createdAt: npc.createdAt,
      };

      // Build body content
      const bodyParts: string[] = [];

      bodyParts.push('## Description\n');
      bodyParts.push(npc.description || 'No description available.');

      if (npc.stats && Object.keys(npc.stats).length > 0) {
        bodyParts.push('\n\n## Stats\n');
        for (const [stat, value] of Object.entries(npc.stats)) {
          const capitalizedStat = stat.charAt(0).toUpperCase() + stat.slice(1);
          bodyParts.push(`- ${capitalizedStat}: ${value}`);
        }
      }

      if (npc.relationship) {
        bodyParts.push('\n\n## Relationship\n');
        bodyParts.push(npc.relationship);
      }

      const content = stringifyFrontmatter(frontmatter, bodyParts.join('\n'));

      // Create or update file
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    }
  }

  /**
   * Load all NPCs for a character
   */
  async loadNPCs(characterFolderPath: string): Promise<NPCCharacter[]> {
    const npcsFolder = normalizePath(`${characterFolderPath}/characters`);
    const folder = this.app.vault.getAbstractFileByPath(npcsFolder);

    if (!(folder instanceof TFolder)) {
      return [];
    }

    const npcs: NPCCharacter[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        try {
          const content = await this.app.vault.read(child);
          const { data } = parseFrontmatter<{
            id: string;
            name: string;
            role: NPCRole;
            extractedFrom: string;
            createdAt: string;
          }>(content);

          // Extract body content
          const bodyMatch = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
          const body = bodyMatch ? bodyMatch[1] : '';

          // Parse description section
          const descMatch = body.match(/## Description\s*\n([\s\S]*?)(?=\n##|$)/);
          const description = descMatch ? descMatch[1].trim() : '';

          // Parse relationship section
          const relMatch = body.match(/## Relationship\s*\n([\s\S]*?)(?=\n##|$)/);
          const relationship = relMatch ? relMatch[1].trim() : undefined;

          // Parse stats section
          const statsMatch = body.match(/## Stats\s*\n([\s\S]*?)(?=\n##|$)/);
          let stats: Partial<Record<string, number>> | undefined;
          if (statsMatch) {
            stats = {};
            const statLines = statsMatch[1].matchAll(/- (\w+): (\d+)/g);
            for (const match of statLines) {
              stats[match[1].toLowerCase()] = parseInt(match[2], 10);
            }
          }

          npcs.push({
            id: data.id,
            name: data.name,
            role: data.role,
            description,
            relationship,
            stats,
            extractedFrom: data.extractedFrom,
            createdAt: data.createdAt,
          });
        } catch (e) {
          console.error(`Failed to load NPC from ${child.path}:`, e);
        }
      }
    }

    return npcs;
  }

  /**
   * Delete an NPC file
   */
  async deleteNPC(characterFolderPath: string, npcId: string): Promise<boolean> {
    const npcs = await this.loadNPCs(characterFolderPath);
    const npc = npcs.find((n) => n.id === npcId);

    if (!npc) {
      return false;
    }

    const slug = this.slugify(npc.name);
    const filePath = normalizePath(`${characterFolderPath}/characters/${slug}.md`);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      await this.app.vault.trash(file, true);
      return true;
    }

    return false;
  }

  /**
   * Call extraction LLM (uses extraction model or falls back to text model)
   */
  private async callExtractionLLM(prompt: string): Promise<string> {
    // Try new multi-provider system first
    if (isMultiProviderConfigured(this.settings)) {
      const resolved = resolveProvider(this.settings, 'extraction');
      if (resolved) {
        return this.callOpenAICompatible(
          resolved.provider.baseUrl,
          resolved.provider.apiKey,
          resolved.model,
          prompt,
          buildAuthHeaders(resolved.provider)
        );
      }
    }

    // Fallback to legacy extraction model or main model
    const config =
      this.settings.extractionModel?.apiKey
        ? this.settings.extractionModel
        : this.settings.llm;

    if (!config.apiKey) {
      throw new Error('No LLM provider configured for NPC extraction');
    }

    return this.callOpenAICompatible(
      config.baseUrl,
      config.apiKey,
      config.modelName,
      prompt,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      }
    );
  }

  /**
   * Make OpenAI-compatible API call
   */
  private async callOpenAICompatible(
    baseUrl: string,
    _apiKey: string,
    model: string,
    prompt: string,
    headers: Record<string, string>
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temp for structured extraction
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Parse LLM response as JSON array
   */
  private parseExtractionResponse(response: string): ExtractedNPC[] {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code block if present
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find array in response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return [];
    }

    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      console.warn('Failed to parse NPC extraction response:', response);
    }

    return [];
  }

  /**
   * Sanitize NPC name for display
   */
  private sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
      .substring(0, 100); // Limit length
  }

  /**
   * Validate and normalize role
   */
  private validateRole(role: string): NPCRole {
    const normalized = role?.toLowerCase().trim();
    if (['ally', 'enemy', 'neutral'].includes(normalized)) {
      return normalized as NPCRole;
    }
    return 'unknown';
  }

  /**
   * Validate stats object
   */
  private validateStats(
    stats: Record<string, number> | undefined
  ): Partial<Record<string, number>> | undefined {
    if (!stats || typeof stats !== 'object') {
      return undefined;
    }

    const validStats: Record<string, number> = {};
    const allowedStats = [
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ];

    for (const [key, value] of Object.entries(stats)) {
      const normalized = key.toLowerCase();
      if (allowedStats.includes(normalized) && typeof value === 'number') {
        // Clamp to reasonable range (1-30 for D&D)
        validStats[normalized] = Math.max(1, Math.min(30, Math.round(value)));
      }
    }

    return Object.keys(validStats).length > 0 ? validStats : undefined;
  }

  /**
   * Sanitize prompt input to prevent injection attacks
   */
  private sanitizePromptInput(text: string): string {
    return text
      // Remove potential instruction markers
      .replace(/\[INST\]|\[\/INST\]|<\|[^>]+\|>/gi, '')
      // Remove code blocks that could contain instructions
      .replace(/```[\s\S]*?```/g, '[code removed]')
      // Remove potential role markers
      .replace(/\b(system|assistant|user):\s*/gi, '')
      // Limit length to prevent context overflow
      .substring(0, 8000);
  }

  /**
   * Generate slug from name
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolderExists(path: string): Promise<void> {
    const parts = path.split('/');
    let current = '';

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const exists = this.app.vault.getAbstractFileByPath(current);
      if (!exists) {
        try {
          await this.app.vault.createFolder(current);
        } catch {
          // Folder may exist, ignore
        }
      }
    }
  }
}
