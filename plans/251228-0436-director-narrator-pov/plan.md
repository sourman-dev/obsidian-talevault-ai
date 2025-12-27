---
title: "Director-Narrator POV Architecture"
description: "2-agent system to solve omniscient narrator leak problem"
status: pending
priority: P1
effort: 8h
branch: master
tags: [architecture, llm, pov, narrator, director]
created: 2025-12-28
---

# Director-Narrator POV Architecture

## Background

### Problem Statement

Current single-prompt approach causes "omniscient narrator leak" where LLM makes characters "read" each other's thoughts (>50% frequency):

1. **AI character knows User's thoughts** - AI writes internal monologue of user character
2. **NPC A knows NPC B's hidden thoughts** - Secret motivations leak between characters
3. **Multi-POV descriptions mix chaotically** - No clear boundaries between perspectives

### Solution

Implement 2-agent system with proper POV isolation:
- **Director Agent**: Omniscient, decides WHAT happens (action-only, NO internal thoughts)
- **Narrator Agent**: POV-filtered, writes HOW scene unfolds from selected POV

### Trade-offs

| Pros | Cons |
|------|------|
| Clean separation: Director = what, Narrator = how | 2 LLM calls per turn (acceptable per user) |
| Switchable POV with proper isolation | More complex than single-prompt |
| Extensible for future features | Director prompt needs careful engineering |

---

## Architecture Overview

### Flow Per Turn

```
User Input + POV Mode Selection
         │
         ▼
┌────────────────────────────────────────┐
│ DIRECTOR AGENT (Call #1)               │
│ Context: ALL character info            │
│ Output: Markdown scene instructions    │
│   - Observable actions only            │
│   - NO internal thoughts               │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ CONTEXT FILTER                         │
│ Fixed/Switchable: current_pov only     │
│ Any: all chars + strict markers        │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ NARRATOR AGENT (Call #2)               │
│ Context: Filtered based on POV mode    │
│ Output: Final roleplay response        │
└────────────────────────────────────────┘
```

### 3 POV Modes

| Mode | Description | Director Context | Narrator Context |
|------|-------------|------------------|------------------|
| **Fixed** | User = 1 character | All chars | Only user char info |
| **Switchable** | User picks char per turn | All chars | Selected char only |
| **Any** | Multi-POV with markers | All chars | All chars + strict markers |

---

## Implementation Phases

### Phase 1: Core Director-Narrator Split (4h)

#### 1.1 Types Extension

**File:** `src/types/index.ts`

Add POV mode types:
```typescript
// After line 117 (after LLMOptions interface)
export type POVMode = 'fixed' | 'switchable' | 'any';

export interface POVOptions {
  mode: POVMode;
  /** Character ID for POV in fixed/switchable mode */
  povCharacterId?: string;
}

// Extend LLMOptions (line 113-117)
export interface LLMOptions {
  temperature: number;
  topP: number;
  responseLength: number;
  povOptions?: POVOptions; // NEW
}

// Extend DialogueSession (line 119-125)
export interface DialogueSession {
  id: string;
  characterId: string;
  createdAt: string;
  llmOptions: LLMOptions;
  povOptions?: POVOptions; // NEW - store session POV preference
}
```

#### 1.2 Director Service

**File:** `src/services/director-service.ts` (NEW)

```typescript
/**
 * Director Agent - decides WHAT happens in the story
 * Outputs action-only scene instructions (no internal thoughts)
 */
export class DirectorService {
  constructor(private settings: MianixSettings) {}

  /** Build Director system prompt */
  buildDirectorPrompt(character: CharacterCardWithPath, context?: LLMContext): string

  /** Build Director user prompt with scene context */
  buildDirectorUserPrompt(messages: DialogueMessageWithContent[]): string

  /** Generate scene instructions (non-streaming, internal use) */
  async generateSceneInstructions(
    character: CharacterCardWithPath,
    messages: DialogueMessageWithContent[],
    context?: LLMContext
  ): Promise<string>
}
```

