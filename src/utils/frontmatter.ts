/**
 * Browser-compatible frontmatter parser
 * Replaces gray-matter which requires Node.js Buffer
 */
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedFrontmatter<T = Record<string, unknown>> {
  data: T;
  content: string;
}

/**
 * Parse markdown file with YAML frontmatter
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  input: string
): ParsedFrontmatter<T> {
  const match = input.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      data: {} as T,
      content: input,
    };
  }

  const [, yamlContent, bodyContent] = match;

  try {
    const data = parseYaml(yamlContent) as T;
    return {
      data: data || ({} as T),
      content: bodyContent || '',
    };
  } catch (e) {
    console.error('Failed to parse frontmatter YAML:', e);
    return {
      data: {} as T,
      content: input,
    };
  }
}

/**
 * Stringify data to markdown with YAML frontmatter
 */
export function stringifyFrontmatter<T = Record<string, unknown>>(
  data: T,
  content: string = ''
): string {
  const yamlStr = stringifyYaml(data, {
    lineWidth: 0, // No line wrapping
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });

  return `---\n${yamlStr}---\n${content}`;
}
