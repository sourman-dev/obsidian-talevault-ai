import { App, TFile, TFolder, normalizePath } from 'obsidian';
import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';
import { CHARACTERS_FOLDER } from '../constants';
import type { CharacterCard, CharacterCardWithPath, CharacterFormData } from '../types';
import { generateUniqueSlug } from '../utils/slug';
import { getAvatarResourceUrl } from '../utils/avatar';
import { parsePngCharacterCard, type CharacterCardData } from '../utils/png-parser';

export class CharacterService {
  constructor(private app: App) {}

  /**
   * List all characters from characters/ folder
   */
  async list(): Promise<CharacterCardWithPath[]> {
    const { vault } = this.app;
    const charactersPath = normalizePath(CHARACTERS_FOLDER);

    // Ensure folder exists
    let folder = vault.getAbstractFileByPath(charactersPath);
    if (!folder) {
      await vault.createFolder(charactersPath);
      return [];
    }
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
    const content = matter.stringify('', character);

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
    const content = matter.stringify('', updated);

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
   */
  async importFromPng(pngArrayBuffer: ArrayBuffer): Promise<CharacterCardWithPath | null> {
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

    const content = matter.stringify(bodyContent, character);
    await vault.create(cardFilePath, content);

    // Get avatar URL for display
    const avatarUrl = getAvatarResourceUrl(this.app, folderPath, 'avatar.png');

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
    const { data } = matter(content);

    // Validate required fields
    if (!data.id || !data.name) {
      return null;
    }

    // Get avatar URL if avatar field exists
    const avatarUrl = data.avatar
      ? getAvatarResourceUrl(this.app, folderPath, data.avatar)
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

  private async ensureFolderExists(path: string): Promise<void> {
    const exists = this.app.vault.getAbstractFileByPath(path);
    if (!exists) {
      await this.app.vault.createFolder(path);
    }
  }
}