**Director Prompt Template:**
```markdown
## Role: Story Director
You are an omniscient director who knows everything about all characters.
Your job is to decide WHAT HAPPENS, not how it's described.

## Output Format
Describe the scene in terms of:
- Physical actions characters take
- Dialogue spoken aloud
- Events that occur (sounds, environment)

## CRITICAL RULES
- NEVER write internal thoughts of any character
- NEVER reveal hidden motivations
- Only describe OBSERVABLE actions
- If user marked [secret], acknowledge it exists but don't expose content

## Current Scene
[world state, all character info, history]

## Your Direction
What happens next in this scene?
```

#### 1.3 Context Filter

**File:** `src/services/context-filter-service.ts` (NEW)

```typescript
/**
 * Filters Director output for Narrator based on POV mode
 */
export class ContextFilterService {
  /**
   * Filter context for Fixed/Switchable POV
   * Returns only what the POV character can observe
   */
  filterForSinglePOV(
    directorOutput: string,
    povCharacterId: string,
    allCharacters: CharacterCardWithPath[]
  ): string

  /**
   * Add POV markers for Any mode
   * Returns full context with strict marker rules
   */
  formatForAnyPOV(
    directorOutput: string,
    allCharacters: CharacterCardWithPath[]
  ): string
}
```

#### 1.4 Narrator Service Enhancement

**File:** `src/services/llm-service.ts`

Modify `buildSystemPrompt()` to accept POV context:

```typescript
// Line 111-157: Modify buildSystemPrompt signature
buildSystemPrompt(
  character: CharacterCardWithPath,
  presets: LoadedPresets,
  context?: LLMContext,
  povOptions?: POVOptions,           // NEW
  directorInstructions?: string      // NEW - from Director output
): string {
  // ... existing logic ...

  // NEW: Inject Director instructions before character info
  if (directorInstructions) {
    parts.push('\n\n---\n## Scene Direction\n');
    parts.push(directorInstructions);
  }

  // NEW: Inject POV-specific rules
  if (povOptions?.mode === 'fixed' || povOptions?.mode === 'switchable') {
    parts.push('\n\n---\n## POV Rules\n');
    parts.push(`You are writing from ${character.name}'s perspective ONLY.`);
    parts.push('You CANNOT know others\' thoughts or hidden actions.');
  }

  // ... rest of existing logic ...
}
```

#### 1.5 Director Preset

**File:** `src/presets/default-presets.ts`

Add new constant after line 108:

```typescript
export const DEFAULT_DIRECTOR_PROMPT = `## Role: Story Director
You are an omniscient director who knows everything about all characters.
Your job is to decide WHAT HAPPENS, not how it's described.

## Output Format
Describe the scene in terms of:
- Physical actions characters take
- Dialogue spoken aloud
- Events that occur (sounds, environment, sensory details)

## CRITICAL RULES
1. NEVER write internal thoughts of any character
2. NEVER reveal hidden motivations or secrets
3. Only describe OBSERVABLE actions
4. Keep descriptions concise (50-100 words max)

## What happens next in this scene?`;

