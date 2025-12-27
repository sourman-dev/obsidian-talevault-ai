/**
 * Stats Service
 * Manages character stats with D&D-style modifiers
 */

import { App, TFile, normalizePath } from 'obsidian';
import type { CharacterStats, BaseStats, ResourceStat } from '../types/stats';
import { DEFAULT_CHARACTER_STATS, STATS_VERSION, STAT_ABBREV } from '../types/stats';

export class StatsService {
  constructor(private app: App) {}

  /**
   * Load stats for a character
   * @returns CharacterStats or null if not found
   */
  async loadStats(characterFolderPath: string): Promise<CharacterStats | null> {
    const statsPath = normalizePath(`${characterFolderPath}/stats.json`);
    const file = this.app.vault.getAbstractFileByPath(statsPath);

    if (!(file instanceof TFile)) {
      return null;
    }

    try {
      const content = await this.app.vault.read(file);
      const stats = JSON.parse(content) as CharacterStats;

      // Migrate if needed
      if (stats.version < STATS_VERSION) {
        const migrated = this.migrateStats(stats);
        await this.saveStats(characterFolderPath, migrated);
        return migrated;
      }

      return stats;
    } catch (e) {
      console.error(`Failed to load stats from ${statsPath}:`, e);
      return null;
    }
  }

  /**
   * Save stats for a character
   */
  async saveStats(characterFolderPath: string, stats: CharacterStats): Promise<void> {
    const statsPath = normalizePath(`${characterFolderPath}/stats.json`);

    // Update timestamp
    stats.lastUpdated = new Date().toISOString();

    const content = JSON.stringify(stats, null, 2);
    const file = this.app.vault.getAbstractFileByPath(statsPath);

    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(statsPath, content);
    }
  }

  /**
   * Initialize default stats for a new character
   */
  async initializeStats(characterFolderPath: string): Promise<CharacterStats> {
    const stats: CharacterStats = {
      ...DEFAULT_CHARACTER_STATS,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveStats(characterFolderPath, stats);
    return stats;
  }

  /**
   * Calculate D&D-style modifier from stat value
   * Formula: floor((stat - 10) / 2)
   */
  getModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
  }

  /**
   * Format modifier for display (+2, -1, etc.)
   */
  formatModifier(statValue: number): string {
    const mod = this.getModifier(statValue);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  /**
   * Update a single stat value
   * @param path Dot-notation path (e.g., "baseStats.strength", "derivedStats.hp.current")
   */
  async updateStat(
    characterFolderPath: string,
    path: string,
    value: number
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    // Navigate and update the nested path
    const parts = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: any = stats;

    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
      if (target === undefined) {
        throw new Error(`Invalid stat path: ${path}`);
      }
    }

    const lastKey = parts[parts.length - 1];
    target[lastKey] = value;

    await this.saveStats(characterFolderPath, stats);
    return stats;
  }

  /**
   * Update a resource stat (current and/or max)
   */
  async updateResourceStat(
    characterFolderPath: string,
    statName: string,
    update: Partial<ResourceStat>
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    const existing = stats.derivedStats[statName];
    if (existing) {
      stats.derivedStats[statName] = { ...existing, ...update };
    } else {
      // Create new resource stat
      stats.derivedStats[statName] = {
        current: update.current ?? 10,
        max: update.max ?? 10,
      };
    }

    await this.saveStats(characterFolderPath, stats);
    return stats;
  }

  /**
   * Add a condition to character
   */
  async addCondition(
    characterFolderPath: string,
    condition: string
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    const normalized = condition.toLowerCase().trim();
    if (!stats.conditions.includes(normalized)) {
      stats.conditions.push(normalized);
      await this.saveStats(characterFolderPath, stats);
    }

    return stats;
  }

  /**
   * Remove a condition from character
   */
  async removeCondition(
    characterFolderPath: string,
    condition: string
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    const normalized = condition.toLowerCase().trim();
    const index = stats.conditions.indexOf(normalized);
    if (index !== -1) {
      stats.conditions.splice(index, 1);
      await this.saveStats(characterFolderPath, stats);
    }

    return stats;
  }

  /**
   * Add or update a custom stat
   */
  async setCustomStat(
    characterFolderPath: string,
    name: string,
    value: number
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    stats.customStats[name] = value;
    await this.saveStats(characterFolderPath, stats);
    return stats;
  }

  /**
   * Remove a custom stat
   */
  async removeCustomStat(
    characterFolderPath: string,
    name: string
  ): Promise<CharacterStats | null> {
    const stats = await this.loadStats(characterFolderPath);
    if (!stats) {
      return null;
    }

    delete stats.customStats[name];
    await this.saveStats(characterFolderPath, stats);
    return stats;
  }

  /**
   * Format stats for LLM context injection
   * Places important info in first 3200 chars for optimal attention
   */
  formatForContext(stats: CharacterStats): string {
    const lines: string[] = [];

    // Base stats with modifiers
    lines.push('**Character Stats:**');
    for (const [key, value] of Object.entries(stats.baseStats)) {
      const abbrev = STAT_ABBREV[key as keyof BaseStats];
      const mod = this.formatModifier(value);
      lines.push(`- ${abbrev}: ${value} (${mod})`);
    }

    // HP and other resources
    lines.push('');
    lines.push('**Resources:**');
    for (const [key, resource] of Object.entries(stats.derivedStats)) {
      if (resource) {
        const label = key.toUpperCase();
        lines.push(`- ${label}: ${resource.current}/${resource.max}`);
      }
    }

    // Conditions
    if (stats.conditions.length > 0) {
      lines.push('');
      lines.push(`**Conditions:** ${stats.conditions.join(', ')}`);
    }

    // Custom stats
    if (Object.keys(stats.customStats).length > 0) {
      lines.push('');
      lines.push('**Custom Stats:**');
      for (const [key, value] of Object.entries(stats.customStats)) {
        lines.push(`- ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Migrate stats from older versions
   */
  private migrateStats(stats: CharacterStats): CharacterStats {
    // Clone to avoid mutation
    const migrated = JSON.parse(JSON.stringify(stats)) as CharacterStats;

    // v0 -> v1: Add version field if missing
    if (!migrated.version) {
      migrated.version = 1;
    }

    // Future migrations here
    // if (migrated.version < 2) { ... }

    return migrated;
  }
}
