import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { PRESETS_FOLDER, MIANIX_BASE_FOLDER } from '../constants';
import { PRESET_FILES } from '../presets';
import { DEFAULT_PRESETS } from '../presets/default-presets';

/**
 * PresetService manages global prompts stored in vault.
 * Presets are markdown files in mianix-ai/presets/ folder.
 */
export class PresetService {
  constructor(private app: App) {}

  /**
   * Initialize presets folder and files on plugin load.
   * Creates missing presets with default content.
   */
  async initializePresets(): Promise<void> {
    const { vault } = this.app;

    // Ensure base folder exists
    await this.ensureFolderExists(MIANIX_BASE_FOLDER);
    await this.ensureFolderExists(PRESETS_FOLDER);

    // Create missing preset files
    for (const [key, fileName] of Object.entries(PRESET_FILES)) {
      const filePath = normalizePath(`${PRESETS_FOLDER}/${fileName}`);
      const exists = vault.getAbstractFileByPath(filePath);

      if (!exists) {
        const defaultContent = DEFAULT_PRESETS[fileName];
        if (defaultContent) {
          try {
            await vault.create(filePath, defaultContent);
          } catch {
            // File may have been created by another call, ignore
          }
        }
      }
    }
  }

  /**
   * Reset all presets to default values.
   * Overwrites any user modifications.
   */
  async resetPresets(): Promise<void> {
    const { vault } = this.app;

    await this.ensureFolderExists(PRESETS_FOLDER);

    for (const [fileName, content] of Object.entries(DEFAULT_PRESETS)) {
      const filePath = normalizePath(`${PRESETS_FOLDER}/${fileName}`);
      const file = vault.getAbstractFileByPath(filePath);

      if (file instanceof TFile) {
        await vault.modify(file, content);
      } else {
        await vault.create(filePath, content);
      }
    }
  }

  /**
   * Load a specific preset file content.
   */
  async loadPreset(fileName: string): Promise<string> {
    const filePath = normalizePath(`${PRESETS_FOLDER}/${fileName}`);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      return await this.app.vault.read(file);
    }

    // Return default if file doesn't exist
    return DEFAULT_PRESETS[fileName] || '';
  }

  /**
   * Load multi-mode prompt.
   */
  async loadMultiModePrompt(): Promise<string> {
    return this.loadPreset(PRESET_FILES.MULTI_MODE);
  }

  /**
   * Load chain of thought prompt.
   */
  async loadChainOfThoughtPrompt(): Promise<string> {
    return this.loadPreset(PRESET_FILES.CHAIN_OF_THOUGHT);
  }

  /**
   * Load output structure prompt.
   */
  async loadOutputStructurePrompt(): Promise<string> {
    return this.loadPreset(PRESET_FILES.OUTPUT_STRUCTURE);
  }

  /**
   * Load output format prompt.
   */
  async loadOutputFormatPrompt(): Promise<string> {
    return this.loadPreset(PRESET_FILES.OUTPUT_FORMAT);
  }

  /**
   * Load Director prompt for POV system.
   */
  async loadDirectorPrompt(): Promise<string> {
    return this.loadPreset(PRESET_FILES.DIRECTOR);
  }

  /**
   * Load all presets needed for LLM.
   */
  async loadAllPresets(): Promise<{
    multiModePrompt: string;
    chainOfThoughtPrompt: string;
    outputStructurePrompt: string;
    outputFormatPrompt: string;
    directorPrompt?: string;
  }> {
    const [
      multiModePrompt,
      chainOfThoughtPrompt,
      outputStructurePrompt,
      outputFormatPrompt,
      directorPrompt,
    ] = await Promise.all([
      this.loadMultiModePrompt(),
      this.loadChainOfThoughtPrompt(),
      this.loadOutputStructurePrompt(),
      this.loadOutputFormatPrompt(),
      this.loadDirectorPrompt(),
    ]);

    return {
      multiModePrompt,
      chainOfThoughtPrompt,
      outputStructurePrompt,
      outputFormatPrompt,
      directorPrompt,
    };
  }

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
