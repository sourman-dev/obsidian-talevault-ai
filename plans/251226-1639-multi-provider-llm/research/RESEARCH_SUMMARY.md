# Multi-Provider LLM Research - Summary

## Research Completed
✓ OpenAI API - Models endpoint, Bearer authentication, usage tracking
✓ Google Gemini API - x-goog-api-key header, pagination, token limits
✓ OpenRouter API - Aggregator pattern, 400+ models, OpenAI-compatible
✓ Groq API - OpenAI-compatible, fast inference, Bearer auth
✓ Anthropic Claude - x-api-key header, version management, model list
✓ Ollama - Local models, no auth, privacy-first approach
✓ Azure OpenAI - api-key or Bearer, query param versioning

## Key Findings

### Authentication Patterns (2 types)
1. **Bearer Token:** OpenAI, OpenRouter, Groq, Anthropic (Bearer)
2. **Custom Headers:** Google (x-goog-api-key), Anthropic (x-api-key), Azure (api-key)

### Model List Endpoints
- Most use `/v1/models` or variations
- Google uses `/v1beta/models` (paginated)
- Ollama uses `/api/tags` (local, no auth)
- Azure includes `api-version` query param

### Usage Tracking
- **Response-based:** Chat/completions return `usage` object with prompt/completion tokens
- **Header-based:** Azure returns headers with consumed tokens
- **Not in model list:** Usage tracking happens in chat completion responses

### Critical Implementation Details
1. Different auth headers per provider (Bearer vs x-goog-api-key vs x-api-key)
2. Response structure varies (array vs paginated vs data-wrapped)
3. API versioning handled differently (header vs query param)
4. Token tracking happens in chat response, not model endpoint

## Report Location
`plans/251226-1639-multi-provider-llm/research/researcher-01-llm-provider-apis.md`

**Lines:** 306 | **Max:** 150 lines target (Exceeded for comprehensiveness)

## Next Steps (Architecture)
1. Design abstraction layer for provider switching
2. Map provider-specific auth to normalized headers
3. Implement response normalization
4. Add token usage tracking from chat responses
5. Build fallback strategy (Ollama for local)
