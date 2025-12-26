# TaleVault AI - Codebase Summary

**Status:** Phase 2 Complete - Multi-Provider LLM & Memory System
**Version:** 0.2.0
**Last Updated:** 2025-12-26
**Total Files:** 51 | **Total Tokens:** 53,581 | **Total Size:** 216KB

## Project Overview

TaleVault AI is an Obsidian plugin that enables AI-powered roleplay conversations using character cards and large language models. Features include:
- Multi-provider LLM support (OpenAI, Google, OpenRouter, Groq, custom)
- Character card import from PNG/SillyTavern format
- BM25-based memory retrieval system
- Token tracking and streaming responses
- Mobile-first responsive UI
- Full React integration with Zustand state management

## Project Structure

```
obsidian-talevault-ai/
├── manifest.json                 # Plugin metadata
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── esbuild.config.mjs            # Build configuration
├── styles.css                    # Plugin styling (8KB)
├── repomix-output.xml            # Codebase archive
├── src/
│   ├── main.ts                   # Plugin entry & lifecycle
│   ├── constants.ts              # Module constants
│   ├── settings-tab.ts           # Settings UI
│   ├── components/               # React components
│   │   ├── App.tsx              # Main wrapper
│   │   ├── Layout.tsx           # Layout structure
│   │   ├── chat/
│   │   │   ├── ChatView.tsx         (2.9KB, chat interface)
│   │   │   ├── MessageList.tsx      (message history)
│   │   │   ├── MessageItem.tsx      (individual message)
│   │   │   ├── MessageInput.tsx     (input field)
│   │   │   └── LLMOptionsPanel.tsx  (settings panel)
│   │   ├── characters/
│   │   │   ├── CharacterList.tsx    (dropdown selector)
│   │   │   └── CharacterForm.tsx    (editor)
│   │   ├── ui/
│   │   │   └── Modal.tsx        (modal component)
│   │   └── provider-modal.ts    (provider management)
│   ├── services/                 # Business logic
│   │   ├── character-service.ts     (2KB, character CRUD)
│   │   ├── dialogue-service.ts      (2.9KB, message CRUD)
│   │   ├── llm-service.ts           (LLM API calls)
│   │   ├── model-fetcher.ts         (model discovery)
│   │   ├── memory-extraction-service.ts (memory extraction)
│   │   ├── index-service.ts         (message indexing)
│   │   └── preset-service.ts        (preset loading)
│   ├── hooks/                    # React hooks
│   │   ├── use-characters.ts    # Character state
│   │   ├── use-dialogue.ts      # Message state
│   │   └── use-llm.ts           # LLM state
│   ├── utils/                    # Utility functions
│   │   ├── provider-resolver.ts # Provider abstraction
│   │   ├── bm25.ts              # BM25 search
│   │   ├── png-parser.ts        # PNG metadata
│   │   ├── frontmatter.ts       # YAML parsing
│   │   ├── avatar.ts            # Image handling
│   │   ├── slug.ts              # Slug generation
│   │   └── settings-migration.ts# Settings upgrades
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts             # Core types
│   │   ├── provider.ts          # Provider types
│   │   └── memory.ts            # Memory types
│   ├── constants/
│   │   └── provider-presets.ts  # Provider templates
│   ├── context/
│   │   └── app-context.tsx      # React context
│   ├── store/
│   │   └── index.ts             # Zustand store
│   ├── presets/
│   │   └── default-presets.ts   # System prompts
│   └── views/
│       └── roleplay-view.tsx    # Obsidian view
└── docs/                         # Documentation
    ├── project-overview-pdr.md  # This document
    ├── code-standards.md        # Code standards
    ├── codebase-summary.md      # Codebase overview
    └── system-architecture.md   # Architecture
```

## Core Components

### Plugin Entry Point (`src/main.ts`)
- Plugin class extending Obsidian `Plugin`
- Lifecycle management (onload, onunload)
- Settings management with migration
- View registration and activation
- Command palette integration
- Ribbon icon management

