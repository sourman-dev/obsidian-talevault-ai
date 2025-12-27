/**
 * Lorebook Service
 * Manages keyword-triggered lorebook entries (private + shared)
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { LOREBOOKS_FOLDER } from '../constants';
import type { Lorebook, LorebookEntry } from '../types/lorebook';
import { MAX_ACTIVE_ENTRIES } from '../types/lorebook';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';
import {
  parseLorebookSection,
  updateLorebookInContent,
} from '../utils/lorebook-parser';
import { createLorebookSearch } from '../utils/lorebook-bm25';

/** Shared lorebook frontmatter */
interface SharedLorebookMeta {
  id: string;
  name: string;
  description?: string;
}

export class LorebookService {
  constructor(private app: App) {}

  /**
   * Load private lorebook from character card.md body
   */
  async loadPrivate(characterFolderPath: string): Promise<Lorebook | null> {
    const cardPath = normalizePath(`${characterFolderPath}/card.md`);
    const file = this.app.vault.getAbstractFileByPath(cardPath);

    if (!(file instanceof TFile)) {
      return null;
    }

    const content = await this.app.vault.read(file);
    const { data, content: body } = parseFrontmatter<{ id: string; name: string }>(content);

    const entries = parseLorebookSection(body);

    if (entries.length === 0) {
      return null;
    }

    return {
      id: `private-${data.id}`,
      name: `${data.name}'s Lorebook`,
      scope: 'private',
      entries,
      sourcePath: cardPath,
    };
  }

  /**
   * Load all shared lorebooks from lorebooks/ folder
   */
  async loadShared(): Promise<Lorebook[]> {
    const folderPath = normalizePath(LOREBOOKS_FOLDER);
    await this.ensureFolderExists(folderPath);

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      return [];
    }

    const lorebooks: Lorebook[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        try {
          const lorebook = await this.loadSharedFile(child);
          if (lorebook) {
            lorebooks.push(lorebook);
          }
        } catch (e) {
          console.error(`Failed to load lorebook ${child.path}:`, e);
        }
      }
    }

    return lorebooks;
  }

  /**
   * Load single shared lorebook file
   */
  private async loadSharedFile(file: TFile): Promise<Lorebook | null> {
    const content = await this.app.vault.read(file);
    const { data, content: body } = parseFrontmatter<SharedLorebookMeta>(content);

    const entries = parseLorebookSection(body);

    return {
      id: data.id || file.basename,
      name: data.name || file.basename,
      description: data.description,
      scope: 'shared',
      entries,
      sourcePath: file.path,
    };
  }

  /**
   * Get active entries using BM25 search against recent messages
   * Returns entries sorted by order, limited to MAX_ACTIVE_ENTRIES
   *
   * Uses BM25 algorithm for better relevance ranking:
   * - TF-IDF weighting: rare keywords score higher
   * - Length normalization: longer entries don't dominate
   * - Ranking: returns most relevant entries
   */
  async getActiveEntries(
    characterFolderPath: string,
    recentMessages: string[],
    scanDepth: number
  ): Promise<LorebookEntry[]> {
    // Load all lorebooks
    const [privateLb, sharedLbs] = await Promise.all([
      this.loadPrivate(characterFolderPath),
      this.loadShared(),
    ]);

    // Combine all entries
    const allEntries: LorebookEntry[] = [];

    if (privateLb) {
      allEntries.push(...privateLb.entries);
    }
    for (const lb of sharedLbs) {
      allEntries.push(...lb.entries);
    }

    if (allEntries.length === 0) {
      return [];
    }

    // Get text to scan (limited by scanDepth)
    const messagesToScan = recentMessages.slice(-scanDepth);
    const scanText = messagesToScan.join('\n');

    // Use BM25 search for better relevance ranking
    const bm25 = createLorebookSearch(allEntries);
    return bm25.search(scanText, MAX_ACTIVE_ENTRIES);
  }

  /**
   * Save private lorebook entries to character card.md
   */
  async savePrivate(characterFolderPath: string, entries: LorebookEntry[]): Promise<void> {
    const cardPath = normalizePath(`${characterFolderPath}/card.md`);
    const file = this.app.vault.getAbstractFileByPath(cardPath);

    if (!(file instanceof TFile)) {
      throw new Error(`Character card not found: ${cardPath}`);
    }

    const content = await this.app.vault.read(file);
    const { data, content: body } = parseFrontmatter(content);

    // Update lorebook section in body
    const newBody = updateLorebookInContent(body, entries);

    // Rebuild file
    const newContent = stringifyFrontmatter(data, newBody);
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Save or create shared lorebook
   */
  async saveShared(lorebook: Lorebook): Promise<void> {
    const folderPath = normalizePath(LOREBOOKS_FOLDER);
    await this.ensureFolderExists(folderPath);

    const slug = this.slugify(lorebook.name);
    const filePath = lorebook.sourcePath || normalizePath(`${folderPath}/${slug}.md`);

    const meta: SharedLorebookMeta = {
      id: lorebook.id,
      name: lorebook.name,
      description: lorebook.description,
    };

    // Build lorebook content
    const { serializeLorebookSection } = await import('../utils/lorebook-parser');
    const body = serializeLorebookSection(lorebook.entries);
    const content = stringifyFrontmatter(meta, body);

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  /**
   * Format active entries for LLM context injection
   * Sanitizes content to prevent prompt injection
   */
  formatForContext(entries: LorebookEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const entry of entries) {
      // Sanitize name and content to prevent prompt injection
      const safeName = this.sanitizeForLLM(entry.name);
      const safeContent = this.sanitizeForLLM(entry.content);
      lines.push(`**${safeName}:**`);
      lines.push(safeContent);
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * Sanitize content for LLM injection
   * Removes potential prompt injection patterns
   */
  private sanitizeForLLM(text: string): string {
    return text
      // Remove markdown code blocks that could contain instructions
      .replace(/```[\s\S]*?```/g, '[code block removed]')
      // Remove inline code
      .replace(/`[^`]+`/g, '[code]')
      // Remove potential system/assistant role markers
      .replace(/\b(system|assistant|user):\s*/gi, '')
      // Remove potential instruction markers
      .replace(/\[INST\]|\[\/INST\]|<\|[^>]+\|>/gi, '')
      // Limit consecutive newlines
      .replace(/\n{3,}/g, '\n\n');
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
          // Folder may have been created by another call
        }
      }
    }
  }

  /**
   * Generate slug from name
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')  // Deduplicate consecutive hyphens
      .replace(/^-|-$/g, '');
  }
}
