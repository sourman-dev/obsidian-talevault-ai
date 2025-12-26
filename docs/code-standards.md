# Code Standards & Patterns - TaleVault AI

**Last Updated:** 2025-12-26
**Version:** 2.0
**Status:** Active for v0.2.0+

## TypeScript Standards

### Configuration
- **Target:** ES2018 (broad browser compatibility)
- **Module System:** ESNext with bundler resolution
- **Strict Mode:** Enabled (`strict: true`)
- **JSX:** React JSX transform enabled
- **Path Aliases:** `@/*` maps to `src/*`

### Type Annotations
All function parameters and return types must be explicitly annotated:

```typescript
// Good
async function fetchModels(provider: ProviderConfig): Promise<string[]> {
  const models = await modelFetcher.fetch(provider);
  return models;
}

// Bad
async function fetchModels(provider) {
  // implicit return type
}
```

### Interface Naming
Use `PascalCase` for interfaces with semantic suffixes:

```typescript
// Settings interface
interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
}

// Entity with file info
interface CharacterCardWithPath extends CharacterCard {
  filePath: string;
}

// Form data
interface ProviderFormData {
  name: string;
  type: ProviderType;
}

// Context/app types
interface AppContextType {
  app: App;
  providers: ProviderConfig[];
}
```

**Suffix conventions:**
- `WithPath`: Entity includes file path information
- `WithContent`: Entity includes text content
- `FormData`: Form submission payload
- `Type`: React context or app-wide types
- `Config`: Configuration interface

### Const/Constant Naming
- Module-level constants: `UPPER_SNAKE_CASE`
- Type constants: Declare in separate constants file

```typescript
// constants.ts
export const VIEW_TYPE_CHAT = 'talevault-chat-view';
export const PLUGIN_ID = 'mianix-roleplay';
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_TEMPERATURE = 0.7;
```

### Object Imports
Always use `import type` for type-only imports to reduce bundle size:

```typescript
// Good
import type { ProviderConfig } from '@/types/provider';
import type MianixRoleplayPlugin from './main';
import { loadProvider } from '@/services/llm-service';

// Bad - mixes type and value imports
import { ProviderConfig } from '@/types/provider';
```

## Provider System Patterns

### Provider Resolver Pattern
Use provider-resolver to abstract API differences:

```typescript
// utils/provider-resolver.ts
export async function resolveProvider(
  config: ProviderConfig,
  model: string
): Promise<ProviderAPI> {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config, model);
    case 'google':
      return new GoogleProvider(config, model);
    // ... other providers
  }
}

// Usage in service
const provider = await resolveProvider(config, selectedModel);
const response = await provider.generateCompletion(messages, options);
```

### Model Fetching Pattern
Each provider implements model fetching:

```typescript
// model-fetcher.ts
interface ModelFetcher {
  fetchModels(config: ProviderConfig): Promise<string[]>;
  cacheModels(providerId: string, models: string[]): void;
}

// openai-provider.ts
class OpenAIProvider implements ModelFetcher {
  async fetchModels(config: ProviderConfig): Promise<string[]> {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    const data = await response.json();
    return data.data.map((m: any) => m.id);
  }
}
```

## State Management - Zustand Patterns

### Store Definition
Define stores with clear state and actions:

```typescript
// store/index.ts
interface AppState {
  selectedProvider: ProviderConfig | null;
  selectedModel: string | null;
  selectedCharacter: CharacterCard | null;
  messages: DialogueMessage[];
  isLoading: boolean;

  setSelectedProvider: (provider: ProviderConfig | null) => void;
  setSelectedModel: (model: string | null) => void;
  setSelectedCharacter: (character: CharacterCard | null) => void;
  addMessage: (message: DialogueMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedProvider: null,
  selectedModel: null,
  selectedCharacter: null,
  messages: [],
  isLoading: false,

  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedCharacter: (character) => set({ selectedCharacter: character }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
```

### Prevent Stale Closures
Always use `store.getState()` in async operations to get current state:

```typescript
// GOOD - use getState() for current state
async function sendMessage(content: string): Promise<void> {
  const { selectedCharacter, selectedModel, selectedProvider } = useAppStore.getState();

  if (!selectedCharacter || !selectedModel || !selectedProvider) {
    throw new Error('Missing required selection');
  }

  // Use fresh state values
  const response = await llmService.generateResponse(
    selectedCharacter,
    selectedModel,
    selectedProvider,
    content
  );
}

// BAD - useAppStore() hook in async context
async function sendMessage(content: string): Promise<void> {
  const { selectedCharacter } = useAppStore(); // stale closure!
  // selectedCharacter may not reflect current state
}
```

