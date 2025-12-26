---
phase: 4
title: "Settings Tab UI Refactor"
status: completed
effort: 2h
depends: [phase-01, phase-02, phase-03]
completed: 2025-12-26
reviewed: 2025-12-26
---

# Phase 4: Settings Tab UI Refactor

## Context

- Parent: [plan.md](./plan.md)
- Depends: [Phase 1](./phase-01-provider-types.md), [Phase 2](./phase-02-settings-migration.md), [Phase 3](./phase-03-model-fetcher.md)

## Overview

Refactor settings tab từ single LLM fields sang provider management UI với:
- Provider CRUD (add/edit/delete)
- Preset selection dropdown
- Model auto-fetch dropdown
- Default model selection cho text/extraction

## Current State

```
Settings Tab (current)
├── LLM Provider
│   ├── Base URL (text input)
│   ├── API Key (password input)
│   └── Model Name (text input)
├── Memory Extraction
│   ├── Enable toggle
│   └── (if enabled) Extraction Model fields (duplicate)
└── Presets section
```

## Target State

```
Settings Tab (target)
├── Providers
│   ├── [Provider List] - Accordion/list với edit/delete
│   └── [Add Provider] button
├── Default Models
│   ├── Text Model: [Provider dropdown] → [Model dropdown]
│   └── Extraction Model: [Provider dropdown] → [Model dropdown] (if enabled)
├── Memory Extraction
│   └── Enable toggle
└── Presets section
```

## Implementation

### 1. Provider List UI

```typescript
// In settings-tab.ts

private renderProviderList(): void {
  const { containerEl } = this;

  containerEl.createEl('h3', { text: 'LLM Providers' });

  const providers = this.plugin.settings.providers || [];

  // Provider list container
  const listEl = containerEl.createDiv('mianix-provider-list');

  for (const provider of providers) {
    this.renderProviderItem(listEl, provider);
  }

  // Add provider button
  new Setting(containerEl)
    .addButton(btn => btn
      .setButtonText('+ Add Provider')
      .setCta()
      .onClick(() => this.openProviderModal())
    );
}

private renderProviderItem(container: HTMLElement, provider: LLMProvider): void {
  const itemEl = container.createDiv('mianix-provider-item');

  // Provider name and preset badge
  const infoEl = itemEl.createDiv('mianix-provider-info');
  infoEl.createSpan({ text: provider.name, cls: 'mianix-provider-name' });
  if (provider.presetId) {
    infoEl.createSpan({
      text: provider.presetId.toUpperCase(),
      cls: 'mianix-provider-badge'
    });
  }

  // Action buttons
  const actionsEl = itemEl.createDiv('mianix-provider-actions');

  // Edit button
  const editBtn = actionsEl.createEl('button', { cls: 'clickable-icon' });
  setIcon(editBtn, 'pencil');
  editBtn.onclick = () => this.openProviderModal(provider);

  // Delete button
  const deleteBtn = actionsEl.createEl('button', { cls: 'clickable-icon' });
  setIcon(deleteBtn, 'trash-2');
  deleteBtn.onclick = () => this.deleteProvider(provider.id);
}
```

### 2. Provider Modal

