import { App, PluginSettingTab, Setting, setIcon, DropdownComponent, Notice } from 'obsidian';
import type MianixRoleplayPlugin from './main';
import type { LLMProvider } from './types/provider';
import { ProviderModal } from './components/provider-modal';
import { modelFetcher } from './services/model-fetcher';

export class MianixSettingTab extends PluginSettingTab {
  plugin: MianixRoleplayPlugin;

  constructor(app: App, plugin: MianixRoleplayPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Mianix Roleplay Settings' });

    // Provider Management Section
    this.renderProviderList();

    // Default Models Section
    this.renderDefaultModels();

    // Memory Extraction Section
    this.renderMemoryExtraction();

    // Presets Section
    this.renderPresets();
  }

  /**
   * Provider list with add/edit/delete
   */
  private renderProviderList(): void {
    const { containerEl } = this;
    const providers = this.plugin.settings.providers || [];

    containerEl.createEl('h3', { text: 'LLM Providers' });

    // Provider list container
    const listEl = containerEl.createDiv('mianix-provider-list');

    if (providers.length === 0) {
      listEl.createDiv({
        text: 'No providers configured. Add one to get started.',
        cls: 'mianix-provider-empty',
      });
    } else {
      for (const provider of providers) {
        this.renderProviderItem(listEl, provider);
      }
    }

    // Add provider button
    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText('+ Add Provider')
        .setCta()
        .onClick(() => this.openProviderModal())
    );
  }

  /**
   * Single provider item in list
   */
  private renderProviderItem(container: HTMLElement, provider: LLMProvider): void {
    const itemEl = container.createDiv('mianix-provider-item');

    // Provider info
    const infoEl = itemEl.createDiv('mianix-provider-info');
    infoEl.createSpan({ text: provider.name, cls: 'mianix-provider-name' });

    if (provider.presetId) {
      infoEl.createSpan({
        text: provider.presetId.toUpperCase(),
        cls: 'mianix-provider-badge',
      });
    }

    if (provider.defaultModel) {
      infoEl.createSpan({
        text: provider.defaultModel,
        cls: 'mianix-provider-model',
      });
    }

    // Action buttons
    const actionsEl = itemEl.createDiv('mianix-provider-actions');

    // Edit button
    const editBtn = actionsEl.createEl('button', { cls: 'clickable-icon' });
    setIcon(editBtn, 'pencil');
    editBtn.setAttribute('aria-label', 'Edit');
    editBtn.onclick = () => this.openProviderModal(provider);

    // Delete button
    const deleteBtn = actionsEl.createEl('button', { cls: 'clickable-icon' });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.setAttribute('aria-label', 'Delete');
    deleteBtn.onclick = () => this.deleteProvider(provider.id);
  }

  /**
   * Open modal for add/edit provider
   */
  private openProviderModal(provider?: LLMProvider): void {
    const providers = this.plugin.settings.providers || [];
    const existingNames = providers.map((p) => p.name);

    new ProviderModal(
      this.app,
      provider || null,
      async (saved) => {
        if (provider) {
          // Edit existing
          const idx = providers.findIndex((p) => p.id === provider.id);
          if (idx >= 0) {
            providers[idx] = saved;
          }
        } else {
          // Add new
          providers.push(saved);
        }

        this.plugin.settings.providers = providers;
        await this.plugin.saveSettings();
        new Notice(`Provider "${saved.name}" saved`);
        this.display();
      },
      existingNames
    ).open();
  }

  /**
   * Delete a provider with confirmation
   */
  private async deleteProvider(id: string): Promise<void> {
    const providers = this.plugin.settings.providers || [];
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    // Check if provider is used as default
    const defaults = this.plugin.settings.defaults;
    const isDefaultText = defaults?.text?.providerId === id;
    const isDefaultExtraction = defaults?.extraction?.providerId === id;

    // Build confirmation message
    let message = `Delete provider "${provider.name}"?`;
    if (isDefaultText || isDefaultExtraction) {
      message += '\n\n⚠️ This provider is set as default for:';
      if (isDefaultText) message += '\n• Text generation';
      if (isDefaultExtraction) message += '\n• Memory extraction';
      message += '\n\nDefaults will be cleared.';
    }

    // Simple confirmation using confirm (Obsidian-compatible)
    if (!confirm(message)) return;

    // Proceed with deletion
    const idx = providers.findIndex((p) => p.id === id);
    if (idx >= 0) {
      providers.splice(idx, 1);
      this.plugin.settings.providers = providers;

      // Clear defaults if they reference this provider
      if (isDefaultText && defaults) {
        defaults.text = { providerId: '', model: '' };
      }
      if (isDefaultExtraction && defaults) {
        defaults.extraction = undefined;
      }

      await this.plugin.saveSettings();
      new Notice(`Provider "${provider.name}" deleted`);
      this.display();
    }
  }

  /**
   * Default model selection for text and extraction
   */
  private renderDefaultModels(): void {
    const { containerEl } = this;
    const providers = this.plugin.settings.providers || [];
    const defaults = this.plugin.settings.defaults;

    containerEl.createEl('h3', { text: 'Default Models' });

    if (providers.length === 0) {
      containerEl.createDiv({
        text: 'Add a provider first to configure default models.',
        cls: 'mianix-provider-empty',
      });
      return;
    }

    // Text Model (required)
    const textSetting = new Setting(containerEl)
      .setName('Text Generation')
      .setDesc('Main model for roleplay responses');

    // Provider dropdown
    textSetting.addDropdown((dd) => {
      dd.addOption('', 'Select provider...');
      for (const p of providers) {
        dd.addOption(p.id, p.name);
      }
      dd.setValue(defaults?.text?.providerId || '');
      dd.onChange(async (value) => {
        if (!this.plugin.settings.defaults) {
          this.plugin.settings.defaults = { text: { providerId: '', model: '' } };
        }
        this.plugin.settings.defaults.text = {
          providerId: value,
          model: '',
        };
        await this.plugin.saveSettings();
        this.display();
      });
    });

    // Model dropdown (cascading)
    const selectedTextProvider = providers.find(
      (p) => p.id === defaults?.text?.providerId
    );

    textSetting.addDropdown((dd) => {
      if (selectedTextProvider) {
        this.populateModelDropdown(dd, selectedTextProvider, defaults?.text?.model);
        dd.onChange(async (value) => {
          if (this.plugin.settings.defaults?.text) {
            this.plugin.settings.defaults.text.model = value;
            await this.plugin.saveSettings();
          }
        });
      } else {
        dd.addOption('', 'Select provider first');
        dd.setDisabled(true);
      }
    });

    // Extraction Model (optional, shown if enabled)
    if (this.plugin.settings.enableMemoryExtraction) {
      const extractionSetting = new Setting(containerEl)
        .setName('Memory Extraction')
        .setDesc('Fast model for extracting facts (optional)');

      // Provider dropdown
      extractionSetting.addDropdown((dd) => {
        dd.addOption('', 'Same as text model');
        for (const p of providers) {
          dd.addOption(p.id, p.name);
        }
        dd.setValue(defaults?.extraction?.providerId || '');
        dd.onChange(async (value) => {
          if (!this.plugin.settings.defaults) {
            this.plugin.settings.defaults = { text: { providerId: '', model: '' } };
          }
          if (value) {
            this.plugin.settings.defaults.extraction = {
              providerId: value,
              model: '',
            };
          } else {
            this.plugin.settings.defaults.extraction = undefined;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

      // Model dropdown (cascading)
      const selectedExtractionProvider = providers.find(
        (p) => p.id === defaults?.extraction?.providerId
      );

      extractionSetting.addDropdown((dd) => {
        if (selectedExtractionProvider) {
          this.populateModelDropdown(
            dd,
            selectedExtractionProvider,
            defaults?.extraction?.model
          );
          dd.onChange(async (value) => {
            if (this.plugin.settings.defaults?.extraction) {
              this.plugin.settings.defaults.extraction.model = value;
              await this.plugin.saveSettings();
            }
          });
        } else {
          dd.addOption('', 'Uses text model');
          dd.setDisabled(true);
        }
      });
    }
  }

  /**
   * Populate model dropdown from provider's cached/fetched models
   */
  private async populateModelDropdown(
    dropdown: DropdownComponent,
    provider: LLMProvider,
    currentValue?: string
  ): Promise<void> {
    // Start with loading state
    dropdown.addOption('', 'Loading...');

    // Check cache first
    const cached = modelFetcher.getCached(provider);

    if (cached && cached.length > 0) {
      dropdown.selectEl.empty();
      dropdown.addOption('', 'Select model');

      // Add default model first if exists
      if (provider.defaultModel) {
        dropdown.addOption(
          provider.defaultModel,
          `${provider.defaultModel} (default)`
        );
      }

      for (const model of cached) {
        if (model.id !== provider.defaultModel) {
          dropdown.addOption(model.id, model.name || model.id);
        }
      }

      if (currentValue) {
        dropdown.setValue(currentValue);
      }
    } else {
      // Try to fetch models
      try {
        const models = await modelFetcher.fetchModels(provider);
        dropdown.selectEl.empty();
        dropdown.addOption('', 'Select model');

        if (provider.defaultModel) {
          dropdown.addOption(
            provider.defaultModel,
            `${provider.defaultModel} (default)`
          );
        }

        for (const model of models) {
          if (model.id !== provider.defaultModel) {
            dropdown.addOption(model.id, model.name || model.id);
          }
        }

        if (currentValue) {
          dropdown.setValue(currentValue);
        }
      } catch {
        dropdown.selectEl.empty();
        dropdown.addOption('', 'Enter model manually');

        // Add manual input as fallback
        if (currentValue) {
          dropdown.addOption(currentValue, currentValue);
          dropdown.setValue(currentValue);
        }
      }
    }
  }

  /**
   * Memory extraction toggle
   */
  private renderMemoryExtraction(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Memory Extraction (RAG)' });

    new Setting(containerEl)
      .setName('Enable Memory Extraction')
      .setDesc(
        'Extract important facts from conversations using a fast/cheap model. Enables long-term memory for characters.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMemoryExtraction)
          .onChange(async (value) => {
            this.plugin.settings.enableMemoryExtraction = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }

  /**
   * Global presets section
   */
  private renderPresets(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Global Presets' });

    new Setting(containerEl)
      .setName('Reset Presets')
      .setDesc(
        'Restore all presets to default values. Your custom modifications will be overwritten.'
      )
      .addButton((btn) =>
        btn
          .setButtonText('Reset to Default')
          .setWarning()
          .onClick(async () => {
            await this.plugin.presetService.resetPresets();
            const { Notice } = await import('obsidian');
            new Notice('Presets have been reset to defaults.');
          })
      );

    new Setting(containerEl)
      .setName('Open Presets Folder')
      .setDesc('Edit global prompts in mianix-ai/presets/')
      .addButton((btn) =>
        btn.setButtonText('Open Folder').onClick(async () => {
          const { PRESETS_FOLDER } = await import('./constants');
          const folder = this.app.vault.getAbstractFileByPath(PRESETS_FOLDER);
          if (folder) {
            const fileExplorer =
              this.app.workspace.getLeavesOfType('file-explorer')[0];
            if (fileExplorer) {
              // @ts-expect-error - accessing internal API
              fileExplorer.view.revealInFolder(folder);
            }
          }
        })
      );
  }
}
