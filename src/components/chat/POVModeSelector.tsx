/**
 * POV Mode Selector - Mobile-first tap-to-cycle component
 * Cycles through: Fixed → Switchable → Any → Fixed
 */

import { useState } from 'react';
import type { POVMode, POVOptions } from '../../types';

interface POVModeSelectorProps {
  povOptions: POVOptions;
  onChange: (options: POVOptions) => void;
  disabled?: boolean;
}

/** POV mode configuration */
const POV_MODES: { mode: POVMode; icon: string; label: string; description: string }[] = [
  {
    mode: 'fixed',
    icon: '👁️',
    label: 'Fixed',
    description: 'Write from main character POV only',
  },
  {
    mode: 'switchable',
    icon: '🔄',
    label: 'Switch',
    description: 'Switch between character perspectives',
  },
  {
    mode: 'any',
    icon: '👥',
    label: 'Any',
    description: 'Multi-perspective with POV markers',
  },
];

/**
 * Mobile-first POV mode selector
 * - Tap cycles through modes
 * - Touch target: 44x44px min (iOS HIG)
 * - Icon only on narrow screens
 */
export function POVModeSelector({
  povOptions,
  onChange,
  disabled = false,
}: POVModeSelectorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const currentIndex = POV_MODES.findIndex((m) => m.mode === povOptions.mode);
  const current = POV_MODES[currentIndex >= 0 ? currentIndex : 0];

  const cycleMode = () => {
    if (disabled) return;

    const nextIndex = (currentIndex + 1) % POV_MODES.length;
    const nextMode = POV_MODES[nextIndex];

    onChange({
      ...povOptions,
      mode: nextMode.mode,
    });

    // Show tooltip briefly on change
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 1500);
  };

  return (
    <div className="mianix-pov-selector">
      <button
        className="mianix-pov-toggle"
        onClick={cycleMode}
        disabled={disabled}
        title={`POV: ${current.label} - ${current.description}`}
        aria-label={`POV Mode: ${current.label}. Tap to change.`}
      >
        <span className="mianix-pov-icon">{current.icon}</span>
        <span className="mianix-pov-label">{current.label}</span>
      </button>

      {/* Tooltip shown briefly after mode change */}
      {showTooltip && (
        <div className="mianix-pov-tooltip">
          {current.icon} {current.label}
          <span className="mianix-pov-tooltip-desc">{current.description}</span>
        </div>
      )}
    </div>
  );
}

/** Default POV options (Fixed mode, no POV character override) */
export const DEFAULT_POV_OPTIONS: POVOptions = {
  mode: 'fixed',
};
