/**
 * Stats Types for Character RPG System
 * D&D 6 base stats + derived stats + custom extensions
 */

/** Base RPG stats (D&D 5e style) */
export interface BaseStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/** Resource stat with current/max values (HP, MP, etc.) */
export interface ResourceStat {
  current: number;
  max: number;
}

/** Full character stats structure stored in stats.json */
export interface CharacterStats {
  /** Schema version for migrations */
  version: number;
  /** Base 6 stats */
  baseStats: BaseStats;
  /** Derived resource stats */
  derivedStats: {
    hp: ResourceStat;
    mp?: ResourceStat;
    [key: string]: ResourceStat | undefined;
  };
  /** Active conditions (poisoned, exhausted, etc.) */
  conditions: string[];
  /** Custom user-defined stats */
  customStats: Record<string, number>;
  /** Last update timestamp */
  lastUpdated: string;
}

/** NPC role classification */
export type NPCRole = 'ally' | 'enemy' | 'neutral' | 'unknown';

/** Extracted NPC character */
export interface NPCCharacter {
  id: string;
  name: string;
  role: NPCRole;
  description: string;
  stats?: Partial<BaseStats>;
  relationship?: string;
  /** Parent character ID this NPC was extracted from */
  extractedFrom: string;
  createdAt: string;
}

/** Default base stats for new characters */
export const DEFAULT_BASE_STATS: BaseStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

/** Default stats structure */
export const DEFAULT_CHARACTER_STATS: CharacterStats = {
  version: 1,
  baseStats: { ...DEFAULT_BASE_STATS },
  derivedStats: {
    hp: { current: 20, max: 20 },
  },
  conditions: [],
  customStats: {},
  lastUpdated: new Date().toISOString(),
};

/** Current stats schema version */
export const STATS_VERSION = 1;

/** Stat abbreviations for display */
export const STAT_ABBREV: Record<keyof BaseStats, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};
