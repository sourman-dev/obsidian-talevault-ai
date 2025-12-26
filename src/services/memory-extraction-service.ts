/**
 * Memory Extraction Service
 *
 * Uses a fast/cheap LLM model to extract important facts from conversations.
 * Runs asynchronously after each LLM response to avoid blocking UI.
 */

import type { MianixSettings } from '../types';
import type { MemoryEntry } from '../utils/bm25';
import { extractKeywords } from '../utils/bm25';
import {
  resolveProvider,
  buildAuthHeaders,
  isMultiProviderConfigured,
} from '../utils/provider-resolver';

/** Extraction prompt for the LLM */
const EXTRACTION_PROMPT = `Phân tích đoạn hội thoại sau và trích xuất các thông tin quan trọng cần ghi nhớ.

Chỉ trích xuất những thông tin có giá trị lâu dài như:
- Sự thật về người dùng (tên, tuổi, nghề nghiệp, sở thích)
- Sự kiện quan trọng đã xảy ra
- Mối quan hệ giữa các nhân vật
- Quyết định hoặc cam kết của người dùng

KHÔNG trích xuất những thông tin tạm thời như cảm xúc nhất thời, câu hỏi đơn giản.

User: {userMessage}
AI: {aiMessage}

Trả về JSON array (KHÔNG dùng markdown code block):
[{"content": "mô tả ngắn gọn", "type": "fact|event|preference|relationship", "importance": 0.1-1.0}]

Nếu không có thông tin quan trọng nào, trả về: []`;

/** Extracted memory from LLM response */
interface ExtractedMemory {
  content: string;
  type: 'fact' | 'event' | 'preference' | 'relationship';
  importance: number;
}

export class MemoryExtractionService {
  constructor(private settings: MianixSettings) {}

  /**
   * Extract memories from a conversation turn
   * @param userMessage - User's message
   * @param aiMessage - AI's response
   * @param sourceMessageId - ID of the message for linking
   */
  async extractMemories(
    userMessage: string,
    aiMessage: string,
    sourceMessageId: string
  ): Promise<MemoryEntry[]> {
    try {
      const prompt = EXTRACTION_PROMPT.replace('{userMessage}', userMessage).replace(
        '{aiMessage}',
        aiMessage
      );

      const response = await this.callLLM(prompt);
      const extracted = this.parseResponse(response);

      // Convert to MemoryEntry with keywords
      return extracted.map((item) => ({
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: item.content,
        type: item.type,
        importance: item.importance,
        sourceMessageId,
        keywords: extractKeywords(item.content),
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Memory extraction failed:', error);
      return [];
    }
  }

  /**
   * Call the extraction LLM
   * Uses extraction provider if configured, falls back to text provider
   */
  private async callLLM(prompt: string): Promise<string> {
    // Get extraction config using new multi-provider system
    const { baseUrl, model } = this.getExtractionConfig();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistent output
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Extraction API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '[]';
  }

  /**
   * Get extraction model configuration
   * Resolution: extraction provider → text provider → legacy settings
   */
  private getExtractionConfig(): { baseUrl: string; apiKey: string; model: string } {
    // Try new multi-provider system
    if (isMultiProviderConfigured(this.settings)) {
      // Try extraction provider first
      const extractionResolved = resolveProvider(this.settings, 'extraction');
      if (extractionResolved) {
        return {
          baseUrl: extractionResolved.provider.baseUrl,
          apiKey: extractionResolved.provider.apiKey,
          model: extractionResolved.model,
        };
      }
    }

    // Fallback to legacy settings
    const extractionConfig = this.settings.extractionModel;
    const mainConfig = this.settings.llm;

    return {
      baseUrl: extractionConfig?.baseUrl || mainConfig.baseUrl,
      apiKey: extractionConfig?.apiKey || mainConfig.apiKey,
      model: extractionConfig?.modelName || 'gpt-4o-mini',
    };
  }

  /**
   * Get auth headers for the extraction provider (without Content-Type)
   */
  private getAuthHeaders(): Record<string, string> {
    // Try new multi-provider system
    if (isMultiProviderConfigured(this.settings)) {
      const resolved = resolveProvider(this.settings, 'extraction');
      if (resolved) {
        // Build auth-only headers based on provider type
        const authHeader = resolved.provider.authHeader || 'bearer';
        switch (authHeader) {
          case 'x-goog-api-key':
            return { 'x-goog-api-key': resolved.provider.apiKey };
          case 'x-api-key':
            return { 'x-api-key': resolved.provider.apiKey };
          case 'api-key':
            return { 'api-key': resolved.provider.apiKey };
          default:
            return { Authorization: `Bearer ${resolved.provider.apiKey}` };
        }
      }
    }

    // Fallback: legacy Bearer auth
    const apiKey =
      this.settings.extractionModel?.apiKey || this.settings.llm.apiKey;
    return { Authorization: `Bearer ${apiKey}` };
  }

  /**
   * Parse LLM response to extract memories
   */
  private parseResponse(response: string): ExtractedMemory[] {
    try {
      // Clean up response - remove markdown code blocks if present
      let jsonText = response.trim();

      // Try to find JSON array in response
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      } else {
        // Remove markdown code blocks
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      if (!Array.isArray(parsed)) {
        return [];
      }

      // Validate and filter valid entries
      return parsed.filter(
        (item): item is ExtractedMemory =>
          typeof item.content === 'string' &&
          ['fact', 'event', 'preference', 'relationship'].includes(item.type) &&
          typeof item.importance === 'number' &&
          item.importance >= 0 &&
          item.importance <= 1
      );
    } catch {
      console.warn('Failed to parse extraction response:', response);
      return [];
    }
  }
}
