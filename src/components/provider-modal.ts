/**
 * Provider Modal
 * Modal for adding/editing LLM providers
 */

import { App, Modal, Setting, DropdownComponent, Notice } from 'obsidian';
import { PROVIDER_PRESETS } from '../constants/provider-presets';
import { modelFetcher, type FetchedModel } from '../services/model-fetcher';
import type { LLMProvider } from '../types/provider';

export class ProviderModal extends Modal {
  private provider: Partial<LLMProvider>;
  private isEdit: boolean;
  private onSave: (provider: LLMProvider) => void;
  private existingNames: string[];
  private modelDropdown?: DropdownComponent;
  private fetchedModels: FetchedModel[] = [];

  constructor(
    app: App,
    provider: Partial<LLMProvider> | null,
    onSave: (provider: LLMProvider) => void,
    existingNames: string[] = []
  ) {
    super(app);
    this.isEdit = !!provider?.id;
    this.provider = provider
      ? { ...provider }
      : { id: crypto.randomUUID() };
    this.onSave = onSave;
    // Filter out current provider's name for edit mode
    this.existingNames = existingNames.filter(
      (n) => n.toLowerCase() !== provider?.name?.toLowerCase()
    );
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('mianix-provider-modal');

    contentEl.createEl('h2', {
      text: this.isEdit ? 'Edit Provider' : 'Add Provider',
    });

    // Preset dropdown
    new Setting(contentEl)
      .setName('Provider Type')
      .setDesc('Select a preset or use custom configuration')
      .addDropdown((dd) => {
        dd.addOption('', 'Custom (OpenAI Compatible)');
        for (const preset of PROVIDER_PRESETS) {
          dd.addOption(preset.id, preset.name);
        }
        dd.setValue(this.provider.presetId || '');
        dd.onChange((value) => {
          if (value) {
            const preset = PROVIDER_PRESETS.find((p) => p.id === value);
            if (preset) {
              this.provider.presetId = value;
              this.provider.baseUrl = preset.baseUrl;
              this.provider.authHeader = preset.authHeader;
              // Auto-fill name if empty
              if (!this.provider.name) {
                this.provider.name = preset.name;
              }
            }
          } else {
            this.provider.presetId = undefined;
            this.provider.authHeader = 'bearer';
          }
          // Refresh form
          this.onOpen();
        });
      });

    // Provider name
    new Setting(contentEl)
      .setName('Name')
      .setDesc('Display name for this provider')
      .addText((text) =>
        text
          .setPlaceholder('My OpenAI')
          .setValue(this.provider.name || '')
          .onChange((value) => (this.provider.name = value))
      );

    // Base URL
    new Setting(contentEl)
      .setName('Base URL')
      .setDesc('API endpoint (e.g., https://api.openai.com/v1)')
      .addText((text) =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.provider.baseUrl || '')
          .onChange((value) => (this.provider.baseUrl = value))
      );

    // API Key
    new Setting(contentEl).setName('API Key').addText((text) => {
      text.inputEl.type = 'password';
      text
        .setPlaceholder('sk-...')
        .setValue(this.provider.apiKey || '')
        .onChange((value) => (this.provider.apiKey = value));
    });

    // Default Model with fetch
    const modelSetting = new Setting(contentEl)
      .setName('Default Model')
      .setDesc('Model to use when none specified');

    modelSetting.addDropdown((dd) => {
      this.modelDropdown = dd;
      dd.addOption('', 'Select or fetch models →');

      // Add current default model if exists
      if (this.provider.defaultModel) {
        dd.addOption(this.provider.defaultModel, this.provider.defaultModel);
        dd.setValue(this.provider.defaultModel);
      }

      // Add fetched models if any
      for (const model of this.fetchedModels) {
        if (model.id !== this.provider.defaultModel) {
          dd.addOption(model.id, model.name || model.id);
        }
      }

      dd.onChange((value) => {
        if (value) this.provider.defaultModel = value;
      });
    });

    // Fetch models button
    modelSetting.addButton((btn) =>
      btn.setButtonText('Fetch').onClick(async () => {
        if (!this.provider.baseUrl?.trim()) {
          new Notice('⚠️ Base URL is required to fetch models');
          return;
        }
        if (!this.provider.apiKey?.trim()) {
          new Notice('⚠️ API Key is required to fetch models');
          return;
        }

        btn.setButtonText('...');
        btn.setDisabled(true);

        try {
          const models = await modelFetcher.fetchModels(
            this.provider as LLMProvider,
            true
          );

          if (models.length === 0) {
            new Notice('No models found. Check API key and endpoint.');
          } else {
            this.fetchedModels = models;

            // Update dropdown
            if (this.modelDropdown) {
              this.modelDropdown.selectEl.empty();
              this.modelDropdown.addOption('', 'Select a model');
              for (const model of models) {
                this.modelDropdown.addOption(model.id, model.name || model.id);
              }
              if (this.provider.defaultModel) {
                this.modelDropdown.setValue(this.provider.defaultModel);
              }
            }

            new Notice(`✓ Found ${models.length} models`);
          }
        } catch (error) {
          // Provide specific error feedback
          const msg = error instanceof Error ? error.message : 'Unknown error';
          if (msg.includes('401') || msg.includes('403')) {
            new Notice('❌ Authentication failed. Check your API key.');
          } else if (msg.includes('404')) {
            new Notice('❌ Endpoint not found. Check the Base URL.');
          } else if (msg.includes('network') || msg.includes('fetch')) {
            new Notice('❌ Network error. Check your connection.');
          } else {
            new Notice(`❌ Failed to fetch models: ${msg}`);
          }
        } finally {
          btn.setButtonText('Fetch');
          btn.setDisabled(false);
        }
      })
    );

    // Manual model input (fallback)
    new Setting(contentEl)
      .setName('Or enter manually')
      .setDesc('Type model name if fetch is not available')
      .addText((text) =>
        text
          .setPlaceholder('gpt-4-turbo')
          .setValue(this.provider.defaultModel || '')
          .onChange((value) => (this.provider.defaultModel = value))
      );

    // Action buttons
    const buttonSetting = new Setting(contentEl);

    buttonSetting.addButton((btn) =>
      btn.setButtonText('Cancel').onClick(() => this.close())
    );

    buttonSetting.addButton((btn) =>
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => {
          const name = this.provider.name?.trim();
          const baseUrl = this.provider.baseUrl?.trim();

          if (!name) {
            new Notice('⚠️ Provider name is required');
            return;
          }

          // Check for duplicate name
          if (this.existingNames.some(
            (n) => n.toLowerCase() === name.toLowerCase()
          )) {
            new Notice('⚠️ A provider with this name already exists');
            return;
          }

          if (!baseUrl) {
            new Notice('⚠️ Base URL is required');
            return;
          }

          // Validate URL format
          try {
            new URL(baseUrl);
          } catch {
            new Notice('⚠️ Invalid Base URL format');
            return;
          }

          this.onSave(this.provider as LLMProvider);
          this.close();
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
