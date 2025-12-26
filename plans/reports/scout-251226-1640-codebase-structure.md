# Codebase Scout Report - Mianix Roleplay Plugin

**Date**: 2025-12-26  
**Status**: Complete  
**Scale**: Thorough  
**Format**: TypeScript/TSX + React

---

## Executive Summary

Comprehensive audit of 40+ TypeScript/TSX files across the Mianix Roleplay plugin codebase. Plugin implements AI-powered roleplay via OpenAI-compatible APIs with character card management, message persistence, and BM25-based memory search.

**Architecture Layers**:
- Entry Point: Plugin lifecycle & workspace integration
- Services Layer: LLM API, dialogue management, character CRUD, memory extraction
- Hooks Layer: Dialogue, characters, LLM state management
- Components Layer: React UI (chat, character list, settings)
- Utilities: PNG parsing, frontmatter, slugs, BM25 search
- Type System: Provider, memory, character, dialogue definitions

---

## Core Files

### 1. Plugin Entry Point & Configuration

**File**: `/src/main.ts`
- **Exports**: `MianixRoleplayPlugin` (extends Obsidian Plugin)
- **Key Methods**:
  - `onload()`: Registers custom view, ribbon icon, settings tab, commands
  - `activateView()`: Opens/reuses roleplay view in workspace
  - `loadSettings()/saveSettings()`: Persists settings with migration
  - `presetService.initializePresets()`: Creates default prompts on first load
- **Dependencies**: Obsidian, constants, settings-migration, preset-service
- **Lifecycle**: Load settings → initialize presets → register view → add UI

**File**: `/src/constants.ts`
- **Exports**: 
  - `VIEW_TYPE_ROLEPLAY`: 'mianix-roleplay-view'
  - `PLUGIN_ID`: 'mianix-roleplay'
  - `MIANIX_BASE_FOLDER`: 'tale-vault'
  - `CHARACTERS_FOLDER`: 'tale-vault/character-cards'
  - `PRESETS_FOLDER`: 'tale-vault/presets'
- **Purpose**: Centralized constants for view registration and folder paths

**File**: `/src/settings-tab.ts`
- **Exports**: `MianixSettingTab` (extends Obsidian PluginSettingTab)
- **Sections**:
  - Provider list management (add/edit/delete with confirmation)
  - Default model selection (cascading dropdowns for text/extraction)
  - Memory extraction toggle
  - Preset reset functionality
- **Key Features**:
  - Populates model dropdowns from provider's cached/fetched models
  - Auto-fetches models from provider API
  - Shows provider badge and default model
  - Warns on deletion if provider used as default
- **Dependencies**: ModelFetcherService, ProviderModal

### 2. Type System & Interfaces

**File**: `/src/types/index.ts`
- **Core Exports**:
  - `MianixSettings`: Plugin settings with providers array, defaults object, memory extraction flag
  - `CharacterCard`: ID, name, avatar, description, personality, scenario, firstMessage, createdAt
  - `CharacterCardWithPath`: CharacterCard + folderPath, filePath, avatarUrl
  - `CharacterFormData`: Form input (name, description, personality, scenario, firstMessage)
  - `DialogueMessage`: ID, role (user|assistant), parentId, timestamp, suggestions, token tracking
  - `DialogueMessageWithContent`: DialogueMessage + content + filePath
  - `DialogueSession`: ID, characterId, createdAt, llmOptions
  - `LLMOptions`: temperature, topP, responseLength
  - `MessageTokenUsage`: providerId, model, inputTokens, outputTokens
  - `AppContextType`: app, settings, saveSettings callback
- **Default Settings**: Multi-provider empty, legacy fallback to OpenAI

**File**: `/src/types/provider.ts`
- **Types**:
  - `ModelType`: 'text' | 'extraction' | 'image'
  - `AuthHeaderType`: 'bearer' | 'x-goog-api-key' | 'x-api-key' | 'api-key'
  - `LLMProvider`: id, name, baseUrl, apiKey, defaultModel, authHeader, presetId
  - `ModelReference`: providerId, model
  - `ProviderPreset`: id, name, baseUrl, modelsEndpoint, authHeader, suggestedModels
- **Purpose**: Multi-provider LLM support with preset templates

