import { ItemView, WorkspaceLeaf } from 'obsidian';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VIEW_TYPE_ROLEPLAY } from '../constants';
import { AppProvider } from '../context/app-context';
import { App } from '../components/App';
import type MianixRoleplayPlugin from '../main';

export class RoleplayView extends ItemView {
  plugin: MianixRoleplayPlugin;
  root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MianixRoleplayPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_ROLEPLAY;
  }

  getDisplayText(): string {
    return 'Mianix Roleplay';
  }

  getIcon(): string {
    return 'message-square';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('mianix-view-container');

    // Create React root
    this.root = createRoot(container);

    // Context value with Obsidian API access
    const contextValue = {
      app: this.app,
      settings: this.plugin.settings,
      saveSettings: () => this.plugin.saveSettings(),
    };

    // Render React app
    this.root.render(
      <StrictMode>
        <AppProvider value={contextValue}>
          <App />
        </AppProvider>
      </StrictMode>
    );
  }

  async onClose(): Promise<void> {
    // Cleanup React root to prevent memory leaks
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
