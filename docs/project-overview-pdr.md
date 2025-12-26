# TaleVault AI - Project Overview & PDR

**Document Version:** 2.0
**Last Updated:** 2025-12-26
**Current Phase:** Phase 2 Complete - Multi-Provider & Memory System
**Target Phase:** Phase 3 - Per-Character Settings & Advanced Features

## Executive Summary

TaleVault AI is an Obsidian plugin enabling AI-powered roleplay conversations using character cards and large language models (LLMs). It provides multi-provider LLM support (OpenAI, Google, OpenRouter, Groq, custom), character card import from PNG/SillyTavern format, and intelligent memory retrieval using BM25 search.

**Current Status:** Phase 2 complete. Plugin supports multiple LLM providers, auto model fetching, streaming responses, token tracking, and BM25-based memory extraction. Full React integration with responsive mobile-first UI.

## Product Requirements Document (PDR)

### Project Vision

Enable users to engage in interactive roleplay conversations with AI-powered character personas within Obsidian, maintaining conversation history and character profiles as part of their knowledge base, with flexibility to choose their preferred LLM provider and model.

### Core Objectives

1. **Plugin Infrastructure** - Obsidian plugin with settings, views, and lifecycle management ✓
2. **Multi-Provider LLM** - Support multiple LLM services with unified interface ✓
3. **Character Management** - Define, persist, and organize character profiles ✓
4. **Conversation System** - Track dialogue history with BM25-indexed memory ✓
5. **User Experience** - Intuitive UI for provider selection, character management, and chatting ✓

### Functional Requirements

#### FR-1: Plugin Initialization & Settings ✓
- [x] Plugin loads and unloads without errors
- [x] Settings persist to Obsidian storage
- [x] Provider management UI (add/edit/delete)
- [x] Settings validation and migration
- [x] Multi-provider configuration storage

**Acceptance Criteria:**
- Plugin appears in Obsidian plugin list
- Provider settings persist across restarts
- Settings tab displays all provider configuration fields
- API Keys masked for security
- Settings migration from v0.1 to v0.2 supported

#### FR-2: Custom Views & Navigation ✓
- [x] Custom chat view type registered
- [x] View accessible via ribbon icon
- [x] View accessible via command palette
- [x] View reuses existing instance if open
- [x] React UI fully integrated

**Acceptance Criteria:**
- Ribbon icon shows "Chat" on hover
- Clicking icon opens view on right side
- Command palette entry: "Open Chat"
- Only one view instance exists at a time
- View persists when switching between other views

#### FR-3: Multi-Provider LLM Support ✓
- [x] Provider abstraction layer for API calls
- [x] Support for OpenAI, Google, OpenRouter, Groq
- [x] Custom OpenAI-compatible endpoint support
- [x] Provider-specific model fetching
- [x] Automatic model discovery from provider APIs

**Acceptance Criteria:**
- Each provider has distinct API handling
- Models auto-fetched and cached per provider
- Provider type validation in settings
- Fallback to manual model entry if fetch fails
- Provider credentials securely stored

#### FR-4: Character Card Management ✓
- [x] Character card CRUD operations
- [x] PNG character card import (SillyTavern format)
- [x] YAML frontmatter parsing for metadata
- [x] Character avatar extraction and caching
- [x] Character list with dropdown selector

**Acceptance Criteria:**
- PNG cards extract metadata from EXIF data
- Character profiles include: name, description, personality, scenario, firstMessage
- Characters organized in slug-named folders
- Avatar images displayed correctly
- Character list accessible and filterable

#### FR-5: Dialogue & Message Management ✓
- [x] Message persistence to markdown files
- [x] Conversation history with chronological ordering
- [x] Message branching support via parentId
- [x] Token count tracking per message
- [x] Streaming response display

**Acceptance Criteria:**
- Messages stored as markdown in character folder structure
- Message index maintained in index.json
- Token counts displayed with messages
- Streaming updates UI in real-time
- Message timestamps and metadata preserved