### Settings Tab (`src/settings-tab.ts`)
- Provider management UI (add/edit/delete)
- Model fetching with caching
- Settings persistence
- Form validation
- Error handling and user feedback

### Character Service (`src/services/character-service.ts`)
**Responsibility:** Character card CRUD operations

Key methods:
- `loadCharacters()`: Load all characters from vault
- `createCharacter()`: Create new character
- `updateCharacter()`: Edit existing character
- `deleteCharacter()`: Remove character
- `importCharacterFromPNG()`: PNG card import
- `getCharacter()`: Fetch single character

Interactions:
- Uses `png-parser` for PNG metadata extraction
- Uses `slug` utility for folder naming
- Stores cards as YAML + markdown files

### Dialogue Service (`src/services/dialogue-service.ts`)
**Responsibility:** Message storage and retrieval

Key methods:
- `loadMessages()`: Fetch all messages for character
- `createMessage()`: Save new message
- `updateMessage()`: Edit message
- `deleteMessage()`: Remove message
- `getMessageIndex()`: Fetch message metadata index

Interactions:
- Uses `index-service` for indexing
- Stores messages as markdown with frontmatter
- Maintains message order with numeric prefixes

### LLM Service (`src/services/llm-service.ts`)
**Responsibility:** LLM API integration

Key methods:
- `generateResponse()`: Call LLM API for completion
- `streamResponse()`: Streaming API calls
- `tokenCount()`: Estimate token usage

Interactions:
- Uses `provider-resolver` for provider abstraction
- Uses `memory-extraction-service` for context
- Handles streaming and token tracking

### Memory Extraction Service (`src/services/memory-extraction-service.ts`)
**Responsibility:** BM25 search and memory extraction

Key methods:
- `extractContext()`: BM25 search for relevant messages
- `extractMemories()`: Generate facts from conversation
- `indexMessages()`: Build BM25 index

Features:
- Top-K retrieval (configurable)
- Optional fact extraction via LLM
- Offline-first BM25 indexing

### Model Fetcher (`src/services/model-fetcher.ts`)
**Responsibility:** Automatic model discovery

Key methods:
- `fetchModels()`: Get available models from provider
- `cacheModels()`: Store models locally
- `validateModel()`: Verify model availability

Provider support:
- OpenAI: `/v1/models` endpoint
- Google: Hardcoded Gemini models
- OpenRouter: Model catalog API
- Groq: Model listing endpoint
- Custom: Manual entry required

## Data Models

### ProviderConfig (types/provider.ts)
```typescript
interface ProviderConfig {
  id: string;                  // UUID
  name: string;               // User-friendly name
  type: 'openai' | 'google' | 'openrouter' | 'groq' | 'custom';
  apiKey: string;             // Stored locally
  baseUrl?: string;           // Custom endpoint (optional)
  createdAt: string;          // ISO timestamp
}
```

### CharacterCard (types/index.ts)
```typescript
interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  createdAt: string;
  avatar?: string;            // Base64 or data URL
  [key: string]: any;        // Extra fields from PNG
}
```

### DialogueMessage (types/index.ts)
```typescript
interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  inputTokens?: number;
  outputTokens?: number;
  parentId?: string;          // For branching
}
```

### LLMOptions
```typescript
interface LLMOptions {
  temperature?: number;       // 0-2 (default: 0.7)
  topP?: number;             // 0-1 (default: 0.9)
  maxTokens?: number;        // 1-4096 (varies by model)
  frequencyPenalty?: number; // -2 to 2 (OpenAI only)
  presencePenalty?: number;  // -2 to 2 (OpenAI only)
}
```

## React Components

### App.tsx
Main component wrapper that:
- Manages global state selection
- Loads initial data
- Provides context to children
- Handles error boundaries

### Layout.tsx
Layout container providing:
- Two-column responsive layout
- Character list sidebar
- Chat view main area
- Provider/model selector bar

### ChatView.tsx (2.9KB)
Chat interface with:
- Message list display
- Message input field
- LLM options panel
- Streaming response display
- Token count information

