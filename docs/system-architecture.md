# TaleVault AI - System Architecture

**Version:** 0.2.0
**Last Updated:** 2025-12-26
**Phase:** 2 - Multi-Provider LLM & Memory System

## Architecture Overview

TaleVault AI follows a layered architecture design with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian Platform                        │
│              (Plugin API, Vault, Workspace)                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    React Components Layer                   │
│  (App, Layout, ChatView, CharacterList, LLMOptionsPanel)   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Zustand State Layer                       │
│             (AppState, Selectors, Actions)                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Character    │  │ Dialogue     │  │ LLM Service  │     │
│  │ Service      │  │ Service      │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Model        │  │ Memory       │  │ Index        │     │
│  │ Fetcher      │  │ Extraction   │  │ Service      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Utilities Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Provider │  │ BM25     │  │ PNG      │  │ Avatar   │   │
│  │ Resolver │  │ Search   │  │ Parser   │  │ Loader   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Slug     │  │ Frontmatter │ Settings │                  │
│  │ Gen      │  │ Parser   │  │ Migration│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage Layer                       │
│           (Vault Files, Obsidian Data.json)                │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                           │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐    │
│  │ OpenAI      │  │ Google   │  │ OpenRouter│ │ Groq │    │
│  │ Chat API    │  │ Gemini   │  │ API      │  │ API  │    │
│  └─────────────┘  └──────────┘  └──────────┘  └──────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. Obsidian Platform Layer
Interface with Obsidian's plugin system:
- **View Management**: Register and manage custom views
- **Vault Access**: Read/write character and message files
- **Settings Storage**: Persist plugin configuration
- **Commands & Ribbon**: User input entry points

### 2. React Components Layer
User-facing interface components:
- **App.tsx**: Root component, initial data loading
- **Layout.tsx**: Main layout structure
- **ChatView.tsx**: Chat interface with messages and input
- **CharacterList.tsx**: Character selector dropdown
- **LLMOptionsPanel.tsx**: Model settings (temperature, top-p, etc.)
- **MessageItem.tsx**: Individual message rendering
- **ProviderModal.ts**: Provider management interface

### 3. Zustand State Management Layer
Centralized application state:
- **selectedProvider**: Currently selected LLM provider
- **selectedModel**: Currently selected model name
- **selectedCharacter**: Currently selected character
- **messages**: Loaded conversation messages
- **isLoading**: Global loading state
- **error**: Error message if any

**Key Pattern:** Use `store.getState()` in async operations to avoid stale closures

### 4. Services Layer
Business logic abstraction:

**Character Service**
- Load/create/update/delete characters
- PNG card import with metadata extraction
- Avatar caching

**Dialogue Service**
- Load/create/update/delete messages
- Message indexing for fast retrieval
- Conversation history management

**LLM Service**
- Generate completions via provider APIs
- Handle streaming responses
- Token counting and tracking
- Memory context injection

**Model Fetcher**
- Discover models from provider APIs
- Cache model lists locally
- Validate model availability

**Memory Extraction Service**
- BM25 search indexing
- Extract relevant past messages
- Optional fact extraction via LLM
- Memory context formatting

**Index Service**
- Maintain message metadata indexes
- Quick message lookup
- Conversation statistics

### 5. Utilities Layer
Reusable helper functions:

**Provider Resolver**
- Route API calls by provider type
- Handle provider-specific differences
- Support custom OpenAI-compatible endpoints

**BM25 Search**
- Document indexing
- Relevance scoring
- Top-K retrieval

**PNG Parser**
- Extract EXIF metadata from PNGs
- Convert images to data URLs
- Validate character card format

**Avatar Loader**
- Cache avatars as data URLs
- Handle missing images
- Image validation

**Other Utilities**
- Slug generation for folder names
- YAML frontmatter parsing
- Settings migration between versions

### 6. Data Storage Layer
Persistent data management:

**Obsidian Vault Files**
- Character cards: Markdown + YAML frontmatter
- Messages: Markdown files with frontmatter
- Avatar images: PNG files
- Message indexes: JSON metadata

**Plugin Data (data.json)**
- Provider configurations
- User settings
- Cached model lists
- Session state

### 7. External APIs
Third-party LLM services:
- OpenAI (GPT-4, GPT-3.5, etc.)
- Google Gemini
- OpenRouter (proxy service)
- Groq (fast inference)

## Data Flow Diagrams

### Message Generation Flow

