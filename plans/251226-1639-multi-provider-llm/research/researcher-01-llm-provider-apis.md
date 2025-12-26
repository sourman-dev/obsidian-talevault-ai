# LLM Provider APIs Research Report
**Date:** 2025-12-26 | **Time:** 16:40
**Focus:** Model listing endpoints, authentication, response formats, usage tracking

---

## 1. OpenAI API

### Endpoint
- **Base:** `https://api.openai.com/v1`
- **Models:** `GET /v1/models`

### Authentication
- **Header:** `Authorization: Bearer {API_KEY}`
- **Optional:** `OpenAI-Organization`, `OpenAI-Project` headers
- **Status (2025):** Shifted to project-scoped API keys

### Response Format
- List of available models with metadata
- Includes model ID, creation date, owned_by, display name
- Example: `gpt-4-turbo`, `gpt-4o-mini`

### Usage Tracking
- Not returned in model list endpoint
- Chat/completions response includes `usage` object:
  - `prompt_tokens`: Input tokens
  - `completion_tokens`: Output tokens
  - `total_tokens`: Sum

### Notes
- Supports streaming (`stream: true`)
- Max token parameters optional (can use prompt-based length)
- Azure OpenAI uses `api-key` header instead of Bearer

---

## 2. Google Gemini API

### Endpoints
- **Base:** `https://generativelanguage.googleapis.com`
- **Models list:** `GET /v1beta/models`
- **Model get:** `GET /v1beta/models/{model}`

### Authentication
- **Primary:** `x-goog-api-key: {API_KEY}` header
- **Alternative:** `Authorization: Bearer {API_KEY}` (for OpenAI-compatible)
- **Vertex AI:** OAuth 2.0 token via `credentials.refresh()`

### Response Format
- Models endpoint returns paginated list (default 50, max 1000)
- Includes model ID, version, display name, input/output token limits
- Supports `pageSize` parameter

### Usage Tracking
- Response includes token usage metadata
- Supports `generationConfig` to set output token limits

### Notes
- Different auth header than OpenAI (`x-goog-api-key` vs `Bearer`)
- Vertex AI for enterprise deployment
- Python SDK: `from google import genai`

---

## 3. OpenRouter API

### Endpoint
- **Base:** `https://openrouter.ai/api/v1`
- **Models:** `GET /api/v1/models`

### Authentication
- **Header:** `Authorization: Bearer {API_KEY}`
- **OpenAI-compatible:** Swap base URL and key in existing apps

### Response Format
- Response contains `data` array with model objects
- 13+ properties per model (name, context, pricing, features)
- Supports filters: `category`, `supported_parameters`

### Optional Parameters
- `use_rss` - RSS feed format
- `category` - Filter by category
- `supported_parameters` - Filter by capabilities

### Usage Tracking
- Returns usage in chat/completions response
- Token costs tracked (per model pricing)
- Supports usage in response headers