## Code Organization

### File Structure
```
src/
├── main.ts                      # Plugin class & lifecycle
├── constants.ts                 # Module constants
├── settings-tab.ts             # Settings UI
├── components/
│   ├── App.tsx                 # Main component
│   ├── Layout.tsx              # Layout wrapper
│   ├── chat/
│   │   ├── ChatView.tsx        # Chat messages + input
│   │   ├── MessageList.tsx     # Message list rendering
│   │   ├── MessageItem.tsx     # Individual message
│   │   ├── MessageInput.tsx    # Input component
│   │   └── LLMOptionsPanel.tsx # LLM settings
│   ├── characters/
│   │   ├── CharacterList.tsx   # Character selector
│   │   └── CharacterForm.tsx   # Character editor
│   ├── ui/
│   │   └── Modal.tsx           # Modal component
│   └── provider-modal.ts       # Provider management
├── services/
│   ├── character-service.ts    # Character CRUD
│   ├── dialogue-service.ts     # Message CRUD
│   ├── llm-service.ts          # LLM API calls
│   ├── model-fetcher.ts        # Model discovery
│   ├── memory-extraction-service.ts  # Memory extraction
│   ├── index-service.ts        # Message indexing
│   └── preset-service.ts       # Preset loading
├── hooks/
│   ├── use-characters.ts       # Character state
│   ├── use-dialogue.ts         # Message state
│   └── use-llm.ts              # LLM state
├── utils/
│   ├── provider-resolver.ts    # Provider abstraction
│   ├── bm25.ts                 # BM25 search
│   ├── png-parser.ts           # PNG metadata parsing
│   ├── frontmatter.ts          # YAML parsing
│   ├── avatar.ts               # Image handling
│   ├── slug.ts                 # Slug generation
│   └── settings-migration.ts   # Settings upgrades
├── types/
│   ├── index.ts                # Core types
│   ├── provider.ts             # Provider types
│   └── memory.ts               # Memory types
├── constants/
│   └── provider-presets.ts     # Provider templates
├── context/
│   └── app-context.tsx         # React context
├── store/
│   └── index.ts                # Zustand store
├── presets/
│   └── default-presets.ts      # System prompts
└── views/
    └── roleplay-view.tsx       # Main Obsidian view
```

**Principles:**
- One class/component per file (except closely related types)
- Type definitions in `types/` directory
- Business logic in `services/`
- UI in `components/` with feature subdirectories
- Custom hooks in `hooks/` with `use-` prefix
- Utilities in `utils/` with specific naming

### Class Organization
Classes should follow this member order:

```typescript
export class DialogueService {
  // 1. Static members
  static readonly DEFAULT_MESSAGE_PREFIX = '000';

  // 2. Constructor with dependency injection
  constructor(private app: App) {}

  // 3. Lifecycle/Framework methods
  async initialize(): Promise<void> {}

  // 4. Public methods
  async createMessage(
    characterId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<DialogueMessage> {}

  // 5. Private methods
  private generateMessageId(): string {
    return generateUUID();
  }
}
```

### Component Organization
React components follow this pattern:

```typescript
interface CharacterListProps {
  characters: CharacterCard[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function CharacterList({
  characters,
  selectedId,
  onSelect,
}: CharacterListProps): JSX.Element {
  // 1. State
  const [filter, setFilter] = useState('');

  // 2. Derived state
  const filtered = characters.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  // 3. Effects
  useEffect(() => {
    // ...
  }, []);

  // 4. Handlers
  const handleSelect = (id: string) => {
    onSelect(id);
  };

  // 5. Render
  return (
    <div className="character-list">
      {filtered.map(char => (
        <button
          key={char.id}
          className={selectedId === char.id ? 'selected' : ''}
          onClick={() => handleSelect(char.id)}
        >
          {char.name}
        </button>
      ))}
    </div>
  );
}
```

### Obsidian Plugin Lifecycle
Required methods in plugin class:

```typescript
async onload(): Promise<void> {
  // 1. Load persisted state
  await this.loadSettings();

  // 2. Register services
  this.characterService = new CharacterService(this.app, this.settings);
  this.dialogueService = new DialogueService(this.app);

  // 3. Register UI components
  this.registerView(VIEW_TYPE_CHAT, (leaf) =>
    new RoleplayView(leaf, this, this.settings)
  );
  this.addRibbonIcon('message-square', 'Chat', () =>
    this.activateView()
  );
  this.addSettingTab(new SettingsTab(this.app, this));

  // 4. Register commands
  this.addCommand({
    id: 'open-chat',
    name: 'Open Chat',
    callback: () => this.activateView(),
  });

  console.log('TaleVault AI loaded');
}

async onunload(): Promise<void> {
  console.log('TaleVault AI unloaded');
}
```