```
User Input (MessageInput)
    ↓
useDialogue hook (validates selection)
    ↓
Zustand store.getState() (gets current state)
    ↓
LLM Service (resolves provider & generates)
    ↓
Provider Resolver (routes to correct provider)
    ↓
External LLM API (calls provider API)
    ↓
Memory Service (extracts context if enabled)
    ↓
Token Tracking (count usage)
    ↓
Dialogue Service (save message to vault)
    ↓
Index Service (update message index)
    ↓
Zustand addMessage (update UI state)
    ↓
MessageList (re-render with new message)
```

### Character Selection Flow

```
User selects character (CharacterList)
    ↓
useCharacters hook (loads character data)
    ↓
Character Service (loads from vault)
    ↓
Dialogue Service (load character's messages)
    ↓
Index Service (rebuild BM25 index)
    ↓
Zustand setSelectedCharacter (store state)
    ↓
ChatView (display messages)
```

### Provider Setup Flow

```
User adds provider (SettingsTab)
    ↓
Form validation (check API key format)
    ↓
Model Fetcher (call provider's models endpoint)
    ↓
Provider API returns model list
    ↓
Cache models (save to plugin data)
    ↓
Settings persist to Obsidian data.json
    ↓
Zustand notifies components
    ↓
UI updates available models
```

## Component Communication

### State Flow

```
                    Zustand Store (AppState)
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    Layout.tsx      ChatView.tsx      CharacterList.tsx
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                 Services Layer (via hooks)
                           │
                    Data Storage Layer
```

### Hook Communication

```
useCharacters()
    ↓
Character Service → Vault Files
    ↓
Return: { characters, loading, error, addCharacter }

useDialogue()
    ↓
Dialogue Service → Vault Files
LLM Service → External APIs
Memory Service → BM25 Index
    ↓
Return: { messages, loading, error, sendMessage }

useLLM()
    ↓
Model Fetcher → Provider APIs
LLM Service → External APIs
    ↓
Return: { providers, models, selectedModel, generateResponse }
```

## Synchronization Points

### 1. Provider Selection
- User changes provider in settings
- Model Fetcher fetches available models
- Cache updated in plugin data
- Components notified via Zustand

### 2. Character Selection
- User selects character from dropdown
- Dialogue Service loads messages from vault
- Index Service rebuilds BM25 index
- ChatView displays messages

### 3. Message Creation
- User sends message
- LLM Service generates response
- Memory Service provides context (if enabled)
- Dialogue Service persists to vault
- Index Service updates metadata
- Zustand updates UI state

## Error Handling Strategy

```
Try Operation
    ↓
    ├─ Success → Update State → Update UI
    │
    └─ Error
         ↓
         ├─ Log to console
         ├─ Store error message in Zustand
         ├─ Show error UI (optional retry)
         └─ Preserve previous state
```

### Error Types

1. **Validation Errors**
   - Missing required fields
   - Invalid API key format
   - Model not found

2. **API Errors**
   - Rate limiting
   - Authentication failure
   - Network timeout
   - Provider unavailable

3. **Storage Errors**
   - File write failure
   - Vault access denied
   - Disk full

4. **Processing Errors**
   - PNG parsing failed
   - YAML parse error
   - Token estimation failure

## Performance Optimization

### 1. Component Optimization
- React.memo for MessageItem (re-rendered frequently)
- useCallback for event handlers
- Lazy loading of chat history (pagination)

### 2. State Management
- Zustand selectors for granular subscriptions
- Only re-render when subscribed state changes
- Avoid storing large nested objects

### 3. Memory System
- BM25 index built once per character
- Top-K retrieval limits search scope
- Memory extraction optional and configurable

### 4. Caching Strategy

**Model Cache**
- Cache models per provider in plugin data
- Refresh on user request (manual fetch)
- 24-hour auto-refresh (Phase 3)

**Avatar Cache**
- Convert to data URL on import
- Store as base64 in character metadata
- No re-fetching from disk

**Message Index**
- JSON metadata for quick lookup
- Rebuilt when character loads
- Incremental updates on new messages

## Scalability Considerations

### Message History Scaling
- Current: Load all messages for character
- Phase 3: Implement pagination (load latest N messages)
- Large conversations: Paginate at 100+ messages

### Character Count Scaling
- Current: Load all characters on startup
- Supported: 100+ characters with no performance issues
- Phase 3: Index characters for search

### Provider Support
- Currently: 5 provider types (OpenAI, Google, OpenRouter, Groq, Custom)
- Extensible: Add new providers in Provider Resolver switch
- Each provider has unique API, handled separately

## Security Architecture

### 1. API Key Management
```
User Input (Settings Form)
    ↓
Password Input Field (masked)
    ↓
Validation (format check only)
    ↓
Obsidian Plugin Data (encrypted at rest by Obsidian)
    ↓
Memory (never logged or exposed)
    ↓
API Request (HTTPS only)
```