#### FR-6: Memory System ✓
- [x] BM25 search indexing for past conversations
- [x] Automatic memory extraction service
- [x] Memory-to-prompt context inclusion
- [x] Configurable memory extraction model

**Acceptance Criteria:**
- BM25 index built from message history
- Top-K relevant messages retrieved per query
- Memory extraction service optional and configurable
- Extracted facts formatted for LLM context
- Memory system works offline and online

#### FR-7: Type System & Interfaces ✓
- [x] Complete TypeScript definitions
- [x] Provider configuration interfaces
- [x] Character card interfaces
- [x] Dialogue message interfaces
- [x] Memory extraction interfaces

**Acceptance Criteria:**
- All types exported from `types/index.ts`
- Type definitions match data storage format
- Strict TypeScript mode enabled
- No `any` types without justification
- Comprehensive type coverage

#### FR-8: Build System & Development ✓
- [x] TypeScript configuration with React support
- [x] ESBuild bundling with dev/prod modes
- [x] Development watch mode with sourcemaps
- [x] Production minification
- [x] Type checking script

**Acceptance Criteria:**
- `pnpm dev` starts watch mode without errors
- `pnpm build` generates minified main.js
- `pnpm typecheck` catches TypeScript errors
- Production build < 300KB
- Sourcemaps available in dev mode

#### FR-9: UI Components ✓
- [x] Chat view with message list
- [x] Message input with markdown support
- [x] LLM options panel (temperature, top-p, max tokens)
- [x] Character list with dropdown selector
- [x] Provider selection interface
- [x] Responsive mobile-first layout

**Acceptance Criteria:**
- Components render without errors
- Mobile UI responsive on all screen sizes
- Markdown formatting in messages works
- LLM options reflect in generated responses
- Character selector accessible and searchable

#### FR-10: Styling & Theme Support ✓
- [x] CSS framework with Obsidian theme variables
- [x] Responsive layout containers
- [x] Mobile-optimized component spacing
- [x] Dark/light mode automatic support

**Acceptance Criteria:**
- All colors use Obsidian CSS variables
- Layout works on desktop and mobile
- No hardcoded colors in CSS
- Consistent spacing and typography

### Non-Functional Requirements

#### NFR-1: Performance
- Plugin initialization < 500ms ✓
- Settings load/save < 100ms ✓
- BM25 indexing < 1s for 1000 messages ✓
- Message streaming updates > 20fps ✓

#### NFR-2: Compatibility
- Obsidian API version 1.11+ ✓
- Works on desktop and mobile ✓
- ES2018+ target for broad browser support ✓
- React 18.2+ integration complete ✓

#### NFR-3: Maintainability
- All code in TypeScript with strict mode ✓
- Comprehensive type definitions ✓
- Clear separation of concerns (services, hooks, components) ✓
- Documented patterns and standards ✓

#### NFR-4: Security
- API keys stored locally in Obsidian data folder ✓
- No keys exposed in console logs ✓
- API Key field uses password input type ✓
- No external network calls except to configured LLM APIs ✓

#### NFR-5: Scalability
- Plugin handles 100+ character profiles ✓
- Support for 1000+ conversation messages per character ✓
- BM25 indexing handles large history ✓
- Modular architecture for future extensions ✓

### Implementation Constraints

**Technology Stack:**
- Runtime: Obsidian API, Electron
- Language: TypeScript 5.3+
- Framework: React 18.2+
- State Management: Zustand 4.4+
- Build Tool: ESBuild 0.19+
- Parser: YAML 2.8.2 (browser-compatible)

**Environment:**
- Node.js 18+ for development
- macOS, Windows, Linux support
- Obsidian 1.0+ required

**Data Storage:**
- Character profiles: YAML frontmatter + markdown content
- Dialogue messages: Nested file structure
- Settings: Obsidian plugin data.json
- Message index: JSON files per character

### Dependencies & External Services

**Build-time:**
- obsidian, @types/node, @types/react, builtin-modules
- esbuild, typescript