// Update DEFAULT_PRESETS map
export const DEFAULT_PRESETS: Record<string, string> = {
  'multi-mode-prompt.md': DEFAULT_MULTI_MODE_PROMPT,
  'chain-of-thought-prompt.md': DEFAULT_CHAIN_OF_THOUGHT_PROMPT,
  'output-structure-prompt.md': DEFAULT_OUTPUT_STRUCTURE_PROMPT,
  'output-format-prompt.md': DEFAULT_OUTPUT_FORMAT_PROMPT,
  'director-prompt.md': DEFAULT_DIRECTOR_PROMPT, // NEW
};
```

**File:** `src/presets/index.ts`

Add to PRESET_FILES:

```typescript
export const PRESET_FILES = {
  MULTI_MODE: 'multi-mode-prompt.md',
  CHAIN_OF_THOUGHT: 'chain-of-thought-prompt.md',
  OUTPUT_STRUCTURE: 'output-structure-prompt.md',
  OUTPUT_FORMAT: 'output-format-prompt.md',
  DIRECTOR: 'director-prompt.md', // NEW
} as const;
```

#### 1.6 Two-Call Flow in use-llm.ts

**File:** `src/hooks/use-llm.ts`

Modify `generateResponse()` (line 51-148):

```typescript
const generateResponse = useCallback(
  async (
    character: CharacterCardWithPath,
    messages: DialogueMessageWithContent[],
    onComplete: (content: string, response?: LLMResponse) => Promise<void>,
    llmOptions: LLMOptions = DEFAULT_LLM_OPTIONS
  ) => {
    // ... existing setup ...

    try {
      const presets = await presetService.loadAllPresets();
      const context: LLMContext = { /* ... existing logic ... */ };

      let directorInstructions: string | undefined;

      // NEW: Director call if POV enabled
      if (llmOptions.povOptions?.mode) {
        const directorService = new DirectorService(settings);
        directorInstructions = await directorService.generateSceneInstructions(
          character,
          recentMessages,
          context
        );

        // NEW: Filter context based on POV mode
        if (llmOptions.povOptions.mode !== 'any') {
          const filterService = new ContextFilterService();
          directorInstructions = filterService.filterForSinglePOV(
            directorInstructions,
            llmOptions.povOptions.povCharacterId || character.id,
            [character] // TODO: Pass all characters in multi-char support
          );
        }
      }

      // Narrator call (existing chatStream logic)
      const response = await llmService.chatStream(
        character,
        recentMessages,
        onChunk,
        presets,
        llmOptions,
        context,
        undefined, // characterOverride
        directorInstructions // NEW param
      );

      // ... rest of existing logic ...
    }
  }
);
```

---

### Phase 2: UI Integration (2h)

#### 2.1 POV Mode Selector Component (Mobile-First)

**File:** `src/components/chat/POVModeSelector.tsx` (NEW)

**Design Requirements (iPhone 13 Pro primary):**
- Touch target: min 44x44px (iOS HIG)
- Single-tap cycle through modes (no dropdown on mobile)
- Visual indicator: icon + short label
- Haptic feedback hint via CSS animation

```typescript
interface POVModeSelectorProps {
  povOptions: POVOptions;
  onChange: (options: POVOptions) => void;
  disabled?: boolean;
}

const POV_MODES: { mode: POVMode; icon: string; label: string }[] = [
  { mode: 'fixed', icon: '👁️', label: 'Fixed' },
  { mode: 'switchable', icon: '🔄', label: 'Switch' },
  { mode: 'any', icon: '👥', label: 'Any' },
];

export function POVModeSelector({ povOptions, onChange, disabled }: POVModeSelectorProps) {
  const currentIndex = POV_MODES.findIndex(m => m.mode === povOptions.mode);
  const current = POV_MODES[currentIndex];

  const cycleMode = () => {
    const nextIndex = (currentIndex + 1) % POV_MODES.length;
    onChange({ ...povOptions, mode: POV_MODES[nextIndex].mode });
  };

  return (
    <button
      className="mianix-pov-toggle"
      onClick={cycleMode}
      disabled={disabled}
      title={`POV: ${current.label} (tap to change)`}
    >
      <span className="mianix-pov-icon">{current.icon}</span>
      <span className="mianix-pov-label">{current.label}</span>
    </button>
  );
}
```

**Mobile UX Pattern:**
- Tap cycles: Fixed → Switch → Any → Fixed
- Long-press (future): Opens detailed panel with character picker for Switchable mode
- Compact: Icon only on narrow screens, Icon+Label on wider

#### 2.2 ChatView Integration

**File:** `src/components/chat/ChatView.tsx`

Add state and UI (around line 314-330):

```typescript
// New state (after line 47)
const [povOptions, setPovOptions] = useState<POVOptions>({ mode: 'fixed' });

// In header actions (line 314-330)
<div className="mianix-chat-header-actions">
  {settings.enableStats && <StatsPanel ... />}
  <LorebookIndicator ... />
  <POVModeSelector                        {/* NEW */}
    povOptions={povOptions}
    onChange={setPovOptions}
    disabled={isBusy}
  />
  <LLMOptionsPanel ... />
</div>

// Pass POV to generateResponse (line 185-209)
await generateResponse(
  character,
  messagesWithUser,
  async (responseContent, llmResponse) => { ... },
  { ...llmOptions, povOptions } // Include POV options
);
```

#### 2.3 CSS Styles (Mobile-First)

**File:** `styles.css`

```css
/* POV Selector - Mobile First */
.mianix-pov-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mianix-pov-toggle:hover {
  background: var(--background-modifier-hover);
}

.mianix-pov-toggle:active {
  transform: scale(0.95);
}