**File**: `/src/types/memory.ts`
- **Exports**:
  - `MessageIndexEntry`: id, role, timestamp, preview (100 chars)
  - `CharacterIndex`: messageCount, lastUpdated, messages[], memories[]
  - `EMPTY_INDEX`: Template for new character indexes
- **Purpose**: Fast message lookup and BM25 memory storage

### 3. Context & State Management

**File**: `/src/context/app-context.tsx`
- **Exports**:
  - `AppProvider`: Context provider component
  - `useApp()`: Hook to access app, settings, saveSettings
  - `useVault()`: Hook to access app.vault
  - `useSettings()`: Hook to access settings and saveSettings
- **Context Value**: { app: Obsidian App, settings, saveSettings }
- **Usage**: Wraps entire React app to inject Obsidian API

**File**: `/src/store/index.ts`
- **Exports**: `useRoleplayStore` (Zustand store)
- **State**:
  - `characters`: CharacterCardWithPath[]
  - `currentCharacter`: Selected character
  - `currentDialogueId`: Current dialogue (nullable)
  - `messages`: DialogueMessageWithContent[]
  - `isLoading`, `error`: UI state
- **Actions**: setCharacters, setCurrentCharacter, setMessages, addMessage, setLoading, setError, reset
- **Purpose**: Global UI state for character selection and message list

### 4. Hooks (React State Management)

**File**: `/src/hooks/use-characters.ts`
- **Exports**: `useCharacters()` hook
- **State**: characters (from store), isLoading, error
- **Methods**:
  - `loadCharacters()`: Fetches list from CharacterService
  - `createCharacter(data)`: Creates new character, updates store
  - `updateCharacter(folderPath, data)`: Updates existing character
  - `deleteCharacter(folderPath)`: Deletes character folder
  - `importFromPng(arrayBuffer)`: Parses PNG character card
  - `reload()`: Refreshes character list
- **Dependencies**: CharacterService, store

**File**: `/src/hooks/use-dialogue.ts`
- **Exports**: `useDialogue(character)` hook
- **State**: messages, llmOptions, error, isLoading (from store)
- **Load Behavior**: Loads dialogue on character change, initializes session if missing
- **Methods**:
  - `sendMessage(content)`: Appends user message to dialogue
  - `addAssistantMessage(content, tokenUsage)`: Appends AI response
  - `editMessage(filePath, content)`: Updates message content
  - `saveSuggestions(filePath, suggestions)`: Stores suggested prompts
  - `deleteMessage(filePath)`: Deletes single message
  - `deleteMessagesFrom(filePath)`: Deletes message and all after (for regenerate)
  - `updateLLMOptions(options)`: Updates session LLM settings
- **Key Pattern**: Uses `store.getState()` to avoid stale closures
- **Dependencies**: DialogueService, store

**File**: `/src/hooks/use-llm.ts`
- **Exports**: `useLlm()` hook
- **State**: isGenerating, error, streamingContent (local state)
- **Methods**:
  - `generateResponse(character, messages, onComplete, llmOptions)`: Main LLM call
  - `isConfigured()`: Checks if provider is set up
  - `runMemoryExtraction(...)`: Async memory extraction (non-blocking)
  - `clearError()`: Dismisses error
- **Flow**:
  1. Loads presets from vault
  2. Searches relevant memories via BM25
  3. Calls LLM with streaming
  4. Runs memory extraction in background
  5. Calls onComplete callback with token tracking
- **Dependencies**: LlmService, PresetService, DialogueService, MemoryExtractionService, provider-resolver

### 5. Services

**File**: `/src/services/character-service.ts`
- **Class**: `CharacterService`
- **Constructor**: Takes Obsidian App instance
- **Methods**:
  - `list()`: Lists all characters from CHARACTERS_FOLDER, sorted by createdAt
  - `read(folderPath)`: Reads single character by path
  - `create(data)`: Creates character folder with card.md and session/index files
  - `update(folderPath, data)`: Updates character metadata
  - `delete(folderPath)`: Moves character folder to trash
  - `importFromPng(arrayBuffer)`: Extracts PNG metadata, saves avatar, initializes session
- **Key Pattern**: Auto-creates missing folders using `ensureFolderExists`
- **File Structure**: Each character gets {slug}/ → card.md, avatar.png, session.json, index.json, messages/

