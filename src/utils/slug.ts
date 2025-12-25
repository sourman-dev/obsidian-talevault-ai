/**
 * Generate URL-safe slug from character name
 * "Alice the Explorer" -> "alice-the-explorer"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_]+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens from edges
}

/**
 * Generate unique folder name with timestamp suffix if exists
 */
export function generateUniqueSlug(name: string, existingSlugs: string[]): string {
  const baseSlug = generateSlug(name);
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Add timestamp suffix
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}
