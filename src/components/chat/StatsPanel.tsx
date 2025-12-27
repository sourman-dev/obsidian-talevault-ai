import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../../context/app-context';
import { StatsService } from '../../services/stats-service';
import type { CharacterStats, BaseStats, ResourceStat } from '../../types/stats';
import { STAT_ABBREV } from '../../types/stats';

interface StatsPanelProps {
  characterFolderPath: string | null;
  /** Called when stats change (for LLM context update) */
  onStatsChange?: (stats: CharacterStats | null) => void;
}

/**
 * Stats panel showing character RPG stats with edit capability
 * Displays base stats with D&D modifiers, HP/MP bars, and conditions
 */
export function StatsPanel({
  characterFolderPath,
  onStatsChange,
}: StatsPanelProps) {
  const { app } = useApp();
  const [stats, setStats] = useState<CharacterStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const statsService = useMemo(() => new StatsService(app), [app]);

  // Use ref for callback to prevent useEffect dependency issues
  const onStatsChangeRef = useRef(onStatsChange);
  useEffect(() => {
    onStatsChangeRef.current = onStatsChange;
  });

  // Load stats when character changes
  useEffect(() => {
    if (!characterFolderPath) {
      setStats(null);
      return;
    }

    const loadStats = async () => {
      setLoading(true);
      try {
        const loaded = await statsService.loadStats(characterFolderPath);
        setStats(loaded);
        onStatsChangeRef.current?.(loaded);
      } catch (error) {
        console.warn('Failed to load stats:', error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [characterFolderPath, statsService]);

  // Initialize stats for character
  const handleInitialize = useCallback(async () => {
    if (!characterFolderPath) return;

    setLoading(true);
    try {
      const newStats = await statsService.initializeStats(characterFolderPath);
      setStats(newStats);
      onStatsChange?.(newStats);
    } catch (error) {
      console.error('Failed to initialize stats:', error);
    } finally {
      setLoading(false);
    }
  }, [characterFolderPath, statsService, onStatsChange]);

  // Update base stat
  const handleBaseStatChange = useCallback(
    async (statName: keyof BaseStats, value: number) => {
      if (!characterFolderPath || !stats) return;

      try {
        const updated = await statsService.updateStat(
          characterFolderPath,
          `baseStats.${statName}`,
          value
        );
        if (updated) {
          setStats(updated);
          onStatsChange?.(updated);
        }
      } catch (error) {
        console.error('Failed to update stat:', error);
      }
    },
    [characterFolderPath, stats, statsService, onStatsChange]
  );

  // Update resource stat
  const handleResourceChange = useCallback(
    async (resourceName: string, field: 'current' | 'max', value: number) => {
      if (!characterFolderPath || !stats) return;

      try {
        const updated = await statsService.updateResourceStat(
          characterFolderPath,
          resourceName,
          { [field]: value }
        );
        if (updated) {
          setStats(updated);
          onStatsChange?.(updated);
        }
      } catch (error) {
        console.error('Failed to update resource:', error);
      }
    },
    [characterFolderPath, stats, statsService, onStatsChange]
  );

  // Add/remove condition
  const handleToggleCondition = useCallback(
    async (condition: string, add: boolean) => {
      if (!characterFolderPath) return;

      try {
        const updated = add
          ? await statsService.addCondition(characterFolderPath, condition)
          : await statsService.removeCondition(characterFolderPath, condition);
        if (updated) {
          setStats(updated);
          onStatsChange?.(updated);
        }
      } catch (error) {
        console.error('Failed to update condition:', error);
      }
    },
    [characterFolderPath, statsService, onStatsChange]
  );

  if (!characterFolderPath) {
    return null;
  }

  // Show init button if no stats exist
  if (!stats && !loading) {
    return (
      <div className="mianix-stats-panel">
        <button
          className="mianix-stats-init-btn"
          onClick={handleInitialize}
          title="Initialize character stats"
        >
          🎲 Add Stats
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mianix-stats-panel">
        <span className="mianix-stats-loading">Loading stats...</span>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="mianix-stats-panel">
      <button
        className="mianix-stats-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title={`Character Stats${isExpanded ? ' (click to collapse)' : ''}`}
      >
        🎲 Stats
      </button>

      {isExpanded && (
        <div className="mianix-stats-content">
          {/* Header with edit toggle */}
          <div className="mianix-stats-header">
            <span>Character Stats</span>
            <button
              className="mianix-stats-edit-btn"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? 'Done editing' : 'Edit stats'}
            >
              {isEditing ? '✓' : '✎'}
            </button>
          </div>

          {/* Base stats grid */}
          <div className="mianix-stats-grid">
            {Object.entries(stats.baseStats).map(([key, value]) => (
              <StatBox
                key={key}
                label={STAT_ABBREV[key as keyof BaseStats]}
                value={value}
                modifier={statsService.formatModifier(value)}
                isEditing={isEditing}
                onChange={(v) =>
                  handleBaseStatChange(key as keyof BaseStats, v)
                }
              />
            ))}
          </div>

          {/* Resource bars */}
          <div className="mianix-stats-resources">
            {Object.entries(stats.derivedStats).map(([key, resource]) => {
              if (!resource) return null;
              return (
                <ResourceBar
                  key={key}
                  label={key.toUpperCase()}
                  current={resource.current}
                  max={resource.max}
                  isEditing={isEditing}
                  onChange={(field, value) =>
                    handleResourceChange(key, field, value)
                  }
                />
              );
            })}
          </div>

          {/* Conditions */}
          {(stats.conditions.length > 0 || isEditing) && (
            <div className="mianix-stats-conditions">
              <span className="mianix-conditions-label">Conditions:</span>
              <div className="mianix-conditions-list">
                {stats.conditions.map((condition) => (
                  <span
                    key={condition}
                    className="mianix-condition-badge"
                    onClick={() =>
                      isEditing && handleToggleCondition(condition, false)
                    }
                    title={isEditing ? 'Click to remove' : condition}
                  >
                    {condition}
                    {isEditing && ' ×'}
                  </span>
                ))}
                {isEditing && (
                  <AddConditionInput
                    onAdd={(c) => handleToggleCondition(c, true)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Custom stats */}
          {Object.keys(stats.customStats).length > 0 && (
            <div className="mianix-stats-custom">
              <span className="mianix-custom-label">Custom:</span>
              {Object.entries(stats.customStats).map(([key, value]) => (
                <span key={key} className="mianix-custom-stat">
                  {key}: {value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Individual stat box */
function StatBox({
  label,
  value,
  modifier,
  isEditing,
  onChange,
}: {
  label: string;
  value: number;
  modifier: string;
  isEditing: boolean;
  onChange: (value: number) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      // Clamp to D&D valid range (1-30)
      onChange(Math.max(1, Math.min(30, parsed)));
    }
  };

  if (isEditing) {
    return (
      <div className="mianix-stat-box mianix-stat-editing">
        <span className="mianix-stat-label">{label}</span>
        <input
          type="number"
          className="mianix-stat-input"
          value={value}
          min={1}
          max={30}
          onChange={handleChange}
        />
        <span className="mianix-stat-mod">{modifier}</span>
      </div>
    );
  }

  return (
    <div className="mianix-stat-box">
      <span className="mianix-stat-label">{label}</span>
      <span className="mianix-stat-value">{value}</span>
      <span className="mianix-stat-mod">{modifier}</span>
    </div>
  );
}

/** Resource bar (HP/MP) */
function ResourceBar({
  label,
  current,
  max,
  isEditing,
  onChange,
}: {
  label: string;
  current: number;
  max: number;
  isEditing: boolean;
  onChange: (field: 'current' | 'max', value: number) => void;
}) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const isLow = percentage <= 25;

  const handleCurrentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      onChange('current', Math.max(0, Math.min(max, parsed)));
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      onChange('max', Math.max(1, parsed));
    }
  };

  return (
    <div className="mianix-resource-bar">
      <span className="mianix-resource-label">{label}</span>
      <div className="mianix-resource-track">
        <div
          className={`mianix-resource-fill ${isLow ? 'mianix-resource-low' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isEditing ? (
        <div className="mianix-resource-inputs">
          <input
            type="number"
            className="mianix-resource-input"
            value={current}
            min={0}
            max={max}
            onChange={handleCurrentChange}
          />
          <span>/</span>
          <input
            type="number"
            className="mianix-resource-input"
            value={max}
            min={1}
            onChange={handleMaxChange}
          />
        </div>
      ) : (
        <span className="mianix-resource-value">
          {current}/{max}
        </span>
      )}
    </div>
  );
}

/** Input for adding new conditions */
function AddConditionInput({
  onAdd,
}: {
  onAdd: (condition: string) => void;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <form className="mianix-condition-add" onSubmit={handleSubmit}>
      <input
        type="text"
        className="mianix-condition-input"
        placeholder="Add condition..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="mianix-condition-add-btn">
        +
      </button>
    </form>
  );
}