**File**: `/src/services/dialogue-service.ts`
- **Class**: `DialogueService`
- **Constructor**: Initializes IndexService internally
- **Core Methods**:
  - `initializeSession(folderPath, characterId)`: Creates session.json with LLM options
  - `loadSession(folderPath)`: Reads session.json
  - `updateLLMOptions(folderPath, options)`: Updates session.json
  - `loadMessages(folderPath)`: Lists all message files (001.md, 002.md, ...)
  - `loadDialogue(folderPath)`: Loads session + messages combined
  - `createFirstMessage(folderPath, content)`: Creates initial assistant message
  - `appendMessage(folderPath, role, content, parentId, tokenUsage)`: Adds message file
  - `updateMessageContent(filePath, content)`: Updates message body (preserves metadata)
  - `updateMessageSuggestions(filePath, suggestions)`: Adds/updates suggestions in frontmatter
  - `deleteMessage(filePath)`: Deletes message file
  - `deleteMessagesFrom(folderPath, filePath)`: Deletes message and all after it
  - `getRecentMessages(folderPath, count)`: Efficient recent message loading
  - `searchMemories(folderPath, query, limit)`: BM25 search via IndexService
- **Message Numbering**: Sequential 001.md, 002.md format for ordering
- **Metadata Storage**: YAML frontmatter with id, role, timestamp, suggestions, token tracking
- **Dependency**: Uses IndexService for memory management

**File**: `/src/services/llm-service.ts`
- **Class**: `LlmService`
- **Constructor**: Takes MianixSettings
- **Methods**:
  - `buildSystemPrompt(character, presets, llmOptions, context)`: Constructs system message with character info + memories + output format
  - `buildMessages(character, dialogueMessages, presets, llmOptions, context)`: Builds message array for API
  - `chat(...)`: Non-streaming completion
  - `chatStream(character, messages, onChunk, presets, llmOptions, context)`: Streaming completion with chunk callback
- **Streaming**: Parses Server-Sent Events, handles `[DONE]` marker, extracts usage from final chunk
- **Fallback**: Uses legacy settings if new multi-provider system not configured
- **Exports**: LLMResponse with content, usage, providerId, model
- **Dependencies**: provider-resolver for auth headers

**File**: `/src/services/preset-service.ts`
- **Class**: `PresetService`
- **Methods**:
  - `initializePresets()`: Creates missing preset files from defaults on plugin load
  - `resetPresets()`: Overwrites all presets to default values
  - `loadPreset(fileName)`: Reads single preset file
  - `loadMultiModePrompt()`: Loads multi-mode roleplay prompt
  - `loadOutputFormatPrompt()`: Loads output format prompt
  - `loadAllPresets()`: Parallel load of all presets
- **Storage**: PRESETS_FOLDER/multi-mode-prompt.md + output-format-prompt.md
- **Purpose**: Global system prompts editable by users

**File**: `/src/services/index-service.ts`
- **Class**: `IndexService`
- **Constructor**: Initializes with App instance, has internal caches
- **Methods**:
  - `loadIndex(folderPath)`: Loads index.json with caching
  - `saveIndex(folderPath, index)`: Writes index.json and updates caches
  - `addMessageToIndex(folderPath, message)`: Appends message entry
  - `removeMessageFromIndex(folderPath, messageId)`: Removes message entry
  - `addMemory(folderPath, memory)`: Adds memory with keyword extraction
  - `searchMemories(folderPath, query, limit)`: BM25 search wrapper
  - `getRecentMessageIds(folderPath, count)`: Efficient ID lookup
  - `clearCache(folderPath)`: Cache invalidation
- **Caching**: Maintains two caches - index (JSON) and BM25 (search object)
- **Index Structure**: { messageCount, lastUpdated, messages[], memories[] }

**File**: `/src/services/memory-extraction-service.ts`
- **Class**: `MemoryExtractionService`
- **Constructor**: Takes MianixSettings
- **Methods**:
  - `extractMemories(userMsg, aiMsg, sourceMessageId)`: Calls extraction LLM, parses JSON array
  - `callLLM(prompt)`: Internal API call with low temperature (0.1)
  - `getExtractionConfig()`: Resolution order: extraction provider → text provider → legacy
  - `getAuthHeaders()`: Auth headers based on provider type
  - `parseResponse(response)`: Parses JSON array, handles markdown code blocks
