import type { PhaseKey, PresetId, Project } from './types';

type PhaseMap = Project['scope']['phases'];

export const PRESETS: Record<PresetId, Record<PhaseKey, boolean>> = {
  'siding-only': {
    insulation: false,
    sheathing: false,
    vaporBarrier: false,
    siding: true,
    trim: true,
    paint: false,
  },
  'reside-with-wrb': {
    insulation: false,
    sheathing: false,
    vaporBarrier: true,
    siding: true,
    trim: true,
    paint: false,
  },
  'full-envelope': {
    insulation: true,
    sheathing: true,
    vaporBarrier: true,
    siding: true,
    trim: true,
    paint: true,
  },
  custom: {
    insulation: false,
    sheathing: false,
    vaporBarrier: false,
    siding: false,
    trim: false,
    paint: false,
  },
};

export function applyPreset(presetId: PresetId, phases: PhaseMap): PhaseMap {
  if (presetId === 'custom') return phases;
  const flags = PRESETS[presetId];
  return {
    insulation: { ...phases.insulation, enabled: flags.insulation },
    sheathing: { ...phases.sheathing, enabled: flags.sheathing },
    vaporBarrier: { ...phases.vaporBarrier, enabled: flags.vaporBarrier },
    siding: { ...phases.siding, enabled: flags.siding },
    trim: { ...phases.trim, enabled: flags.trim },
    paint: { ...phases.paint, enabled: flags.paint },
  };
}

export const PRESET_LABELS: Record<PresetId, string> = {
  'siding-only': 'Siding only',
  'reside-with-wrb': 'Re-side with WRB',
  'full-envelope': 'Full envelope rebuild',
  custom: 'Custom',
};
