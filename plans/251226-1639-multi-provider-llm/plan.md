---
title: "Multi-Provider LLM System"
description: "Provider management với model auto-fetch, per-character config, và token tracking"
status: in-progress
priority: P1
effort: 8h
branch: master
tags: [llm, provider, settings, refactor]
created: 2025-12-26
updated: 2025-12-26
---

# Multi-Provider LLM System

## Overview

Refactor LLM system từ single provider sang multi-provider với:
- Provider CRUD (add/edit/delete) với preset templates
- Auto-fetch models từ provider API
- 3 model types: text, extraction, image
- Per-character override
- Token usage tracking per message

## Current State

- Single provider config trong `MianixSettings.llm`
- Separate `extractionModel` config (duplicates baseUrl/apiKey)
- No model fetching
- No token tracking

## Implementation Phases

| Phase | Description | Status | Effort | Completed |
|-------|-------------|--------|--------|-----------|
| [Phase 1](./phase-01-provider-types.md) | Type definitions & provider presets | Done | 1h | 2025-12-26 |
| [Phase 2](./phase-02-settings-migration.md) | Settings migration & storage | Pending | 1.5h | - |
| [Phase 3](./phase-03-model-fetcher.md) | Model fetcher service | Pending | 1.5h | - |
| [Phase 4](./phase-04-settings-ui.md) | Settings tab UI refactor | Pending | 2h | - |
| [Phase 5](./phase-05-llm-service-refactor.md) | LLM service refactor | Pending | 1.5h | - |
| [Phase 6](./phase-06-token-tracking.md) | Token tracking per message | Pending | 0.5h | - |

## Architecture

```
MianixSettings
├── providers: LLMProvider[]
├── defaults
│   ├── text: { providerId, model }
│   ├── extraction?: { providerId, model }
│   └── image?: { providerId, model }
└── enableMemoryExtraction: boolean

DialogueSession (per-character)
├── llmOptions: { temperature, topP, responseLength }
└── modelConfig?: { text?, extraction?, image? }

DialogueMessage (per-turn)
├── ...existing fields
├── providerId?: string
├── model?: string
├── inputTokens?: number
└── outputTokens?: number
```

## Key Decisions

1. **Provider presets** - Pre-fill baseUrl for known providers (OpenAI, Google, etc.)
2. **Model auto-fetch** - Call `/models` endpoint, cache results
3. **Fallback chain** - Character config → Global default
4. **Token tracking** - Store in message frontmatter (optional metadata)

## Research

- [Provider APIs](./research/researcher-01-llm-provider-apis.md)

## Dependencies

- Existing: `src/services/llm-service.ts`, `src/settings-tab.ts`, `src/types/index.ts`
- New: `src/services/provider-service.ts`, `src/services/model-fetcher.ts`

## Validation Summary

**Validated:** 2025-12-26
**Questions asked:** 5

### Confirmed Decisions

| Decision | Choice |
|----------|--------|
| UUID generation | `crypto.randomUUID()` - native, no dependency |
| Auth header storage | Thêm `authHeader` field vào `LLMProvider` type |
| Google AI approach | Gọi riêng Google API `/models`, các provider khác dùng OpenAI-compatible |
| Model cache TTL | Tăng lên (15-30 phút) vì model lists ít thay đổi |
| Image model type | Giữ trong types cho future-ready |

### Action Items

- [x] Phase 1: Thêm `authHeader?: string` field vào `LLMProvider` interface ✅
- [ ] Phase 2: Sử dụng `crypto.randomUUID()` thay vì `uuid` package
- [ ] Phase 3: Tăng cache TTL lên 30 phút, thêm logic riêng cho Google AI models endpoint
- [ ] Future: Implement error/alert notification system (popup, toast)

## Progress

**Phase 1 (Completed 2025-12-26)**
- ✅ Created `src/types/provider.ts` with all type definitions
- ✅ Created `src/constants/provider-presets.ts` with 5 provider presets
- ✅ Updated `src/types/index.ts` with backward-compatible settings
- ✅ All types compile without errors
- ✅ Code review passed - [Report](../reports/code-reviewer-251226-1927-multi-provider-phase1.md)

**Implementation improvements over spec:**
- Renamed `ModelSelection` → `ModelReference` (clearer naming)
- Removed redundant `type` field from `LLMProvider` (DRY principle)
- Added `defaultModel` field for better UX
- Added `authHeader` field to support multiple auth types