- **Prompt**: Vietnamese/English hybrid, extracts facts/events/preferences/relationships
- **Output Format**: [{ content, type, importance (0-1) }]
- **Error Handling**: Silent logging, doesn't block UI

**File**: `/src/services/model-fetcher.ts`
- **Class**: `ModelFetcherService` (singleton as `modelFetcher`)
- **Methods**:
  - `fetchModels(provider, forceRefresh)`: Fetches models from provider API
  - `parseModels(data, presetId)`: Handles OpenAI, Google, array formats
  - `getCached(provider)`: Returns cached models if fresh (30min TTL)
  - `clearCache(provider)`: Invalidates single provider cache
  - `clearAllCache()`: Clears all caches
- **Cache Key**: ${baseUrl}-${apiKey.slice(-4)}
- **Provider-Specific Parsing**:
  - OpenAI/Groq/OpenRouter: { data: [{ id, name }] }
  - Google: { models: [{ name, displayName }] }
  - Array fallback: [{ id, name }]
- **Used By**: SettingsTab for model dropdown population

### 6. React Components

**File**: `/src/views/roleplay-view.tsx`
- **Class**: `RoleplayView` (extends Obsidian ItemView)
- **Methods**:
  - `getViewType()`: Returns 'mianix-roleplay-view'
  - `getDisplayText()`: Returns 'Mianix Roleplay'
  - `getIcon()`: Returns 'message-square'
  - `onOpen()`: Creates React root, renders App component with AppProvider
  - `onClose()`: Unmounts React root to prevent memory leaks
- **Purpose**: Obsidian view container for React UI
- **Pattern**: StrictMode + AppProvider wrapping App component

**File**: `/src/components/App.tsx`
- **Exports**: `App()` functional component
- **Renders**: Error banner, Layout with MainContent, loading indicator
- **State**: Uses store for isLoading, error, setError
- **Error Display**: Dismissible error banner at top

**File**: `/src/components/Layout.tsx`
- **Exports**: `Layout()` and `MainContent()` components
- **Layout Structure**: Two-column (sidebar + main)
  - Sidebar: CharacterList component
  - Main: MainContent area with ChatView
- **Responsive**: Uses CSS classes .mianix-layout, .mianix-sidebar, .mianix-main

**File**: `/src/components/characters/CharacterList.tsx`
- **Exports**: `CharacterList()` component
- **Features**:
  - Character dropdown selector
  - Import PNG button with file input
  - Create new button opens CharacterForm modal
  - Edit/delete buttons for selected character
  - Delete confirmation modal
  - Import error display
- **State**: Form open, editing character, delete confirm, import error, submitting
- **Hooks**: useCharacters, useRoleplayStore
- **Flow**: Import PNG → CharacterService → reload list → set as current

**File**: `/src/components/characters/CharacterForm.tsx`
- **Exports**: `CharacterForm()` component
- **Fields**: name, description, personality, scenario, firstMessage
- **Validation**: Name is required
- **Props**: initialData (for edit), onSubmit, onCancel, isSubmitting
- **Usage**: Create mode vs Edit mode determined by initialData presence

**File**: `/src/components/chat/ChatView.tsx`
- **Exports**: `ChatView(character)` component
- **Key Features**:
  - Message list with auto-scroll to bottom
  - Streaming response display with typing indicator
  - User messages shown as text, assistant messages as file links (mobile-optimized)
  - LLM options panel (temperature, topP, responseLength)
  - Suggestions dropdown (Vietnamese "Gợi ý")
  - Message actions: edit, regenerate, delete
  - Token usage tracking display
- **Message Actions**:
  - Latest user message: regenerate + delete
  - Assistant messages: delete (except first)
  - Edit inline with save/cancel
- **Suggestion Parsing**: Extracts from LLM output pattern `[action1] [action2]` or numbered list
- **Hooks**: useDialogue, useLlm, useApp
- **Auto-scroll**: useEffect on messages, streamingContent, isGenerating
- **Error Handling**: Display both dialogue and LLM errors separately

**File**: `/src/components/chat/MessageList.tsx`
- **Exports**: `MessageList()` component (less-used wrapper)
- **Props**: messages, character, isLoading, streamingContent, handlers (onEdit, onDelete, onRegenerate)
- **Renders**: MessageItem components + streaming indicator
- **Note**: ChatView implements its own message rendering, this is alternative