## Service Layer Patterns

### Dependency Injection
Services receive dependencies via constructor:

```typescript
export class LLMService {
  private provider: ProviderAPI | null = null;

  constructor(
    private app: App,
    private memoryService: MemoryExtractionService,
    private characterService: CharacterService
  ) {}

  async generateResponse(
    config: ProviderConfig,
    model: string,
    messages: DialogueMessage[],
    options: LLMOptions
  ): Promise<string> {
    this.provider = await resolveProvider(config, model);

    // Use injected services
    const context = await this.memoryService.extractContext(messages);
    const character = await this.characterService.getCharacter(...);

    return this.provider.generateCompletion({
      messages,
      context,
      ...options
    });
  }
}
```

### Error Handling
Use try-catch with specific error types:

```typescript
async function importCharacterCard(file: File): Promise<CharacterCard> {
  try {
    const metadata = await pngParser.extractMetadata(file);

    if (!metadata || !metadata.name) {
      throw new Error('Invalid character card: missing required fields');
    }

    const character: CharacterCard = {
      id: generateUUID(),
      ...metadata,
      createdAt: new Date().toISOString(),
    };

    return character;
  } catch (error) {
    console.error('Failed to import character card:', error);
    throw error;
  }
}
```

## Token Tracking Pattern

Add token counts to messages:

```typescript
interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  inputTokens?: number;
  outputTokens?: number;
  parentId?: string;
}

// When receiving response from LLM
async function saveMessage(
  content: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): Promise<void> {
  const message: DialogueMessage = {
    id: generateUUID(),
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  };

  await dialogueService.saveMessage(message);
}
```

## Memory System Pattern

BM25-based memory retrieval:

```typescript
// Memory extraction
async function extractMemories(
  messages: DialogueMessage[],
  model: string
): Promise<string[]> {
  const extractor = new MemoryExtractionService();
  return extractor.extract(messages, model);
}

// Memory retrieval
function retrieveContextMessages(
  allMessages: DialogueMessage[],
  currentQuery: string,
  topK: number = 5
): DialogueMessage[] {
  const bm25 = new BM25(allMessages);
  const scores = bm25.search(currentQuery);
  return scores
    .slice(0, topK)
    .map(score => allMessages[score.index]);
}
```

## React Integration

### JSX Configuration
TypeScript configured with `"jsx": "react-jsx"` - no React import needed:

```typescript
// No import React needed
function Component() {
  return <div>Content</div>;
}
```

### Component Naming
- Components: `PascalCase`
- Files: Match component name

```
components/
├── chat/
│   ├── ChatView.tsx        # Component name matches file
│   ├── MessageList.tsx
│   └── MessageInput.tsx
└── characters/
    └── CharacterList.tsx
```

### Props Interface
Every component should have props interface:

```typescript
interface ChatViewProps {
  character: CharacterCard;
  provider: ProviderConfig;
  onMessageSent: (message: string) => Promise<void>;
}

export function ChatView({
  character,
  provider,
  onMessageSent,
}: ChatViewProps): JSX.Element {
  return <div>{/* ... */}</div>;
}
```

### Custom Hooks Pattern
Keep hooks in `hooks/` directory with `use-` prefix:

```typescript
// hooks/use-characters.ts
export function useCharacters(): {
  characters: CharacterCard[];
  loading: boolean;
  error: string | null;
  addCharacter: (card: CharacterCard) => Promise<void>;
} {
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  async function loadCharacters() {
    try {
      setLoading(true);
      const loaded = await characterService.loadCharacters();
      setCharacters(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { characters, loading, error, addCharacter: characterService.addCharacter };
}
```

## CSS Standards

### Class Naming
Use BEM (Block Element Modifier) with plugin prefix:

```css
.talevault-chat { }
.talevault-chat__messages { }
.talevault-chat__message { }
.talevault-chat__message--user { }
.talevault-chat__message-input { }
.talevault-chat__button { }
.talevault-chat__button--primary { }
```

### CSS Variables
Always use Obsidian CSS variables for theme support:

```css
/* Good - automatic dark/light mode */
.talevault-text {
  color: var(--text-normal);
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
}

/* Bad - hardcoded colors */
.talevault-text {
  color: #000;
  background: #fff;
}
```

### Common Obsidian Variables
- `--text-normal`: Normal text color
- `--text-muted`: Dimmed/secondary text
- `--background-primary`: Main background
- `--background-modifier-border`: Border color
- `--interactive-accent`: Accent color