### MessageList.tsx & MessageItem.tsx
Message rendering with:
- Chronological ordering
- User/assistant styling
- Token count display
- Timestamp information
- Markdown formatting

### MessageInput.tsx
Input handling with:
- Text area for message content
- Send button with loading state
- Character count
- Auto-focus management

### CharacterList.tsx
Character selector with:
- Dropdown component
- Search/filter capability
- Selected character highlight
- Quick create option

### LLMOptionsPanel.tsx
Settings panel for:
- Temperature slider (0-2)
- Top-P slider (0-1)
- Max tokens input
- Reset to defaults

## State Management (Zustand)

### App Store (store/index.ts)
```typescript
interface AppState {
  selectedProvider: ProviderConfig | null;
  selectedModel: string | null;
  selectedCharacter: CharacterCard | null;
  messages: DialogueMessage[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedProvider: (provider: ProviderConfig | null) => void;
  setSelectedModel: (model: string | null) => void;
  setSelectedCharacter: (character: CharacterCard | null) => void;
  addMessage: (message: DialogueMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

Key patterns:
- Use `store.getState()` in async operations to avoid stale closures
- Selectors for component subscriptions
- Immutable state updates
- Clear action naming

## Utilities

### provider-resolver.ts
Abstracts provider differences:
- Routes provider calls by type
- Handles API key validation
- Manages base URL configuration
- Supports custom OpenAI-compatible endpoints

### bm25.ts
BM25 search implementation:
- Document indexing
- Query scoring
- Top-K retrieval
- No external dependencies

### png-parser.ts
PNG metadata extraction:
- EXIF data parsing
- Base64 image conversion
- Character card format detection
- Fallback for missing fields

### frontmatter.ts
YAML frontmatter handling:
- Parse metadata from markdown
- Generate YAML headers
- Type-safe parsing

### avatar.ts
Image handling:
- Convert PNG to data URL
- Cache avatars locally
- Handle missing images
- Image validation

### slug.ts
Generate slugs from names:
- Lowercase conversion
- Special character removal
- Whitespace handling
- Collision prevention

### settings-migration.ts
Settings version management:
- v0.1 → v0.2 migration
- Provider structure updates
- Backward compatibility
- Safe defaults

## Hooks

### use-characters.ts
Character state management:
- Load characters on mount
- Create/update/delete operations
- Loading and error states
- Selection management

### use-dialogue.ts
Message state management:
- Load messages for character
- Send message flow
- Add/update operations
- Streaming response handling

### use-llm.ts
LLM provider state:
- Provider and model selection
- Model fetching with cache
- Options management
- Error handling

## Styling (styles.css - 8KB)

Key classes:
- `.talevault-container`: Main flex container
- `.talevault-layout`: Two-column layout
- `.talevault-sidebar`: Character list area
- `.talevault-chat`: Message display area
- `.talevault-message`: Individual message styling
- `.talevault-message--user`: User message variant
- `.talevault-message--assistant`: Assistant message variant
- `.talevault-input`: Message input styling
- `.talevault-button`: Button styling

Features:
- BEM naming convention
- Obsidian CSS variables
- Mobile-responsive design
- Dark/light mode support
- Flexbox layout
- Scrollable containers

## Vault File Structure

```
tale-vault/
├── character-cards/
│   └── {slug}/
│       ├── card.md              # Character metadata
│       ├── avatar.png           # Character portrait
│       ├── session.json         # LLM options
│       ├── index.json           # Message index
│       └── messages/
│           ├── 001.md           # Message 1
│           ├── 002.md           # Message 2
│           └── ...
└── presets/
    ├── multi-mode.md            # Default system prompt
    └── output-format.md         # Format instructions