**File**: `/src/components/chat/MessageItem.tsx`
- **Exports**: `MessageItem()` component
- **Features**:
  - Inline message editing with save/cancel
  - Character avatar (assistant only)
  - Timestamp display
  - Edit button for all messages
  - Regenerate button for last assistant message
  - Delete button for non-first messages
- **Edit State**: Textarea with full message content
- **Non-Edit State**: Display content or file link preview (40 chars for mobile)

**File**: `/src/components/chat/MessageInput.tsx`
- **Exports**: `MessageInput()` component
- **Features**:
  - Textarea with auto-height (max 120px)
  - Send button (➤ emoji)
  - Enter to send (Shift+Enter for newline)
  - Supports controlled or uncontrolled mode
  - Disable state handling
- **Props**: onSend, disabled, placeholder, value, onChange
- **Keyboard**: Ctrl+Enter or plain Enter sends message

**File**: `/src/components/chat/LLMOptionsPanel.tsx`
- **Exports**: `LLMOptionsPanel()` component
- **Features**: Collapsible settings panel in chat header
- **Options**:
  - Temperature (0-2, step 0.1)
  - Top P (0-1, step 0.05)
  - Response Length (100-2000 words, step 50)
- **Display**: Shows current values next to sliders
- **Props**: options, onChange, disabled

**File**: `/src/components/ui/Modal.tsx`
- **Exports**: `Modal()` component
- **Features**:
  - Overlay click closes modal
  - Escape key closes
  - Header with title and close button
  - Body content slot
- **Props**: isOpen, onClose, title, children

**File**: `/src/components/provider-modal.ts`
- **Class**: `ProviderModal` (extends Obsidian Modal, not React)
- **Purpose**: Add/edit LLM provider configuration
- **Features**:
  - Preset dropdown with auto-fill
  - Manual name, baseUrl, apiKey inputs
  - Fetch models button (dynamic dropdown)
  - Manual model input fallback
  - Validation: name uniqueness, URL format
  - Error messages with specific feedback (401, 404, network)
- **Flow**: Select preset → auto-fill → test credentials → fetch models → save

### 7. Utilities

**File**: `/src/utils/bm25.ts`
- **Exports**: `BM25Search` class, `tokenize()`, `extractKeywords()`
- **BM25Search**:
  - `setMemories(memories)`: Build corpus
  - `search(query, limit, minScore)`: Returns top matching MemoryEntry[]
  - Uses BM25 formula with K1=1.5, B=0.75
  - Boosts score by importance factor (0.5 + importance * 0.5)
- **Tokenization**: 
  - Lowercases, normalizes Vietnamese Unicode (NFC)
  - Removes punctuation and stopwords (Vietnamese + English)
  - Filters tokens > 1 char
- **Keywords**: Extracted and deduplicated for memory storage

**File**: `/src/utils/png-parser.ts`
- **Exports**: `parsePngCharacterCard()`, `CharacterCardData` interface, `readFileAsArrayBuffer()`
- **Parsing**:
  - Verifies PNG signature
  - Scans tEXt/iTXt chunks for 'chara' keyword
  - Decodes base64-encoded JSON
  - Handles V1, V2, tavern formats
  - Normalizes to standard format
- **Output**: { name, description, personality, scenario, first_mes, mes_example, creator_notes, etc. }
- **Error Handling**: Silent null return on invalid files

**File**: `/src/utils/avatar.ts`
- **Exports**: `loadAvatarAsDataUrl()`, `getAvatarResourceUrl()`
- **Data URL Method**: Reads binary file → base64 → data:image/png;base64,... (used for mobile)
- **MIME Types**: Supports PNG, JPG, GIF, WebP, SVG
- **Resource URL Method**: Uses Obsidian's vault resource path (alternative for desktop)
- **Error Handling**: Silent undefined return on missing files

**File**: `/src/utils/frontmatter.ts`
- **Exports**: `parseFrontmatter()`, `stringifyFrontmatter()`, interfaces
- **Regex**: `/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/`
- **Parser**: Uses `yaml` package for YAML parsing/stringification
- **Output Format**: `---\n${yaml}\n---\n${content}`
- **Config**: No line wrapping, double-quoted strings, literal block quotes
- **Replaces**: gray-matter (Node.js-only) for browser compatibility

