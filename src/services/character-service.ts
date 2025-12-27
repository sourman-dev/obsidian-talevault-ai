import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import { CHARACTERS_FOLDER } from '../constants';
import type { CharacterCard, CharacterCardWithPath, CharacterFormData, MianixSettings } from '../types';
import { generateUniqueSlug } from '../utils/slug';
import { loadAvatarAsDataUrl } from '../utils/avatar';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';
import { parsePngCharacterCard } from '../utils/png-parser';
import { DialogueService } from './dialogue-service';
import { StatsService } from './stats-service';
import { NPCExtractionService } from './npc-extraction-service';

/** Options for character import */
export interface ImportOptions {
  /** Initialize stats.json on import */
  initializeStats?: boolean;
  /** Extract NPCs from character description */
  extractNPCs?: boolean;
  /** Settings for NPC extraction (required if extractNPCs is true) */
  settings?: MianixSettings;
}

export class CharacterService {
  constructor(private app: App) {}

  /**
   * List all characters from characters/ folder
   */
  async list(): Promise<CharacterCardWithPath[]> {
    const { vault } = this.app;
    const charactersPath = normalizePath(CHARACTERS_FOLDER);

    // Ensure folder exists (creates parent folders if needed)
    await this.ensureFolderExists(charactersPath);

    const folder = vault.getAbstractFileByPath(charactersPath);
    if (!(folder instanceof TFolder)) {
      return [];
    }

    const characters: CharacterCardWithPath[] = [];

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        const cardPath = normalizePath(`${child.path}/card.md`);
        const cardFile = vault.getAbstractFileByPath(cardPath);

        if (cardFile instanceof TFile) {
          try {
            const character = await this.readFile(cardFile, child.path);
            if (character) {
              characters.push(character);
            }
          } catch (e) {
            console.error(`Failed to read character at ${cardPath}:`, e);
          }
        }
      }
    }

    // Sort by creation date, newest first
    return characters.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Read single character by folder path
   */
  async read(folderPath: string): Promise<CharacterCardWithPath | null> {
    const cardPath = normalizePath(`${folderPath}/card.md`);
    const cardFile = this.app.vault.getAbstractFileByPath(cardPath);

    if (!(cardFile instanceof TFile)) {
      return null;
    }

    return this.readFile(cardFile, folderPath);
  }

  /**
   * Create new character
   */
  async create(data: CharacterFormData): Promise<CharacterCardWithPath> {
    const { vault } = this.app;

    // Generate unique slug
    const existingFolders = await this.getExistingFolderNames();
    const slug = generateUniqueSlug(data.name, existingFolders);
    const folderPath = normalizePath(`${CHARACTERS_FOLDER}/${slug}`);
    const filePath = normalizePath(`${folderPath}/card.md`);

    // Create character data
    const character: CharacterCard = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      personality: data.personality,
      scenario: data.scenario,
      firstMessage: data.firstMessage,
      createdAt: new Date().toISOString(),
    };

    // Create folder structure
    await this.ensureFolderExists(folderPath);

    // Generate markdown with frontmatter
    const content = stringifyFrontmatter(character);

    // Create file
    await vault.create(filePath, content);

    return {
      ...character,
      folderPath,
      filePath,
    };
  }

  /**
   * Update existing character
   */
  async update(
    folderPath: string,
    data: Partial<CharacterFormData>
  ): Promise<CharacterCardWithPath | null> {
    const existing = await this.read(folderPath);
    if (!existing) {
      return null;
    }

    const updated: CharacterCard = {
      id: existing.id,
      name: data.name ?? existing.name,
      avatar: existing.avatar,
      description: data.description ?? existing.description,
      personality: data.personality ?? existing.personality,
      scenario: data.scenario ?? existing.scenario,
      firstMessage: data.firstMessage ?? existing.firstMessage,
      createdAt: existing.createdAt,
    };

    // Generate new content
    const content = stringifyFrontmatter(updated);

    // Get file and update
    const file = this.app.vault.getAbstractFileByPath(existing.filePath);
    if (!(file instanceof TFile)) {
      return null;
    }

    await this.app.vault.modify(file, content);

    return {
      ...updated,
      folderPath: existing.folderPath,
      filePath: existing.filePath,
      avatarUrl: existing.avatarUrl,
    };
  }

  /**
   * Delete character (move to trash)
   */
  async delete(folderPath: string): Promise<boolean> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      return false;
    }

    await this.app.vault.trash(folder, true);
    return true;
  }

  /**
   * Import character from PNG file (SillyTavern/Chub.ai format)
   * Extracts character data from PNG metadata and saves avatar
   * @param options Optional import settings (stats init, NPC extraction)
   */
  async importFromPng(
    pngArrayBuffer: ArrayBuffer,
    options: ImportOptions = {}
  ): Promise<CharacterCardWithPath | null> {
    const { vault } = this.app;

    // Parse PNG metadata
    const cardData = await parsePngCharacterCard(pngArrayBuffer);
    if (!cardData) {
      throw new Error('No character data found in PNG. Make sure this is a valid character card.');
    }

    // Generate unique slug
    const existingFolders = await this.getExistingFolderNames();
    const slug = generateUniqueSlug(cardData.name, existingFolders);
    const folderPath = normalizePath(`${CHARACTERS_FOLDER}/${slug}`);
    const cardFilePath = normalizePath(`${folderPath}/card.md`);
    const avatarPath = normalizePath(`${folderPath}/avatar.png`);

    // Create character data
    const character: CharacterCard = {
      id: uuidv4(),
      name: cardData.name,
      avatar: 'avatar.png',
      description: cardData.description,
      personality: cardData.personality,
      scenario: cardData.scenario,
      firstMessage: cardData.first_mes,
      createdAt: new Date().toISOString(),
    };

    // Create folder structure
    await this.ensureFolderExists(folderPath);

    // Save avatar PNG
    await vault.createBinary(avatarPath, pngArrayBuffer);

    // Generate markdown with frontmatter
    // Include additional fields as markdown content
    let bodyContent = '';
    if (cardData.mes_example) {
      bodyContent += `\n## Example Messages\n\n${cardData.mes_example}\n`;
    }
    if (cardData.system_prompt) {
      bodyContent += `\n## System Prompt\n\n${cardData.system_prompt}\n`;
    }
    if (cardData.creator_notes) {
      bodyContent += `\n## Creator Notes\n\n${cardData.creator_notes}\n`;
    }

    const content = stringifyFrontmatter(character, bodyContent);
    await vault.create(cardFilePath, content);

    // Initialize dialogue session for this character
    const dialogueService = new DialogueService(this.app);
    await dialogueService.initializeSession(folderPath, character.id);

    // Create first message if exists
    if (cardData.first_mes) {
      await dialogueService.createFirstMessage(folderPath, cardData.first_mes);
    }

    // Initialize stats if requested (defaults to true)
    if (options.initializeStats !== false) {
      const statsService = new StatsService(this.app);
      await statsService.initializeStats(folderPath);
    }

    // Extract NPCs if requested and settings provided
    if (options.extractNPCs && options.settings) {
      try {
        const npcService = new NPCExtractionService(this.app, options.settings);
        const description = [
          cardData.description || '',
          cardData.personality || '',
          cardData.scenario || '',
        ].join('\n\n');

        const npcs = await npcService.extractNPCs(description, character.id);
        if (npcs.length > 0) {
          await npcService.saveNPCs(folderPath, npcs);
          console.log(`✅ Extracted ${npcs.length} NPCs from character card`);
        }
      } catch (e) {
        console.error('NPC extraction failed (continuing import):', e);
        // Don't fail import if NPC extraction fails
      }
    }

    // Get avatar URL for display (use data URL for mobile compatibility)
    const avatarUrl = await loadAvatarAsDataUrl(this.app, folderPath, 'avatar.png');

    return {
      ...character,
      folderPath,
      filePath: cardFilePath,
      avatarUrl,
    };
  }

  // --- Private helpers ---

  private async readFile(
    file: TFile,
    folderPath: string
  ): Promise<CharacterCardWithPath | null> {
    const content = await this.app.vault.read(file);
    const { data } = parseFrontmatter<CharacterCard>(content);

    // Validate required fields
    if (!data.id || !data.name) {
      return null;
    }

    // Get avatar URL if avatar field exists (use data URL for mobile compatibility)
    const avatarUrl = data.avatar
      ? await loadAvatarAsDataUrl(this.app, folderPath, data.avatar)
      : undefined;

    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      description: data.description || '',
      personality: data.personality || '',
      scenario: data.scenario || '',
      firstMessage: data.firstMessage || '',
      createdAt: data.createdAt || new Date().toISOString(),
      folderPath,
      filePath: file.path,
      avatarUrl,
    };
  }

  private async getExistingFolderNames(): Promise<string[]> {
    const folder = this.app.vault.getAbstractFileByPath(
      normalizePath(CHARACTERS_FOLDER)
    );
    if (!(folder instanceof TFolder)) {
      return [];
    }

    return folder.children
      .filter((child): child is TFolder => child instanceof TFolder)
      .map((f) => f.name);
  }

  /**
   * Ensure folder exists, creating parent folders if needed
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
          // Folder may have been created by another call, ignore
        }
      }
    }
  }
}