### 2. Local-Only Data
- All conversation history stored in vault
- No cloud backup or sync
- No telemetry or analytics
- No external data transmission except to configured LLM APIs

### 3. HTTPS Enforcement
- All API calls use HTTPS
- Certificate validation enabled
- Custom endpoints validated

## Testing Architecture (Phase 3)

```
Unit Tests
├─ Utilities (BM25, slug, frontmatter)
├─ Provider resolver
├─ Settings migration
└─ Type validation

Integration Tests
├─ Plugin lifecycle
├─ Settings persistence
├─ Character import
├─ Message creation
└─ Memory extraction

End-to-End Tests (Manual)
├─ Multi-provider selection
├─ Character import from PNG
├─ Message streaming
├─ Mobile responsiveness
└─ Cross-platform compatibility
```

## Deployment Architecture

### Development
```
Local Obsidian Vault
    ↓
pnpm dev (watch mode)
    ↓
ESBuild watches src/
    ↓
Recompile on changes
    ↓
main.js updated
    ↓
Obsidian hot-reload (manual)
```

### Production
```
GitHub Repository
    ↓
pnpm build
    ↓
ESBuild minification
    ↓
main.js + manifest.json + styles.css
    ↓
GitHub Release
    ↓
BRAT Plugin Registry
    ↓
User Installation
```

## Future Architecture Enhancements (Phase 3+)

### Per-Character Configuration
```
Character Profile
    ├─ Unique provider selection
    ├─ Unique model selection
    ├─ Custom system prompt
    └─ Memory extraction settings
```

### Advanced Memory System
```
Memory Management
    ├─ Configurable extraction model
    ├─ Tunable BM25 parameters
    ├─ Fact extraction via LLM
    └─ Memory browser UI
```

### Conversation Branching
```
Message Tree
    ├─ Alternative responses
    ├─ Branch visualization
    ├─ Branch comparison
    └─ Branch merging
```

### Message Search
```
Search Index
    ├─ Full-text search
    ├─ Filter by date/role
    ├─ Search highlighting
    └─ Search results export
```

## Technical Debt & Improvements

### Current Limitations
1. No per-character provider selection (Phase 3)
2. No message pagination for large histories (Phase 3)
3. Limited error recovery options
4. No offline message drafting
5. No conversation export formats

### Performance Improvements (Phase 3)
1. Lazy load message history
2. Virtual scrolling for large lists
3. Debounce search input
4. Memoize BM25 index

### Feature Improvements (Phase 3)
1. Message search and filtering
2. Conversation branching visualization
3. Preset system UI
4. Advanced memory configuration
5. Voice input/output integration

## References

### Obsidian API
- Plugin registration and lifecycle
- Custom view types
- Vault file operations
- Plugin settings storage

### React Patterns
- Functional components with hooks
- Custom hooks for logic encapsulation
- Context for global state (considered, using Zustand instead)

### State Management (Zustand)
- Lightweight alternative to Redux
- Minimal boilerplate
- Direct state access with getState()
- Efficient subscriptions with selectors

### BM25 Algorithm
- Okapi BM25 for relevance ranking
- Probabilistic relevance model
- Industry standard for document search
- No external dependencies implementation

## Monitoring & Debugging

### Development
- Browser DevTools (console, network, performance)
- React DevTools for component inspection
- Obsidian console for plugin logs
- Zustand DevTools middleware (optional)

### Production
- Obsidian logs for error tracking
- Manual testing across platforms
- User-reported issues (GitHub)

## API Contract Documentation

### LLM Provider Interface
```typescript
interface ProviderAPI {
  generateCompletion(
    messages: Message[],
    options: LLMOptions
  ): Promise<{
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  }>;

  streamCompletion(
    messages: Message[],
    options: LLMOptions
  ): AsyncIterable<string>;

  fetchModels(): Promise<string[]>;
}
```

### Service Interfaces
```typescript
interface CharacterService {
  loadCharacters(): Promise<CharacterCard[]>;
  createCharacter(card: CharacterCard): Promise<void>;
  updateCharacter(id: string, card: Partial<CharacterCard>): Promise<void>;
  deleteCharacter(id: string): Promise<void>;
}

interface DialogueService {
  loadMessages(characterId: string): Promise<DialogueMessage[]>;
  createMessage(message: DialogueMessage): Promise<void>;
  deleteMessage(id: string): Promise<void>;
}
```

This architecture ensures maintainability, scalability, and clear separation of concerns across the TaleVault AI codebase.