**File**: `/src/utils/slug.ts`
- **Exports**: `generateSlug()`, `generateUniqueSlug()`
- **Transliteration**: Maps Vietnamese (ă → a, ư → u, đ → d), German (ä → ae), etc.
- **Process**:
  1. Normalize NFD + remove diacritical marks
  2. Apply custom char mapping
  3. Lowercase, remove non-word chars, replace spaces with hyphens
  4. Collapse multiple hyphens
  5. Trim edges
- **Uniqueness**: Appends base36 timestamp (e.g., `character-m5x7k`)
- **Fallback**: If transliteration empty (CJK-only), uses `character-${timestamp}`

**File**: `/src/utils/provider-resolver.ts`
- **Exports**: `resolveProvider()`, `buildAuthHeaders()`, `isMultiProviderConfigured()`
- **Resolution Chain** for model type:
  1. Character-level override
  2. Global default (settings.defaults[modelType])
  3. For extraction: fallback to text provider
  4. First provider as ultimate fallback
- **Auth Headers**: Switches on provider.authHeader type (bearer, x-goog-api-key, x-api-key, api-key)
- **isMultiProviderConfigured()**: True if providers exist and text default set
- **Interfaces**: ResolvedProvider, ModelOverrides (character-level)

**File**: `/src/utils/settings-migration.ts`
- **Exports**: `migrateSettings()`, `getDefaultSettings()`, `mergeWithDefaults()`
- **Migration**: Detects preset from baseUrl, preserves API keys, creates LLMProvider[] from legacy config
- **Preset Detection**: Pattern matching for OpenAI, Google, OpenRouter, Groq, custom
- **Extraction Provider**: Same provider as text (different model) or separate provider
- **Legacy Fallback**: Keeps old format fields for backward compatibility
- **Default Settings**: Multi-provider empty with legacy OpenAI defaults

### 8. Constants & Presets

**File**: `/src/constants/provider-presets.ts`
- **Exports**: `PROVIDER_PRESETS[]`, `getPresetById()`
- **Presets** (5):
  1. OpenAI: bearer auth, /models endpoint, suggests gpt-4o, gpt-4-turbo, gpt-4o-mini
  2. Google AI: x-goog-api-key, /models, suggests gemini-2.0-flash-exp, gemini-1.5-pro
  3. OpenRouter: bearer, /models, suggests claude-3.5-sonnet, gemini-2.0-flash, deepseek
  4. Groq: bearer, /models, suggests llama-3.3-70b, mixtral-8x7b
  5. Custom: Empty baseUrl, bearer, for user-configured endpoints
- **Preset Structure**: id, name, baseUrl, modelsEndpoint, authHeader, suggestedModels

**File**: `/src/presets/index.ts`
- **Exports**: `DEFAULT_LLM_OPTIONS`, `PRESET_FILES`
- **Default LLM Options**: temperature: 0.8, topP: 0.9, responseLength: 800
- **Preset Files**: MULTI_MODE: 'multi-mode-prompt.md', OUTPUT_FORMAT: 'output-format-prompt.md'

**File**: `/src/presets/default-presets.ts`
- **Exports**: `DEFAULT_PRESETS` (object with preset file contents)
- **Multi-Mode Prompt**: Roleplay system prompt in Vietnamese
- **Output Format Prompt**: Response formatting guidelines with word count placeholder

---

## Component Hierarchy

```
App
├── Error Banner (conditional)
├── Layout
│   ├── Sidebar
│   │   └── CharacterList
│   │       ├── Character Dropdown
│   │       ├── Import Button
│   │       ├── Create Button
│   │       ├── CharacterForm Modal
│   │       └── Delete Confirmation Modal
│   └── Main
│       └── ChatView
│           ├── Chat Header
│           │   ├── Avatar
│           │   ├── Character Name
│           │   └── LLMOptionsPanel
│           ├── Message List
│           │   ├── MessageItem (user)
│           │   ├── MessageItem (assistant)
│           │   └── Streaming Indicator
│           ├── Suggestions Dropdown
│           └── MessageInput
└── Loading Indicator (conditional)
```

---

## Data Flow