```typescript
import { Modal, Setting, DropdownComponent } from 'obsidian';
import { PROVIDER_PRESETS } from './constants/provider-presets';
import { modelFetcher } from './services/model-fetcher';
import type { LLMProvider, ProviderPreset } from './types/provider';

export class ProviderModal extends Modal {
  private provider: Partial<LLMProvider>;
  private isEdit: boolean;
  private onSave: (provider: LLMProvider) => void;
  private modelDropdown?: DropdownComponent;
  private fetchedModels: string[] = [];

  constructor(
    app: App,
    provider: Partial<LLMProvider> | null,
    onSave: (provider: LLMProvider) => void
  ) {
    super(app);
    this.isEdit = !!provider?.id;
    this.provider = provider || { id: crypto.randomUUID() };
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('mianix-provider-modal');

    contentEl.createEl('h2', {
      text: this.isEdit ? 'Edit Provider' : 'Add Provider'
    });

    // Preset dropdown
    new Setting(contentEl)
      .setName('Provider Type')
      .addDropdown(dd => {
        dd.addOption('', 'Custom');
        for (const preset of PROVIDER_PRESETS) {
          dd.addOption(preset.id, preset.name);
        }
        dd.setValue(this.provider.presetId || '');
        dd.onChange(value => {
          this.provider.presetId = value || undefined;
          if (value) {
            const preset = PROVIDER_PRESETS.find(p => p.id === value);
            if (preset) {
              this.provider.baseUrl = preset.baseUrl;
              // Refresh form
              this.onOpen();
            }
          }
        });
      });

    // Provider name
    new Setting(contentEl)
      .setName('Name')
      .setDesc('Display name for this provider')
      .addText(text => text
        .setPlaceholder('My OpenAI')
        .setValue(this.provider.name || '')
        .onChange(value => this.provider.name = value)
      );

    // Base URL
    new Setting(contentEl)
      .setName('Base URL')
      .setDesc('API endpoint')
      .addText(text => text
        .setPlaceholder('https://api.openai.com/v1')
        .setValue(this.provider.baseUrl || '')
        .onChange(value => this.provider.baseUrl = value)
      );

    // API Key
    new Setting(contentEl)
      .setName('API Key')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('sk-...')
          .setValue(this.provider.apiKey || '')
          .onChange(value => this.provider.apiKey = value);
      });

    // Default Model với fetch
    const modelSetting = new Setting(contentEl)
      .setName('Default Model')
      .setDesc('Will be used when no specific model selected');

    modelSetting.addDropdown(dd => {
      this.modelDropdown = dd;
      dd.addOption('', 'Enter manually or fetch →');
      if (this.provider.defaultModel) {
        dd.addOption(this.provider.defaultModel, this.provider.defaultModel);
        dd.setValue(this.provider.defaultModel);
      }
      dd.onChange(value => {
        if (value) this.provider.defaultModel = value;
      });
    });

    // Fetch models button
    modelSetting.addButton(btn => btn
      .setButtonText('Fetch')
      .onClick(async () => {
        if (!this.provider.baseUrl || !this.provider.apiKey) {
          new Notice('Please fill Base URL and API Key first');
          return;
        }

        btn.setButtonText('Loading...');
        btn.setDisabled(true);

        try {
          const models = await modelFetcher.fetchModels(
            this.provider as LLMProvider,
            true
          );

          this.fetchedModels = models.map(m => m.id);

          // Update dropdown
          if (this.modelDropdown) {
            this.modelDropdown.selectEl.empty();
            this.modelDropdown.addOption('', 'Select a model');
            for (const model of this.fetchedModels) {
              this.modelDropdown.addOption(model, model);
            }
            if (this.provider.defaultModel) {
              this.modelDropdown.setValue(this.provider.defaultModel);
            }
          }

          new Notice(`Found ${models.length} models`);
        } catch (error) {
          new Notice('Failed to fetch models');
        } finally {
          btn.setButtonText('Fetch');
          btn.setDisabled(false);
        }
      })
    );

    // Manual model input (fallback)
    new Setting(contentEl)
      .setName('Or enter manually')
      .addText(text => text
        .setPlaceholder('gpt-4-turbo')
        .setValue(this.provider.defaultModel || '')
        .onChange(value => this.provider.defaultModel = value)
      );

    // Save/Cancel buttons
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => {
          if (!this.provider.name || !this.provider.baseUrl) {
            new Notice('Name and Base URL are required');
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
```

### 3. Default Models Section

