# Phase 2: React View Integration

## Context

Builds on Phase 1 plugin boilerplate. Integrates React 18 into Obsidian's ItemView system with proper lifecycle management and context passing.

## Overview

- Implement RoleplayView with React 18 createRoot
- Create AppContext for Obsidian API access
- Setup Zustand store foundation
- Create base React component structure
- **Avatar support for character cards**

**Effort:** 4 hours

**Dependencies:** Phase 1 complete

---

## Requirements

| Requirement | Priority | Notes |
|-------------|----------|-------|
| React 18 createRoot integration | P0 | Modern React pattern |
| AppContext for Obsidian API | P0 | Components need vault access |
| Zustand store setup | P1 | State management foundation |
| Proper cleanup on view close | P0 | Memory leak prevention |
| StrictMode in development | P2 | Catch React issues |
| Avatar field in CharacterCard | P1 | Image file reference in frontmatter |
| Avatar loading utility | P1 | Load image from vault as data URL |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      RoleplayView (ItemView)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     React Root                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              AppContext.Provider                    │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │              <App />                          │  │  │  │
│  │  │  │  ┌────────────┐  ┌────────────────────────┐  │  │  │  │
│  │  │  │  │ Sidebar    │  │  MainContent           │  │  │  │  │
│  │  │  │  │ - CharList │  │  - ChatView (Phase 4)  │  │  │  │  │
│  │  │  │  │ - Actions  │  │  - CharForm (Phase 3)  │  │  │  │  │
│  │  │  │  └────────────┘  └────────────────────────┘  │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── main.ts
├── views/
│   └── roleplay-view.ts      # Updated with React
├── context/
│   └── app-context.tsx       # NEW: Obsidian API context
├── store/
│   └── index.ts              # NEW: Zustand store
├── components/
│   ├── App.tsx               # NEW: Root component
│   └── Layout.tsx            # NEW: Layout structure
├── utils/
│   └── avatar.ts             # NEW: Avatar loading utility
└── types/
    └── index.ts              # Updated with avatar field
```

## Avatar Design

Characters stored as folders with avatar image:

```
characters/alice/
├── card.md           # Frontmatter with avatar: "avatar.png"
├── avatar.png        # Character avatar image
└── dialogues/
    └── ...
```

Frontmatter:
```yaml
---
id: "uuid"
name: "Alice"
avatar: "avatar.png"   # Relative path within character folder
description: "..."
---
```

---

## Implementation Steps

### Step 1: Create src/context/app-context.tsx

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { App } from 'obsidian';
import type { MianixSettings } from '../types';

interface AppContextValue {
  app: App;
  settings: MianixSettings;
  saveSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
  value: AppContextValue;
}

export function AppProvider({ children, value }: AppProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Convenience hooks
export function useVault() {
  const { app } = useApp();
  return app.vault;
}

export function useSettings() {
  const { settings, saveSettings } = useApp();
  return { settings, saveSettings };
}
```

---

### Step 2: Create src/store/index.ts

```typescript
import { create } from 'zustand';
import type { CharacterCard, DialogueMessage } from '../types';

interface RoleplayState {
  // Current state
  currentCharacter: CharacterCard | null;
  currentDialogueId: string | null;
  messages: DialogueMessage[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentCharacter: (char: CharacterCard | null) => void;
  setMessages: (messages: DialogueMessage[]) => void;
  addMessage: (message: DialogueMessage) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentCharacter: null,
  currentDialogueId: null,
  messages: [],
  isLoading: false,
  error: null,
};

export const useRoleplayStore = create<RoleplayState>((set) => ({
  ...initialState,

  setCurrentCharacter: (char) =>
    set({ currentCharacter: char, messages: [], currentDialogueId: null }),

  setMessages: (messages) =>
    set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set(initialState),
}));
```

---

### Step 3: Create src/components/Layout.tsx

