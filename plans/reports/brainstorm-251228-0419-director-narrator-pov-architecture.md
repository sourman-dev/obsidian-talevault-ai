# Brainstorm Report: Director-Narrator POV Architecture

**Date**: 2025-12-28
**Problem**: Omniscient narrator leak - LLM makes characters "read" each other's thoughts

---

## Problem Statement

Current single-prompt approach causes:
1. AI character knows User's thoughts (>50% frequency)
2. NPC A knows NPC B's hidden thoughts
3. Multi-POV descriptions mix chaotically

User wants **switchable POV** with **Any POV mode** for controlling multiple characters.

---

## Research: Talemate Architecture

Key insights from Talemate codebase:

### 1. Agent Separation
- **Director**: Omniscient, decides WHAT happens (no internal thoughts in output)
- **Narrator**: Describes scene, NO internal thoughts, NO dialogue
- **Conversation**: Per-character dialogue with strict POV rules

### 2. Critical Prompt Rules (from `dialogue-narrative.jinja2`)

```
**CRITICAL - Character Focus**:
- You are ONLY writing for {{ talking_character.name }}
- NEVER write dialogue for other characters
- NEVER describe other characters' actions, thoughts, or reactions
```

```
**PERSPECTIVE**: Match the narrative perspective...
- The character whose turn it is to act does NOT automatically become the narrator
```

### 3. Narrator Rules (from `narrate-scene.jinja2`)

```
Focus on describing... You must not include any character's internal thoughts, feelings, or dialogue.
```

---

## Proposed Architecture

### 3 POV Modes

| Mode | Description | Director Context | Narrator Context |
|------|-------------|------------------|------------------|
| **Fixed POV** | User = 1 character | All chars | Only user char info |
| **Switchable POV** | User switch giữa chars | All chars | Selected char only |
| **Any POV** | User control nhiều chars | All chars | All chars + strict markers |

### Flow Per Turn

```
User Input + POV Mode Selection (manual via UI)
        │
        ▼
┌────────────────────────────────────────────┐
│ DIRECTOR AGENT (Call #1)                   │
│                                            │
│ Context: ALL character info (omniscient)   │
│ Task: Determine what happens next          │
│ Output: Markdown scene instructions        │
│   - Observable actions only                │
│   - NO internal thoughts                   │
│   - Events, dialogue spoken aloud          │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────┐
│ CONTEXT FILTER                             │
│                                            │
│ if mode == "fixed" or "switchable":        │
│   - Filter to current_pov char only        │
│   - Include only what char can observe     │
│ if mode == "any":                          │
│   - Include all chars                      │
│   - Add strict marker rules                │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────┐
│ NARRATOR AGENT (Call #2)                   │
│                                            │
│ Context: Filtered based on POV mode        │
│ Task: Write scene from selected POV        │
│ Output: Final roleplay response            │
└────────────────────────────────────────────┘
```

### User-Controlled Secrets

User marks secrets in input with `[secret]` tag:
```
[secret]A nghĩ: cô ta không biết kế hoạch của tôi[/secret]
A mỉm cười với B.
```

- Fixed/Switchable POV: Secrets shown to reader, hidden from other chars
- Any POV: All POVs see secrets of their own char only

---

## Prompt Design

### Director Agent Prompt

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

### Narrator Agent Prompt (Fixed/Switchable POV)

```markdown
## Role: You are {character_name}
You experience this story from YOUR perspective only.

## What You Know
- Your memories: [filtered memories]
- Your relationships: [your view of others]
- What you can observe: [director's scene output]

## CRITICAL RULES
- Write ONLY what you personally experience
- You CANNOT know others' thoughts or hidden actions
- If someone hides something, you don't know it
- Match the story's existing tense and perspective

## Write your response
```

### Narrator Agent Prompt (Any POV)

```markdown
## Role: Omniscient Narrator with POV Markers
You may write from multiple perspectives.

## CRITICAL RULES
1. SEPARATE each POV with clear markers:
   > [Character's POV] their experience...
2. One paragraph = one POV only
3. Character A CANNOT react to B's internal thoughts
4. Hidden thoughts stay hidden until revealed through action

## Example Format
> [A's POV] *She studied B's expression, wondering what he was hiding.*

> [B's POV] *He kept his face neutral, aware of her scrutiny.*

A said, "Everything alright?"

## Write your response
```

---

## Data Structure Changes

### `/{slug}/characters/` Directory

```
/{slug}/
├── card.md                 # Main character (backward compat)
├── characters/
│   ├── alice.md            # Frontmatter: id, name, description, personality
│   │                       # + ## Memories section
│   │                       # + ## Secrets section (user-defined)
│   ├── bob.md
│   └── _relationships.json # Relationship graph
└── dialogues/
```

### Character File Structure

```yaml
---
id: uuid
name: Alice
description: A mysterious woman...
personality: Cautious, observant...
is_player: false
---

## Memories
- Met Bob at the cafe last week
- Knows about the hidden treasure

## Secrets
- Plans to betray Bob
- Has a fake identity
```

### Relationships JSON

```json
{
  "alice": {
    "bob": {
      "type": "acquaintance",
      "trust": 3,
      "alice_knows": ["bob's job", "bob's favorite food"],
      "notes": "Alice suspects Bob is hiding something"
    }
  },
  "bob": {
    "alice": {
      "type": "acquaintance",
      "trust": 7,
      "bob_knows": ["alice's name", "alice's appearance"],
      "notes": "Bob trusts Alice completely"
    }
  }
}
```

---

## Implementation Considerations

### 1. API Cost
- 2 LLM calls per turn (acceptable per user)
- Director call có thể cache nếu user re-generate với POV khác

### 2. UI Changes
- POV mode selector (Fixed / Switchable / Any)
- Character selector dropdown (for Switchable mode)
- Secret tag helper in input

### 3. Phased Implementation

**Phase 1**: Core Director-Narrator split
- Add Director agent with action-only output
- Add POV mode to settings
- Context filter based on POV

**Phase 2**: Multi-character support
- `/{slug}/characters/` directory structure
- Character CRUD UI
- Relationship management

**Phase 3**: Advanced features
- Secret tagging system
- Relationship-aware memory retrieval
- Auto-POV detection (future)

---

## Trade-offs

### Pros
- Clean separation: Director = what, Narrator = how
- Switchable POV with proper isolation
- Any POV with structured markers
- Extensible for future features

### Cons
- 2 LLM calls per turn (cost)
- More complex than current single-prompt
- Director prompt needs careful engineering
- UI complexity increases

---

## Success Metrics

1. **POV Leak Rate**: <10% (down from >50%)
2. **User Satisfaction**: No manual corrections needed for POV issues
3. **Response Quality**: Maintains creativity while respecting boundaries

---

## Open Questions

1. Should Director output be visible to user for debugging?
2. How to handle when user explicitly wants to "peek" into other char's mind?
3. Cache strategy for Director output when switching POV?

---

## Next Steps

- [ ] Create detailed implementation plan
- [ ] Design UI mockups for POV selector
- [ ] Define Director prompt template
- [ ] Define Narrator prompt templates (per mode)
- [ ] Implement context filter logic
