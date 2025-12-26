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
| [Phase 2](./phase-02-settings-migration.md) | Settings migration & storage | Done | 1.5h | 2025-12-26 |
| [Phase 3](./phase-03-model-fetcher.md) | Model fetcher service | Done | 1.5h | 2025-12-26 |
| [Phase 4](./phase-04-settings-ui.md) | Settings tab UI refactor | Done | 2h | 2025-12-26 |
| [Phase 5](./phase-05-llm-service-refactor.md) | LLM service refactor | Done | 1.5h | 2025-12-26 |
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
- [x] Phase 2: Sử dụng `crypto.randomUUID()` thay vì `uuid` package ✅
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

**Phase 2 (Completed 2025-12-26)**
- ✅ Created `src/utils/settings-migration.ts` with migration logic
- ✅ Used `crypto.randomUUID()` for provider IDs (no external dependency)
- ✅ Updated `src/types/index.ts` to export `getDefaultSettings()`
- ✅ Updated `src/main.ts` to use `migrateSettings()` in loadSettings()
- ✅ Backward compatibility preserved with legacy field retention
- ✅ Build and typecheck passed (0 errors)
- ✅ Code review passed - [Report](../reports/code-reviewer-251226-1937-settings-migration.md)

**Implementation improvements over spec:**
- Added `mergeWithDefaults()` for robust settings handling
- Enhanced preset detection with PROVIDER_PRESETS integration
- Added `isNewFormat()` type guard for cleaner migration detection
- Better error handling for edge cases (empty data, missing fields)

**Phase 4 (Completed 2025-12-26)**
- ✅ Created `src/components/provider-modal.ts` for add/edit providers
- ✅ Refactored `src/settings-tab.ts` with provider list and default model selection
- ✅ Added CSS styles for provider UI in `styles.css`
- ✅ Build and typecheck passed (0 errors)
- ✅ Code review passed - [Report](../reports/code-reviewer-251226-2035-phase-4-settings-ui.md)

**Implementation improvements over spec:**
- Delete confirmation dialog with warning for default providers
- Specific error messages (auth failed, endpoint not found, network error)
- Duplicate name validation (case-insensitive)
- URL format validation using URL constructor
- Success notices for save/delete operations

**Phase 5 (Completed 2025-12-26)**
- ✅ Created `src/utils/provider-resolver.ts` with `resolveProvider()`, `buildAuthHeaders()`, `isMultiProviderConfigured()`
- ✅ Refactored `src/services/llm-service.ts` to use provider resolver with legacy fallback
- ✅ Updated `src/services/memory-extraction-service.ts` to use provider resolver
- ✅ Updated `src/hooks/use-llm.ts` with `isConfigured()` and `LLMResponse` support
- ✅ Build and typecheck passed (0 errors)
- ✅ Tests passed (31/31)
- ✅ Code review passed (Grade A - 9/10) - [Report](../reports/code-reviewer-251226-2145-phase-5-llm-service.md)

**Implementation improvements over spec:**
- Added `LLMResponse` type with token usage tracking (promptTokens, completionTokens, totalTokens)
- Backward compatibility with legacy `settings.llm` via `isMultiProviderConfigured()` check
- Extraction provider properly falls back to text provider when not configured
- Stream parsing captures usage from final chunk (OpenAI `stream_options: { include_usage: true }`)
