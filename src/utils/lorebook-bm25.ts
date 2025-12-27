/**
 * BM25 Search for Lorebook Entries
 *
 * Provides better keyword matching than simple substring search.
 * Uses BM25 algorithm to rank lorebook entries by relevance.
 */

import type { LorebookEntry } from '../types/lorebook';
import { tokenize } from './bm25';

/** BM25 parameters */
const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** Minimum score threshold for matching */
const MIN_SCORE_THRESHOLD = 0.3;

/** Entry with computed tokens for BM25 */
interface TokenizedEntry {
  entry: LorebookEntry;
  tokens: string[];
}

/**
 * BM25 Search Engine for Lorebook Entries
 *
 * Differences from simple keyword matching:
 * 1. TF-IDF weighting: rare keywords score higher
 * 2. Length normalization: longer entries don't dominate
 * 3. Fuzzy matching: partial word matches via tokenization
 * 4. Ranking: returns entries sorted by relevance
 */
export class LorebookBM25 {
  private entries: TokenizedEntry[] = [];
  private avgDocLength: number = 0;
  private docFrequency: Map<string, number> = new Map();
  private numDocs: number = 0;

  /**
   * Index lorebook entries for BM25 search
   * Tokenizes both keys and content for matching
   */
  index(entries: LorebookEntry[]): void {
    // Clear previous index
    this.entries = [];
    this.docFrequency.clear();

    // Filter enabled entries only
    const enabledEntries = entries.filter(e => e.enabled);

    // Tokenize entries (using keys as primary tokens)
    this.entries = enabledEntries.map(entry => {
      // Combine keys + first 200 chars of content for tokenization
      const text = [
        ...entry.keys,
        entry.content.slice(0, 200),
      ].join(' ');

      return {
        entry,
        tokens: tokenize(text),
      };
    });

    this.numDocs = this.entries.length;
    if (this.numDocs === 0) {
      this.avgDocLength = 0;
      return;
    }

    // Calculate average document length
    const totalLength = this.entries.reduce((sum, e) => sum + e.tokens.length, 0);
    this.avgDocLength = totalLength / this.numDocs;

    // Calculate document frequency for each term
    for (const { tokens } of this.entries) {
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        this.docFrequency.set(term, (this.docFrequency.get(term) || 0) + 1);
      }
    }
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term
   */
  private idf(term: string): number {
    const df = this.docFrequency.get(term) || 0;
    // BM25 IDF formula with smoothing
    return Math.log((this.numDocs - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for an entry given query terms
   */
  private score(entry: TokenizedEntry, queryTerms: string[]): number {
    const docLength = entry.tokens.length;
    let score = 0;

    for (const term of queryTerms) {
      const tf = entry.tokens.filter(t => t === term).length;
      if (tf === 0) continue;

      const idf = this.idf(term);
      // BM25 scoring formula
      const numerator = tf * (BM25_K1 + 1);
      const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / this.avgDocLength));
      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Search for matching lorebook entries
   *
   * @param text - Text to search against (recent messages)
   * @param limit - Max number of results
   * @returns Matching entries sorted by relevance
   */
  search(text: string, limit: number = 5): LorebookEntry[] {
    if (this.numDocs === 0) return [];

    const queryTerms = tokenize(text);
    if (queryTerms.length === 0) return [];

    // Separate always-active entries (they always match)
    const alwaysActive: LorebookEntry[] = [];
    const searchable: TokenizedEntry[] = [];

    for (const entry of this.entries) {
      if (entry.entry.alwaysActive) {
        alwaysActive.push(entry.entry);
      } else {
        searchable.push(entry);
      }
    }

    // Score and filter non-always-active entries
    const scored = searchable
      .map(entry => ({
        entry: entry.entry,
        score: this.score(entry, queryTerms),
      }))
      .filter(item => item.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    // Combine always-active + top scoring entries
    const results = [
      ...alwaysActive,
      ...scored.slice(0, limit - alwaysActive.length).map(s => s.entry),
    ];

    // Sort final results by order
    return results.sort((a, b) => a.order - b.order);
  }

  /**
   * Check if any entry matches (for quick indicator check)
   */
  hasMatches(text: string): boolean {
    if (this.numDocs === 0) return false;

    // Always-active entries always match
    if (this.entries.some(e => e.entry.alwaysActive)) return true;

    const queryTerms = tokenize(text);
    if (queryTerms.length === 0) return false;

    // Check if any entry scores above threshold
    return this.entries.some(entry => {
      if (entry.entry.alwaysActive) return true;
      return this.score(entry, queryTerms) >= MIN_SCORE_THRESHOLD;
    });
  }
}

/**
 * Create a reusable BM25 search instance for lorebook
 */
export function createLorebookSearch(entries: LorebookEntry[]): LorebookBM25 {
  const search = new LorebookBM25();
  search.index(entries);
  return search;
}
