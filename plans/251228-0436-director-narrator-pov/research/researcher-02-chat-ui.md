# Chat UI Research - Director/Narrator POV Integration

## Current Chat Flow

**User Input → LLM → Response → File Storage**

1. User types message in `MessageInput` → `ChatView.handleSend()`
2. `sendMessage()` (use-dialogue hook) → appends message to dialogue file system
3. `generateResponse()` (use-llm hook) → calls LLM service with full context
4. Response callback creates assistant message + parses "Gợi ý" suggestions
5. Messages stored as files in `/characters/{id}/messages/`

**Key components:**
- `ChatView.tsx` (lines 178-210): Main send handler
- `useDialogue.ts`: Message persistence + LLM options state
- `useLlm.ts`: Response generation (streaming support)

## Where to Add POV Mode Selector

**Location: Chat header (next to LLMOptionsPanel)**
- Line 314-330 in ChatView.tsx: Header action buttons area
- Pattern matches existing toggle buttons (⚙️ for settings, stats panel)
- Recommended: New dropdown or toggle button next to ⚙️

**Implementation approach:**
```
<div className="mianix-chat-header-actions">
  <StatsPanel ... />
  <LorebookIndicator ... />
  <POVModeSelector povMode={povMode} onChange={setPovMode} /> <!-- NEW -->
  <LLMOptionsPanel ... />
</div>
```

## Integrating Character Selector for Switchable POV

**Switchable POV requires character picker:**

1. **Add POV character state to ChatView:**
   ```typescript
   const [povMode, setPovMode] = useState<'first' | 'second' | 'switchable'>('first');
   const [selectedPOVCharacter, setSelectedPOVCharacter] = useState<CharacterCardWithPath | null>(null);
   ```

2. **Character selector component (new):**
   - Modal/dropdown to select character when povMode === 'switchable'
   - Display all characters from CharacterService.list()
   - Store selection in LLM options or separate state
   - Render in header or inline in input area

3. **Pass POV info to generateResponse():**
   - Extend `LLMOptions` type to include `povMode` and `povCharacterId`
   - Pass via `generateResponse(character, messages, callback, llmOptions)`
   - Use in system prompt generation (LLM service layer)

## Existing Patterns to Follow

### 1. Settings Panel Pattern (LLMOptionsPanel.tsx)
- Collapsible button + panel with internal state
- onChange callback passes updated config to parent
- Disabled state during generation
- Each option renders label + control + value display

### 2. State Management
- Component state: `useState()` for local UI toggles
- Persistent options: Stored in `useDialogue()` → dialogue session file
- Flow: Parent (ChatView) → Hook (useDialogue) → LLMOptions in DialogueSession

### 3. Message Flow Integration
- LLMOptions already passed to `generateResponse()` at line 208
- Safe to extend LLMOptions type with POV fields
- Backend (LLM service) reads these options when building prompts

### 4. Accessibility & UX
- Match button styles from existing header buttons (⚙️, 📊, 📖)
- Use emoji or icon for visual consistency
- Disable during `isBusy` (isLoading || isGenerating)
- Tooltip hints for clarity

## Technical Implementation Checklist

- [ ] Extend `LLMOptions` in types/index.ts (add povMode, povCharacterId)
- [ ] Create `POVModeSelector.tsx` component (dropdown/toggle)
- [ ] Create `POVCharacterPicker.tsx` (modal for character selection)
- [ ] Update `ChatView.tsx` header to include selectors
- [ ] Modify `generateResponse()` call to pass POV options
- [ ] Update `LLM service` to use POV in system prompt
- [ ] Store POV settings in dialogue session.json
- [ ] Add CSS classes for new components

## File Locations

- **Chat UI:** `/src/components/chat/ChatView.tsx` (lines 314-330)
- **Settings pattern:** `/src/components/chat/LLMOptionsPanel.tsx`
- **Types:** `/src/types/index.ts` (LLMOptions interface)
- **Dialogue state:** `/src/hooks/use-dialogue.ts` (LLMOptions management)
- **LLM service:** `/src/services/llm-service.ts` (system prompt generation)

## Unresolved Questions

- Should POV mode be stored per-session or global?
- Should "Switchable POV" allow mid-conversation switching without message loss?
- How to represent narrator/director POV in generated response (prompt prefix only)?