```tsx
import type { ReactNode } from 'react';

interface LayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function Layout({ sidebar, main }: LayoutProps) {
  return (
    <div className="mianix-layout">
      <aside className="mianix-sidebar">{sidebar}</aside>
      <main className="mianix-main">{main}</main>
    </div>
  );
}

// Placeholder components for future phases
export function Sidebar() {
  return (
    <div className="mianix-sidebar-content">
      <h3>Characters</h3>
      <p className="mianix-placeholder">Character list (Phase 3)</p>
    </div>
  );
}

export function MainContent() {
  return (
    <div className="mianix-main-content">
      <h3>Chat</h3>
      <p className="mianix-placeholder">Chat interface (Phase 4)</p>
    </div>
  );
}
```

---

### Step 4: Create src/components/App.tsx

```tsx
import { useApp } from '../context/app-context';
import { useRoleplayStore } from '../store';
import { Layout, Sidebar, MainContent } from './Layout';

export function App() {
  const { app } = useApp();
  const { currentCharacter, isLoading, error } = useRoleplayStore();

  return (
    <div className="mianix-roleplay-container">
      {error && (
        <div className="mianix-error">
          {error}
          <button onClick={() => useRoleplayStore.getState().setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Layout
        sidebar={<Sidebar />}
        main={<MainContent />}
      />

      {isLoading && (
        <div className="mianix-loading">Loading...</div>
      )}
    </div>
  );
}
```

---

### Step 5: Update src/views/roleplay-view.ts

```typescript
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

  async onOpen() {
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

  async onClose() {
    // Cleanup React root to prevent memory leaks
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
```

---

### Step 6: Update styles.css

```css
/* Mianix Roleplay Plugin Styles */

/* View container */
.mianix-view-container {
  height: 100%;
  overflow: hidden;
}

/* Main container */
.mianix-roleplay-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-interface);
}

/* Layout */
.mianix-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.mianix-sidebar {
  width: 200px;
  min-width: 150px;
  max-width: 300px;
  border-right: 1px solid var(--background-modifier-border);
  overflow-y: auto;
  padding: 8px;
}

.mianix-main {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* Content areas */
.mianix-sidebar-content,
.mianix-main-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mianix-sidebar-content h3,
.mianix-main-content h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

/* Placeholder text */
.mianix-placeholder {
  color: var(--text-faint);
  font-style: italic;
  padding: 16px;
  text-align: center;
}

/* Error display */
.mianix-error {
  background: var(--background-modifier-error);
  color: var(--text-error);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mianix-error button {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

/* Loading overlay */
.mianix-loading {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: var(--background-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
```

---

## Todo List

- [ ] Create src/context/app-context.tsx
- [ ] Create src/store/index.ts
- [ ] Create src/components/Layout.tsx
- [ ] Create src/components/App.tsx
- [ ] Update src/views/roleplay-view.ts with React 18 integration
- [ ] Update styles.css with layout styles
- [ ] Rebuild plugin: `pnpm build`
- [ ] Reload Obsidian plugin
- [ ] Verify React mounts without errors
- [ ] Verify console shows no memory leak warnings
- [ ] Test view open/close cycle multiple times

---

## Success Criteria

1. View opens with React-rendered layout (sidebar + main)
2. No console errors on mount
3. No console errors on unmount
4. StrictMode double-render works (dev mode)
5. Zustand store accessible in components
6. useApp() hook returns valid context

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| createRoot type issues | Medium | Medium | Import from react-dom/client |
| Memory leaks | High | Low | Cleanup in onClose |
| Context missing on first render | Medium | Low | Null check with error throw |
| StrictMode double effects | Low | Medium | Write idempotent effects |

---

## Technical Notes

### React 18 Pattern

```typescript
// CORRECT: React 18 pattern
import { createRoot } from 'react-dom/client';
this.root = createRoot(container);
this.root.render(<App />);

// AVOID: Legacy pattern (React 17)
// import ReactDOM from 'react-dom';
// ReactDOM.render(<App />, container);
```

### Root Storage

Store root instance as class property, not local variable:

```typescript
class RoleplayView extends ItemView {
  root: Root | null = null;  // <-- Class property

  async onOpen() {
    this.root = createRoot(container);
  }

  async onClose() {
    this.root?.unmount();  // <-- Access in cleanup
  }
}
```

---

## Next Phase

Proceed to [Phase 3: Character CRUD](./phase-03-character-crud.md) after React integration verified.