.mianix-pov-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mianix-pov-icon {
  font-size: 16px;
  line-height: 1;
}

.mianix-pov-label {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

/* Mobile: Icon only */
@media (max-width: 400px) {
  .mianix-pov-label {
    display: none;
  }
  .mianix-pov-toggle {
    padding: 8px;
  }
}

/* Touch devices: larger touch target */
@media (hover: none) {
  .mianix-pov-toggle {
    min-width: 48px;
    min-height: 48px;
  }
}
```

---

### Phase 3: Advanced Features (2h)

#### 3.1 Secret Tag Support

**Syntax:** `[secret]A nghĩ: cô ta không biết kế hoạch của tôi[/secret]`

**Processing:**
- Director: See and acknowledge secrets exist, but don't expose
- Fixed/Switchable POV: Secrets shown to reader, hidden from other chars
- Any POV: Each POV sees only their own char's secrets

**Implementation:**
```typescript
// In ContextFilterService
extractSecrets(content: string): { publicContent: string; secrets: Map<string, string[]> }
injectSecretsForPOV(content: string, povCharacterId: string, secrets: Map<string, string[]>): string
```

#### 3.2 Director Output Debug Panel

Optional feature: Show Director output in collapsible panel for debugging/transparency.

**File:** `src/components/chat/DirectorDebugPanel.tsx` (NEW)

```typescript
interface DirectorDebugPanelProps {
  content: string | null;
  isVisible: boolean;
}
```

#### 3.3 POV Persistence

Store POV options per dialogue session:

**File:** `src/hooks/use-dialogue.ts`

- Load POV options from `session.json`
- Save POV changes to session
- Default to `fixed` mode

---

## File Changes Summary

| File | Action | Lines |
|------|--------|-------|
| `src/types/index.ts` | Modify | +20 lines (POVMode, POVOptions) |
| `src/services/director-service.ts` | Create | ~80 lines |
| `src/services/context-filter-service.ts` | Create | ~60 lines |
| `src/services/llm-service.ts` | Modify | +30 lines (buildSystemPrompt, chatStream) |
| `src/hooks/use-llm.ts` | Modify | +25 lines (generateResponse) |
| `src/presets/default-presets.ts` | Modify | +25 lines (Director prompt) |
| `src/presets/index.ts` | Modify | +1 line |
| `src/components/chat/POVModeSelector.tsx` | Create | ~50 lines |
| `src/components/chat/ChatView.tsx` | Modify | +15 lines |
| `styles.css` | Modify | +20 lines |

**Total:** ~4 new files, ~6 modified files, ~300 lines added

---

## Testing Strategy

### Unit Tests

1. **DirectorService**
   - `buildDirectorPrompt()` includes correct rules
   - `generateSceneInstructions()` returns action-only output

2. **ContextFilterService**
   - `filterForSinglePOV()` removes other chars' internal info
   - `formatForAnyPOV()` adds correct markers

### Integration Tests

1. **Two-Call Flow**
   - Director → Filter → Narrator produces coherent output
   - POV isolation works (no thought leakage)

2. **UI Tests**
   - POV selector changes mode correctly
   - Mode persists across session

### Manual Testing

1. Create scenario with 2+ characters with secrets
2. Test Fixed POV: Character A shouldn't know B's thoughts
3. Test Any POV: Markers separate perspectives correctly
4. Measure: POV leak rate should drop from >50% to <10%

---

## Success Criteria

1. **POV Leak Rate**: <10% (down from >50%)
2. **User Satisfaction**: No manual corrections needed for POV issues
3. **Response Quality**: Maintains creativity while respecting boundaries
4. **Performance**: 2-call latency acceptable (<3s additional)

---

## Open Questions

1. **Director output visibility**: Should users see Director output for debugging?
2. **Peek mode**: How to handle when user explicitly wants to see other char's mind?
3. **Cache strategy**: Cache Director output when user switches POV without new input?
4. **Multi-character support**: Phase 2 of broader project - out of scope for initial implementation

---

## Implementation Order

```
Phase 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 (sequential, core foundation)
Phase 2.1 → 2.2 → 2.3 (parallel possible)
Phase 3.1 → 3.2 → 3.3 (optional, after validation)
```

**Recommended approach:** Complete Phase 1, test thoroughly, then proceed to Phase 2.
