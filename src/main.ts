import { Plugin, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_ROLEPLAY } from './constants';
import { MianixSettings, DEFAULT_SETTINGS } from './types';
import { RoleplayView } from './views/roleplay-view';
import { MianixSettingTab } from './settings-tab';
import { PresetService } from './services/preset-service';
import { migrateSettings } from './utils/settings-migration';

export default class MianixRoleplayPlugin extends Plugin {
  settings: MianixSettings = DEFAULT_SETTINGS;
  presetService!: PresetService;

  async onload(): Promise<void> {
    try {
      await this.loadSettings();

      // Initialize preset service and create default presets
      this.presetService = new PresetService(this.app);
      await this.presetService.initializePresets();

      // Register custom view
      this.registerView(
        VIEW_TYPE_ROLEPLAY,
        (leaf) => new RoleplayView(leaf, this)
      );

      // Add ribbon icon
      this.addRibbonIcon('message-square', 'Mianix Roleplay', () => {
        this.activateView();
      });

      // Add settings tab
      this.addSettingTab(new MianixSettingTab(this.app, this));

      // Add command to open view
      this.addCommand({
        id: 'open-roleplay-view',
        name: 'Open Roleplay View',
        callback: () => this.activateView(),
      });

      // Add command to regenerate latest turn
      this.addCommand({
        id: 'regenerate-latest-turn',
        name: 'Regenerate latest turn',
        callback: () => {
          // Dispatch custom event that ChatView listens to
          window.dispatchEvent(new CustomEvent('talevault:regenerate-latest'));
        },
      });

      console.log('TaleVault AI plugin loaded');
    } catch (error) {
      console.error('Mianix Roleplay plugin failed to load:', error);
    }
  }

  async onunload(): Promise<void> {
    console.log('Mianix Roleplay plugin unloaded');
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    // Migrate legacy settings to new multi-provider format
    this.settings = migrateSettings(data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_ROLEPLAY);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_ROLEPLAY, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