### Notes
- Aggregates 400+ models from multiple providers
- OpenAI-compatible for drop-in replacement
- Privacy-focused (doesn't log conversations by default)

---

## 4. Groq API

### Endpoint
- **Base:** `https://api.groq.com/openai/v1`
- **Models:** `GET /openai/v1/models`

### Authentication
- **Header:** `Authorization: Bearer {API_KEY}`
- **SDK:** Pass `api_key` parameter, `base_url` = `https://api.groq.com/openai/v1`

### Response Format
- JSON object with model metadata
- Fields: `id`, `object`, `created`, `owned_by`, `active`
- Additional: `context_window`, `max_completion_tokens`

### Usage Tracking
- Returns token counts in completions response
- Tracks input/output tokens for cost calculation

### Notes
- OpenAI-compatible (mostly)
- Some OpenAI features not supported (400 error if used)
- Fast inference (focus on speed)

---

## 5. Anthropic Claude API

### Endpoint
- **Base:** `https://api.anthropic.com`
- **Models:** `GET /v1/models`

### Authentication
- **Header:** `x-api-key: {API_KEY}` (required)
- **Required:** `anthropic-version: {VERSION}` header (e.g., `2023-06-01`)
- **Optional:** `anthropic-beta` header for beta features

### Response Format
- Returns list of available Claude models
- Includes model ID, display name, creation date, type
- Example: `claude-sonnet-4-20250514`

### Usage Tracking
- Not in model list endpoint
- Chat response includes token usage
- Supports input/output token tracking

### Notes
- Different auth approach than OpenAI (x-api-key header)
- Version header required (API stability management)
- Beta feature opt-in via header

---

## 6. Ollama (Local Models)

### Endpoint
- **Base:** `http://localhost:11434` (default)
- **Models:** `GET /api/tags`

### Authentication
- **None** - Local service
- No API key required
- Secured by network isolation

### Response Format
```json
{
  "models": [
    {
      "name": "deepseek-r1:latest",
      "model": "deepseek-r1",
      "modified_at": "2025-12-26T10:00:00Z",
      "size": 1234567890,
      "digest": "sha256:...",
      "details": {
        "format": "gguf",
        "family": "qwen2",
        "parameter_size": "7.6B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

### Usage Tracking
- No built-in token tracking
- Manual token counting required
- Response includes model metadata (family, size)

### Notes
- Local-first, privacy-focused
- No external API calls
- Free (runs on local hardware)
- Perfect for development/testing

---

## 7. Azure OpenAI

### Endpoint
- **Base:** `https://{resource-name}.openai.azure.com`
- **Models:** `GET /openai/v1/models?api-version=preview`

### Authentication
- **Method 1:** `api-key: {AZURE_KEY}` header
- **Method 2:** `Authorization: Bearer {TOKEN}` (token-based)
- **Version:** `api-version` query parameter required

### Response Format
- Similar to OpenAI API response
- Compatible with OpenAI client libraries
- API version in query string (not header)

### Usage Tracking
- Response headers: `x-amzn-bedrock-*` tokens (if using Bedrock)
- Azure Monitor logs include: prompt_tokens, completion_tokens, model_name
- Per-request usage tracking

### Notes
- Different authentication headers than OpenAI
- Query parameter for API version (not header)
- Enterprise security + compliance features

---

## Summary Table

| Provider | Auth Header | Models Endpoint | Response Format | Usage Tracking |
|----------|-------------|-----------------|-----------------|----------------|
| **OpenAI** | `Bearer` token | `/v1/models` | JSON array | In chat response |
| **Google** | `x-goog-api-key` | `/v1beta/models` | Paginated list | In response |
| **OpenRouter** | `Bearer` token | `/api/v1/models` | `data` array | In response |
| **Groq** | `Bearer` token | `/openai/v1/models` | JSON object | In response |
| **Anthropic** | `x-api-key` | `/v1/models` | JSON array | In chat response |
| **Ollama** | None | `/api/tags` | `models` array | Manual |
| **Azure** | `api-key` or `Bearer` | `/openai/v1/models?api-version=...` | OpenAI-like | Headers + logs |

---

## Key Implementation Patterns

### 1. Bearer Token Pattern
OpenAI, OpenRouter, Groq use standard HTTP Bearer authentication:
```
Authorization: Bearer {API_KEY}
```

### 2. Custom Header Pattern
Google, Anthropic use provider-specific headers:
- Google: `x-goog-api-key`
- Anthropic: `x-api-key`
- Azure: `api-key` or `Bearer`

### 3. Response Structure Variations
- **OpenAI/Anthropic:** Direct array of models
- **Google:** Paginated response with `pageSize`
- **OpenRouter:** Wrapped in `data` field
- **Ollama:** Wrapped in `models` field

### 4. Usage Tracking Consistency
Most providers return usage in chat/completions response:
```json
{
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

---

## Recommendations for Multi-Provider Support

1. **Abstraction Layer:** Create interface for provider-specific auth/endpoints
2. **Header Management:** Map provider-specific headers to common structure
3. **Response Normalization:** Convert all responses to uniform format
4. **Usage Tracking:** Capture tokens from chat response, not model list
5. **Fallback Strategy:** Support Ollama for local fallback (no API key needed)
6. **Version Management:** Handle API versioning (Anthropic required, Azure query param)

---

## Unresolved Questions

1. Does each provider support model-specific metadata (context window, input/output token limits) in list endpoint?
2. How should we handle providers with different streaming formats (SSE vs other)?
3. What's the token counting strategy for providers without explicit tracking headers?
4. Should we implement caching for models list given they change infrequently?

---

## Sources

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/introduction)
- [OpenAI Models Endpoint](https://platform.openai.com/docs/api-reference/models/list)
- [Google Gemini API Authentication](https://ai.google.dev/gemini-api/docs)
- [Gemini Models Documentation](https://ai.google.dev/api/models)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Models Endpoint](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Groq API Reference](https://console.groq.com/docs/api-reference)
- [Groq OpenAI Compatibility](https://console.groq.com/docs/openai)
- [Anthropic Claude Models](https://docs.anthropic.com/en/docs/about-claude/models/overview)
- [Claude Models List API](https://docs.claude.com/en/api/models-list)
- [Ollama API Documentation](https://docs.ollama.com/api/tags)
- [LLM Token Usage Tracking](https://python.langchain.com/docs/how_to/llm_token_usage_tracking/)
- [Langfuse Token Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)