### Message Send Flow
1. User types in MessageInput → updates state
2. User presses Enter → onSend callback
3. ChatView.handleSend() called
4. DialogueService.appendMessage(user message) → creates 001.md, 002.md, etc.
5. useDialogue updates messages array in store
6. UI re-renders with new user message
7. useLlm.generateResponse() called
8. LlmService builds messages array (includes system prompt + memories)
9. Fetches /chat/completions with streaming
10. onChunk callback streams content to UI
11. useLlm.addAssistantMessage() saves to 003.md (if 001-002 exist)
12. Parses suggestions from response
13. DialogueService.updateMessageSuggestions() saves to frontmatter
14. Memory extraction runs async in background

### Character Import Flow
1. User clicks import button
2. File input onChange → handleFileSelect
3. Check file type is PNG
4. File.arrayBuffer() → ArrayBuffer
5. CharacterService.importFromPng(buffer)
6. parsePngCharacterCard() extracts metadata
7. Creates folder structure: characters/{slug}/*
8. Saves avatar.png as binary
9. Creates card.md with character YAML frontmatter
10. DialogueService.initializeSession() creates session.json
11. DialogueService.createFirstMessage() creates first assistant message
12. loadAvatarAsDataUrl() converts avatar to data URL
13. CharacterList.reload() refreshes list
14. setCurrentCharacter() activates conversation

### Memory Extraction (Async Background)
1. LLM response saved to message file
2. useLlm.runMemoryExtraction() called (non-blocking)
3. MemoryExtractionService.extractMemories() calls LLM with extraction prompt
4. Parses JSON array of { content, type, importance }
5. IndexService.addMemory() for each extracted item
6. BM25Search index updated
7. Next user query will include relevant memories in system prompt

---

## Key Dependencies

### External Libraries
- `obsidian@^1.11.0`: Obsidian Plugin API
- `react@^18.2.0`, `react-dom@^18.2.0`: UI framework
- `zustand@^4.4.0`: State management
- `yaml@latest`: YAML parsing (browser-compatible)
- `uuid@^9.0.0`: UUID generation
- `builtin-modules@^3.3.0`: Build configuration

### Internal Service Dependencies
```
LlmService ← PresetService, provider-resolver
useLlm ← LlmService, MemoryExtractionService, DialogueService, PresetService
ChatView ← useLlm, useDialogue
useDialogue ← DialogueService
DialogueService ← IndexService
IndexService ← BM25Search
MemoryExtractionService ← provider-resolver
ModelFetcherService (singleton)
CharacterService ← DialogueService, avatar, png-parser, frontmatter, slug
SettingsTab ← ModelFetcherService, ProviderModal
```

---

## File Structure on Disk

```
/src
├── main.ts                              # Plugin entry point
├── constants.ts                         # View & folder constants
├── settings-tab.ts                      # Settings UI
├── context/
│   └── app-context.tsx                  # Obsidian app + settings context
├── store/
│   └── index.ts                         # Zustand state store
├── types/
│   ├── index.ts                         # Core types (character, dialogue, settings)
│   ├── provider.ts                      # Multi-provider types
│   └── memory.ts                        # Index & memory types
├── hooks/
│   ├── use-characters.ts                # Character CRUD hook
│   ├── use-dialogue.ts                  # Message management hook
│   └── use-llm.ts                       # LLM response generation hook
├── services/
│   ├── character-service.ts             # Character CRUD ops
│   ├── dialogue-service.ts              # Message persistence & loading
│   ├── llm-service.ts                   # OpenAI-compatible API calls
│   ├── preset-service.ts                # Global prompt management
│   ├── index-service.ts                 # Message index + BM25
│   ├── memory-extraction-service.ts     # LLM-based fact extraction
│   └── model-fetcher.ts                 # Provider model discovery
├── components/
│   ├── App.tsx                          # Root component
│   ├── Layout.tsx                       # Main layout (sidebar + content)
│   ├── characters/
│   │   ├── CharacterList.tsx            # Character selector + import
│   │   └── CharacterForm.tsx            # Create/edit form
│   ├── chat/
│   │   ├── ChatView.tsx                 # Main chat interface
│   │   ├── MessageList.tsx              # Message display (alt)
│   │   ├── MessageItem.tsx              # Individual message
│   │   ├── MessageInput.tsx             # Text input box
│   │   └── LLMOptionsPanel.tsx          # Temperature/topP settings
│   ├── ui/
│   │   └── Modal.tsx                    # Modal dialog
│   ├── provider-modal.ts                # Provider config modal
│   └── roleplay-view.tsx                # Obsidian view container
├── utils/
│   ├── bm25.ts                          # BM25 search algorithm
│   ├── png-parser.ts                    # PNG metadata extraction
│   ├── avatar.ts                        # Avatar image loading
│   ├── frontmatter.ts                   # YAML frontmatter parsing
│   ├── slug.ts                          # URL-safe slug generation
│   ├── provider-resolver.ts             # Provider resolution logic
│   └── settings-migration.ts            # Legacy settings upgrade
├── constants/
│   └── provider-presets.ts              # Provider templates (OpenAI, Google, etc.)
└── presets/
    ├── index.ts                         # Default options & file names
    └── default-presets.ts               # Prompt content
```

---

## Vault Storage Structure

```
Vault/
└── tale-vault/
    ├── character-cards/
    │   └── alice-m5x7k/
    │       ├── card.md                  # Character metadata (YAML frontmatter)
    │       ├── avatar.png               # Character image
    │       ├── session.json             # LLM options for this character
    │       ├── index.json               # Message count, memories index
    │       └── messages/
    │           ├── 001.md               # First assistant message (if exists)
    │           ├── 002.md               # First user message
    │           ├── 003.md               # AI response
    │           └── ...
    └── presets/
        ├── multi-mode-prompt.md         # Roleplay system prompt
        └── output-format-prompt.md      # Response formatting guide
```

---

## Type Definitions Quick Reference

| Type | Purpose | Key Fields |
|------|---------|-----------|
| MianixSettings | Plugin config | providers[], defaults, enableMemoryExtraction, legacy llm |
| LLMProvider | Provider config | id, name, baseUrl, apiKey, defaultModel, authHeader |
| CharacterCard | Character metadata | id, name, avatar, description, personality, scenario, firstMessage |
| DialogueMessage | Message metadata | id, role, parentId, timestamp, suggestions, token tracking |
| DialogueSession | Session config | id, characterId, llmOptions |
| LLMOptions | Per-session LLM config | temperature, topP, responseLength |
| CharacterIndex | Message index | messageCount, lastUpdated, messages[], memories[] |
| MemoryEntry | Extracted fact | id, content, type, importance, keywords, sourceMessageId |

---

## Key Patterns & Conventions

### State Management
- **Global**: Zustand store for UI (characters, current, messages)
- **Context**: Obsidian App + settings via React context
- **Local**: Component useState for forms, modals, loading states
- **Async**: Hooks manage service calls, errors, loading

### File Operations
- **YAML Frontmatter**: Character & message metadata
- **Sequential Numbering**: 001.md, 002.md for message ordering
- **Folder as DB**: No database—vault IS the database
- **Auto-create**: ensureFolderExists() for missing folders

### API Integration
- **OpenAI-compatible**: Single endpoint format for multiple providers
- **Auth Flexibility**: 4 header types (bearer, x-goog-api-key, etc.)
- **Streaming**: Server-Sent Events with chunk callbacks
- **Usage Tracking**: Token counts in message frontmatter

### Memory System
- **BM25 Search**: Pure JS implementation, no external library
- **Extraction**: Separate LLM call with low temperature (0.1)
- **Index**: Fast lookup without reading all messages
- **Background**: Non-blocking async extraction

### Component Design
- **Functional**: All React components are functional (hooks-based)
- **Props**: Explicit prop interfaces
- **Handlers**: Callback props for parent-child communication
- **Controlled/Uncontrolled**: Flexible input components

---

## Unresolved Questions / Notes

1. **Mobile Avatar Loading**: Uses data URLs for Obsidian Mobile compatibility—alternative resource URLs available for desktop
2. **Character-Level Model Overrides**: Type system prepared (ModelOverrides) but not yet UI-exposed in character config
3. **Message Branching**: parentId field exists but no UI for branching conversations (tree structure in progress)
4. **Preset Editing**: Users can edit preset files directly in vault but no UI editor built yet
5. **Streaming Response History**: Streaming content not persisted separately; only final response saved
6. **Provider-Level Rate Limiting**: No built-in rate limiting; delegated to provider APIs
7. **Offline Support**: Requires live API connection; no offline draft mode