```typescript
private renderDefaultModels(): void {
  const { containerEl } = this;

  containerEl.createEl('h3', { text: 'Default Models' });

  const providers = this.plugin.settings.providers || [];
  const defaults = this.plugin.settings.defaults;

  // Text Model (required)
  new Setting(containerEl)
    .setName('Text Generation')
    .setDesc('Main model for roleplay responses')
    .addDropdown(dd => {
      dd.addOption('', 'Select provider...');
      for (const p of providers) {
        dd.addOption(p.id, p.name);
      }
      dd.setValue(defaults.text?.providerId || '');
      dd.onChange(async value => {
        defaults.text = {
          providerId: value,
          model: ''
        };
        await this.plugin.saveSettings();
        this.display(); // Refresh to show model dropdown
      });
    })
    .addDropdown(dd => {
      const selectedProvider = providers.find(
        p => p.id === defaults.text?.providerId
      );
      if (selectedProvider) {
        // Show cached models or fetch
        this.populateModelDropdown(dd, selectedProvider, defaults.text?.model);
        dd.onChange(async value => {
          if (defaults.text) {
            defaults.text.model = value;
            await this.plugin.saveSettings();
          }
        });
      } else {
        dd.addOption('', 'Select provider first');
        dd.setDisabled(true);
      }
    });

  // Extraction Model (optional, shown if memoryExtraction enabled)
  if (this.plugin.settings.enableMemoryExtraction) {
    new Setting(containerEl)
      .setName('Memory Extraction')
      .setDesc('Fast/cheap model for extracting facts')
      .addDropdown(dd => {
        dd.addOption('', 'Use text model');
        for (const p of providers) {
          dd.addOption(p.id, p.name);
        }
        dd.setValue(defaults.extraction?.providerId || '');
        dd.onChange(async value => {
          if (value) {
            defaults.extraction = { providerId: value, model: '' };
          } else {
            defaults.extraction = undefined;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      })
      .addDropdown(dd => {
        const selectedProvider = providers.find(
          p => p.id === defaults.extraction?.providerId
        );
        if (selectedProvider) {
          this.populateModelDropdown(dd, selectedProvider, defaults.extraction?.model);
          dd.onChange(async value => {
            if (defaults.extraction) {
              defaults.extraction.model = value;
              await this.plugin.saveSettings();
            }
          });
        } else {
          dd.addOption('', 'Same as text');
          dd.setDisabled(true);
        }
      });
  }
}

private async populateModelDropdown(
  dropdown: DropdownComponent,
  provider: LLMProvider,
  currentValue?: string
): Promise<void> {
  dropdown.addOption('', 'Loading...');

  try {
    const models = await modelFetcher.fetchModels(provider);
    dropdown.selectEl.empty();
    dropdown.addOption('', 'Select model');

    // Add default model first if exists
    if (provider.defaultModel) {
      dropdown.addOption(provider.defaultModel, `${provider.defaultModel} (default)`);
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
    dropdown.addOption('', 'Failed to load');
  }
}
```

### 4. CSS Styles

```css
/* styles.css additions */

.mianix-provider-list {
  margin-bottom: 1rem;
}

.mianix-provider-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.mianix-provider-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mianix-provider-name {
  font-weight: 500;
}

.mianix-provider-badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 3px;
}

.mianix-provider-actions {
  display: flex;
  gap: 0.25rem;
}

.mianix-provider-modal {
  min-width: 400px;
}
```

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/settings-tab.ts` | Major refactor |
| `src/components/provider-modal.ts` | Create |
| `styles.css` | Add provider styles |

## Success Criteria

- [x] Provider list displays all configured providers
- [x] Add provider opens modal with preset selection
- [x] Edit/delete providers works
- [x] Model fetch populates dropdown
- [x] Default text/extraction model selection works
- [x] Settings persist correctly

## Todo

- [x] Refactor settings-tab.ts structure
- [x] Create ProviderModal component
- [x] Implement provider CRUD operations
- [x] Add model fetch integration
- [x] Add default model selection UI
- [x] Add CSS styles

## Post-Review Improvements (Implemented)

**High Priority (Completed):**
- [x] Add delete confirmation dialog (prevent accidental deletion)
- [x] Improve error messages with details (specific auth/network/endpoint errors)
- [x] Add duplicate name validation (case-insensitive check)
- [x] Add URL format validation (using URL constructor)

**Medium Priority:**
- [ ] Add loading state to model dropdowns during fetch
- [ ] Enhance empty state guidance with examples
- [ ] Consider URL validation for security (block localhost/HTTP)

**Review:** See `plans/reports/code-reviewer-251226-2035-phase-4-settings-ui.md`
