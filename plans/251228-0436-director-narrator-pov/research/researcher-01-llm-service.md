# LLM Service Implementation Research

## Current Prompt Building Flow

**Entry Point**: `buildMessages()` (line 225-242 in llm-service.ts)
- Returns 2-message format: `[system, user]`
- Aligns with mianix-userscript convention

**System Prompt** (`buildSystemPrompt()`): 5 sequential sections:
1. Multi-mode roleplay prompt (from presets)
2. Long-term memories (BM25 search results)
3. Lorebook entries (world info, keyword-triggered)
4. Character stats (RPG stats)
5. Character card info (name, description, personality, scenario)

**User Prompt** (`buildUserPrompt()`): 6 sequential sections:
1. Dialogue examples (placeholder, not yet implemented)
2. Chain of Thought instructions
3. Output structure guide
4. Chat history (formatted as text blocks)
5. Current user input / "Your Turn" section
6. Output format with responseLength substitution

## Multi-Mode Prompt Usage

Currently implemented in `default-presets.ts`:
- **Single 4-mask system** (White/Gray/Black masks + universal rules)
- 3 emotional levels: Safe → Ambiguous → Explicit
- Delivered as-is in line 119: `parts.push(presets.multiModePrompt)`
- NO conditional selection - entire prompt always included
- All 3 masks always available to LLM regardless of context

## Director/Narrator Split Injection Points

### Primary: Modify `buildSystemPrompt()`
**Location**: Line 111-157, specifically line 119
- Replace single `multiModePrompt` with **dynamic selection logic**
- Add `LLMContext` parameter to include tone hints (optional)
- Decision: Include Director mask for narrative shaping, Narrator mask for character voice

### Secondary: Update `default-presets.ts`
- Split current prompt into separate presets:
  - `directorPrompt` (narrative control, pacing, event introduction)
  - `narratorPrompt` (character voice, mask selection, response generation)
- Keep existing format for backward compatibility

### Optional: Enhance `LoadedPresets` interface
- **Current** (line 27-33): 4 presets (multiMode, chainOfThought, outputStructure, outputFormat)
- **Proposed**: Add optional fields for granular control:
  ```ts
  directorPrompt?: string;
  narratorPrompt?: string;
  useSplitMode?: boolean;
  ```

## Key Functions to Modify

| Function | File | Purpose | Changes |
|----------|------|---------|---------|
| `buildSystemPrompt()` | llm-service.ts:111 | Build system message | Add mask selection logic, inject director/narrator split |
| `buildMessages()` | llm-service.ts:225 | Assemble message array | May pass additional context flags |
| `LoadedPresets` | llm-service.ts:27 | Interface definition | Add optional director/narrator fields |
| Preset loading | plugin entry point | Load presets from vault | Load split presets if `useSplitMode` enabled |

## Integration Points for Director/Narrator

1. **System prompt (line 119)**: Replace single `multiModePrompt` with branching logic
   - Director section: Guides pacing, event flow, narrative development
   - Narrator section: Emphasizes mask selection and character voice

2. **Chat history context (line 191-197)**: No changes - both Director and Narrator need this

3. **Output format (line 206-211)**: May need director-specific guidance on scene transition

## Unresolved Questions

- Should Director and Narrator be mutually exclusive or layered?
- Does LLMContext need new fields for tone/pacing hints?
- Should split mode be: opt-in setting, per-character flag, or per-message override?
- How to handle backwards compatibility with single-mode presets?