**Runtime:**
- react, react-dom: UI rendering
- zustand: Global state management
- yaml: YAML parsing (browser-compatible)
- uuid: UUID generation

**External Services:**
- OpenAI API (configurable endpoint)
- Google Gemini API (optional)
- OpenRouter API (optional)
- Groq API (optional)
- Custom OpenAI-compatible endpoints (optional)

### Phase Breakdown

#### Phase 1: Plugin Setup (COMPLETE - v0.1.0)
- Plugin scaffold and Obsidian integration
- Settings system and persistence
- Custom view registration
- Type definitions and constants
- Build configuration
- CSS framework

#### Phase 2: UI, LLM Integration & Memory (COMPLETE - v0.2.0)
- React component hierarchy for roleplay interface ✓
- Multi-provider LLM support with provider abstraction ✓
- Character card CRUD operations ✓
- Character card PNG import with metadata extraction ✓
- Dialogue message rendering and history ✓
- LLM API integration with streaming responses ✓
- Message input and streaming response display ✓
- Character selection sidebar with dropdown ✓
- Token tracking per message ✓
- BM25 memory system with extraction ✓
- Model fetching from provider APIs ✓
- Mobile-optimized UI with responsive design ✓

#### Phase 3: Per-Character Config & Advanced Features (UPCOMING)
- Per-character LLM provider/model selection
- Per-character system prompt customization
- Conversation branching visualization
- Character relationship mapping
- Advanced memory configuration (extraction model, top-K, threshold)
- Preset management UI
- Message search and filtering
- Conversation export/import

#### Phase 4: Future Extensions
- Voice input/output integration
- Image generation with LLM
- Conversation analysis and summarization
- Custom prompt engineering tools
- Plugin marketplace integration
- Community character sharing

### Testing Strategy

#### Unit Testing (Phase 3)
- Provider resolution and API handling
- BM25 search accuracy
- Character card parsing
- Message formatting and storage
- Utility functions (UUID, slug generation)

#### Integration Testing (Phase 3)
- Plugin initialization and lifecycle
- Settings tab interaction and persistence
- View activation and deactivation
- Provider API communication
- Character import and message creation
- Memory extraction and context inclusion

#### Manual Testing (Ongoing)
- Plugin enable/disable in Obsidian
- Settings persistence across restarts
- View creation and reuse
- Cross-platform (macOS, Windows, Linux)
- Mobile responsiveness
- LLM streaming responses
- Character card import from various sources

### Success Metrics

**Phase 2 (Current):**
- [x] Plugin loads without errors
- [x] Settings persist and migrate properly
- [x] TypeScript compiles with strict mode
- [x] Build process works for dev/prod
- [x] Multi-provider LLM support functional
- [x] Character CRUD operations working
- [x] LLM responses generated and displayed
- [x] Conversation history persisted
- [x] UI responsive on desktop and mobile
- [x] Zero console errors/warnings
- [x] BM25 memory system functional
- [x] Model fetching from APIs functional

**Phase 3 (Target):**
- [ ] Per-character provider/model selection
- [ ] Advanced memory configuration UI
- [ ] Message search and filtering
- [ ] Conversation branching visualization
- [ ] Unit and integration test coverage > 80%

**Overall:**
- Plugin adoption by Obsidian community
- < 2 second plugin load time
- Positive user ratings and reviews
- Stable multi-provider support

### Known Limitations & Future Considerations

**Current Limitations:**
- No per-character provider/model selection (Phase 3)
- No conversation branching visualization (Phase 3)
- Memory extraction model must be configured separately
- No voice integration

**Future Considerations:**
- Voice input/output integration
- Image generation with LLM
- Conversation analysis and summarization
- Custom prompt engineering tools
- Plugin marketplace integration
- Multi-character conversations

### Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Obsidian API changes | Medium | Low | Monitor Obsidian changelog, version constraints |
| LLM API rate limiting | Medium | Medium | Implement request queuing, user warnings |
| Large conversation histories | High | Medium | Implement pagination, BM25 indexing |
| API key exposure | High | Low | Use password field, never log keys |
| Performance degradation | Medium | Low | Monitor bundle size, lazy load components |
| Provider API outages | Medium | High | Graceful error handling, fallback messaging |

### Acceptance Criteria - Overall

**Phase 2 Completion (v0.2.0):**
- [x] Plugin successfully registers with Obsidian
- [x] Multi-provider LLM configuration works
- [x] Character card import and management functional
- [x] Dialogue system with message persistence functional
- [x] BM25 memory system operational
- [x] Token tracking displays correctly
- [x] Mobile UI responsive and usable
- [x] Streaming responses display in real-time
- [x] TypeScript compilation succeeds
- [x] Build produces valid plugin output
- [x] Documentation of architecture and standards complete

**Phase 3 Pre-requisites:**
- [ ] Per-character settings architecture designed
- [ ] Advanced memory configuration UI planned
- [ ] Message search and filtering requirements defined
- [ ] Conversation branching visualization designed

### Roadmap Timeline

**Phase 1 (Complete - v0.1.0):** Core infrastructure and plugin setup
- **Duration:** Week 1
- **Status:** DONE

**Phase 2 (Complete - v0.2.0):** Multi-provider LLM, character management, memory system
- **Duration:** Weeks 2-3
- **Status:** DONE
- **Deliverables:** Multi-provider support, character CRUD, BM25 memory, streaming responses, token tracking

**Phase 3 (Upcoming):** Advanced features and per-character config
- **Duration:** Weeks 4-5
- **Estimated:** January 2026
- **Deliverables:** Per-character settings, message search, branching visualization, advanced memory config

**Phase 4+ (Future):** Extended integrations and optimizations
- **Estimated:** February 2026+
- **Deliverables:** Voice integration, image generation, conversation analysis

## Document Change Log

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-12-26 | Phase 2 completion - Multi-provider, memory system, mobile UI |
| 1.0 | 2025-12-25 | Initial document - Phase 1 completion |

## Stakeholders & Contact

- **Project Lead:** Sourman / sourman-dev
- **Repository:** https://github.com/sourman-dev/obsidian-talevault-ai
- **Platform:** Obsidian Marketplace

## Appendix: Technical Specifications

### Plugin Manifest
```json
{
  "id": "mianix-roleplay",
  "name": "TaleVault AI",
  "version": "0.2.0",
  "minAppVersion": "1.0.0",
  "description": "AI roleplay with character cards and LLM integration",
  "author": "Sourman",
  "authorUrl": "https://github.com/sourman-dev",
  "isDesktopOnly": false
}
```

### Build Output Specifications
- **Format:** CommonJS (Obsidian compatible)
- **Target:** ES2018
- **Minification:** Production only
- **Sourcemaps:** Inline (dev), none (prod)
- **Bundling:** All dependencies except Obsidian internals

### Provider Configuration Structure
```typescript
interface ProviderConfig {
  id: string;              // UUID
  name: string;            // "OpenAI", "Google", etc.
  type: ProviderType;      // 'openai' | 'google' | 'openrouter' | 'groq' | 'custom'
  apiKey: string;          // Stored locally, never transmitted
  baseUrl?: string;        // Custom endpoint URL (optional)
  createdAt: string;       // ISO timestamp
}

type ProviderType = 'openai' | 'google' | 'openrouter' | 'groq' | 'custom';
```

### File Organization Standards
- One class per file (exceptions: closely related interfaces)
- Type definitions centralized in `types/` subdirectory
- Services in `services/` with single responsibility
- Components in `components/` with feature subdirectories
- Hooks in `hooks/` with `use-` prefix
- Utilities in `utils/` with specific naming

### Message Storage Format
```markdown
---
id: {uuid}
role: user|assistant
timestamp: {iso-timestamp}
inputTokens: {number}
outputTokens: {number}
parentId: {uuid-optional}
---

{message content}
```