### Layout Patterns
```css
/* Flex container */
.talevault-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

/* Scrollable content */
.talevault-scrollable {
  overflow-y: auto;
  flex: 1;
}

/* Fixed sidebar */
.talevault-sidebar {
  width: 240px;
  min-width: 200px;
  border-right: 1px solid var(--background-modifier-border);
  overflow-y: auto;
}

/* Responsive grid */
@media (max-width: 768px) {
  .talevault-container {
    flex-direction: column;
  }

  .talevault-sidebar {
    width: 100%;
    max-height: 30%;
  }
}
```

## Async/Await Patterns

Always use `async/await` for Promise-based operations:

```typescript
// Good
async function loadData(): Promise<void> {
  const data = await this.app.vault.read(file);
  this.data = JSON.parse(data);
}

// Bad
function loadData(): Promise<void> {
  return this.app.vault.read(file).then(data => {
    this.data = JSON.parse(data);
  });
}
```

## Comments

Comments should explain *why*, not what:

```typescript
// Good - explains reasoning
const messages = useAppStore(state => state.messages);
if (messages.length > 100) {
  // Preserve first message context, but limit history to last 100
  const startIdx = messages.length - 100;
  const recentMessages = messages.slice(startIdx);
}

// Bad - just repeats code
// Check if messages exist
if (messages.length > 0) {
  // Get recent messages
  const recentMessages = messages.slice(-100);
}
```

## Build Considerations

### Bundle Size
- Currently ~50KB minified (13 files, 5 runtime deps)
- Use `import type` for type-only imports
- Externalize: obsidian, electron, codemirror

### Development
- `pnpm dev`: Watch mode with inline sourcemaps
- Preserve formatting for debugging
- TypeScript strict mode enabled

### Production
- `pnpm build`: Minified output, no sourcemaps
- Tree-shaking enabled in esbuild
- Target: CommonJS for Obsidian compatibility

## Naming Conventions Summary

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `settings-tab.ts` |
| Directories | kebab-case | `src/services/` |
| Classes | PascalCase | `CharacterService` |
| Interfaces | PascalCase | `ProviderConfig` |
| Functions | camelCase | `fetchModels()` |
| Constants | UPPER_SNAKE_CASE | `VIEW_TYPE_CHAT` |
| CSS classes | kebab-case with prefix | `.talevault-container` |
| Properties | camelCase | `baseUrl`, `apiKey` |
| Methods | camelCase | `loadCharacters()` |
| React components | PascalCase | `ChatView` |
| Hooks | use + PascalCase | `useCharacters` |

## Testing Standards (Phase 3)

When implementing tests:
- Test files: `*.test.ts` or `*.spec.ts`
- Test directory: `tests/` parallel to `src/`
- Framework: Vitest with TypeScript
- Coverage target: > 80%

```typescript
// Example test
import { describe, it, expect } from 'vitest';
import { generateSlug } from '@/utils/slug';

describe('slug generator', () => {
  it('should convert text to slug format', () => {
    const result = generateSlug('Hello World');
    expect(result).toBe('hello-world');
  });

  it('should handle special characters', () => {
    const result = generateSlug('Alice & Bob');
    expect(result).toBe('alice-bob');
  });
});
```

## Security Best Practices

1. **API Keys**
   - Store only in Obsidian plugin data folder
   - Use password input type in UI
   - Never log or expose in console
   - Never include in build artifacts

2. **Data Storage**
   - All user data stored locally in vault
   - No external data persistence
   - No telemetry or analytics

3. **External APIs**
   - Only call configured LLM endpoints
   - Validate all API responses
   - Use HTTPS for all requests
   - Handle rate limiting gracefully

## Accessibility Standards

1. **Color Contrast**
   - Use Obsidian CSS variables (automatic)
   - Test with light and dark themes

2. **Keyboard Navigation**
   - All interactive elements keyboard accessible
   - Use semantic HTML (`<button>`, `<input>`)
   - Focus indicators visible

3. **Screen Readers**
   - Use `aria-` attributes for context
   - Semantic element naming
   - Alternative text for images

## Performance Optimization

1. **React Optimization**
   - Use `React.memo` for expensive components
   - Memoize callbacks with `useCallback`
   - Lazy load heavy components

2. **Memory Management**
   - Clean up subscriptions in `useEffect` cleanup
   - Avoid stale closures with `getState()`
   - Limit message history pagination

3. **Bundle Size**
   - Tree-shake unused code
   - Lazy load services on demand
   - Minimize dependencies