```

## Build Configuration

### package.json
```json
{
  "name": "talevault-ai",
  "version": "0.2.0",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "obsidian": "^1.11.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.19.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "builtin-modules": "^3.3.0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "yaml": "^2.8.2",
    "uuid": "^13.0.0"
  }
}
```

### tsconfig.json
- Target: ES2018
- Module: ESNext with bundler resolution
- JSX: react-jsx (no React import needed)
- Strict mode enabled
- Path aliases: `@/*` → `src/*`

### esbuild.config.mjs
- Entry: `src/main.ts`
- Output: CommonJS for Obsidian
- Development: Inline sourcemaps, watch mode
- Production: Minified, no sourcemaps
- Bundles all except obsidian built-ins

## Dependencies Analysis

### Runtime (5 total)
- **react** (18.2): UI framework
- **react-dom** (18.2): DOM rendering
- **zustand** (4.4): State management
- **yaml** (2.8.2): YAML parsing (browser-compatible)
- **uuid** (13.0): UUID generation

### Dev-time (6 total)
- **obsidian** (1.11): Obsidian API
- **typescript** (5.3): Type checking
- **esbuild** (0.19): Bundling
- **@types/node, @types/react**: Type definitions
- **builtin-modules**: Bundle configuration

### Size Breakdown (Minified)
- Base Obsidian plugin: ~20KB
- React + ReactDOM + dependencies: ~20KB
- Plugin code (components, services, utils): ~10KB
- CSS styles: ~2KB
- **Total:** ~52KB

## Code Metrics

**Top 5 Files by Size:**
1. styles.css (8,063 tokens, 27KB)
2. dialogue-service.ts (2,948 tokens, 12.6KB)
3. ChatView.tsx (2,945 tokens, 13.4KB)
4. settings-tab.ts (2,865 tokens, 13.1KB)
5. character-service.ts (2,048 tokens, 9.1KB)

**Total Codebase:**
- 51 files
- 53,581 tokens
- 216,650 characters
- 15% in styles, 85% in TypeScript/TSX

## Development Workflow

### Start Development
```bash
pnpm install              # Install dependencies
pnpm dev                  # Start watch mode
```

### Build for Production
```bash
pnpm build               # Minified production build
```

### Type Checking
```bash
pnpm typecheck           # Check types without emit
```

### Install to Obsidian
```bash
pnpm install-plugin      # Build + copy to test vault
```

## Key Patterns & Conventions

1. **Provider Abstraction**: Switch statement in resolver handles provider-specific API differences
2. **Stale Closure Prevention**: Always use `store.getState()` in async operations
3. **Dependency Injection**: Services receive dependencies via constructor
4. **Type Safety**: Strict TypeScript mode with explicit type annotations
5. **BEM CSS**: Block-element-modifier naming with `talevault-` prefix
6. **Error Handling**: Try-catch blocks with logging and user feedback
7. **React Hooks**: Custom hooks for state management encapsulation
8. **Zustand Store**: Centralized global state with actions

## Phase 2 Completion Checklist

- [x] Multi-provider LLM support (OpenAI, Google, OpenRouter, Groq)
- [x] Provider management UI with add/edit/delete
- [x] Model fetching and caching per provider
- [x] Character card CRUD operations
- [x] PNG character card import with metadata extraction
- [x] Message persistence with YAML frontmatter
- [x] BM25 search indexing for memory
- [x] Token tracking (input/output per message)
- [x] Streaming response display
- [x] Mobile-first responsive UI
- [x] React component integration
- [x] Zustand state management
- [x] Settings migration (v0.1 → v0.2)
- [x] TypeScript strict mode
- [x] Production build < 100KB

## Next Steps (Phase 3)

- [ ] Per-character provider/model selection
- [ ] Advanced memory configuration UI
- [ ] Message search and filtering
- [ ] Conversation branching visualization
- [ ] Unit and integration testing
- [ ] Performance optimization
- [ ] Additional provider support

## Documentation Files

- **README.md**: User-facing documentation and installation
- **CLAUDE.md**: Development guidelines and workflows
- **docs/project-overview-pdr.md**: Project requirements and roadmap
- **docs/code-standards.md**: Code style and patterns (this file)
- **docs/codebase-summary.md**: Architecture and file structure overview
- **docs/system-architecture.md**: System design and data flow

## References

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [React Documentation](https://react.dev)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
