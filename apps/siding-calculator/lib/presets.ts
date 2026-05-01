import type { PhaseKey, PresetId, Project } from './types';

type PhaseMap = Project['scope']['phases'];

export const PRESETS: Record<PresetId, Record<PhaseKey, boolean>> = {
  'siding-only': {
    insulation: false,
    sheathing: false,
    vaporBarrier: false,
    siding: true,
    trim: true,
  },
  'reside-with-wrb': {
    insulation: false,
    sheathing: false,
    vaporBarrier: true,
    siding: true,
    trim: true,
  },
  'full-envelope': {
    insulation: true,
    sheathing: true,
    vaporBarrier: true,
    siding: true,
    trim: true,
  },
  custom: { insulation: false, sheathing: false, vaporBarrier: false, siding: false, trim: false }, // unused
};

export function applyPreset(presetId: PresetId, phases: PhaseMap): PhaseMap {
  if (presetId === 'custom') return phases;
  const flags = PRESETS[presetId];
  return {
    insulation: { enabled: flags.insulation, materialId: phases.insulation.materialId },
    sheathing: { enabled: flags.sheathing, materialId: phases.sheathing.materialId },
    vaporBarrier: { enabled: flags.vaporBarrier, materialId: phases.vaporBarrier.materialId },
    siding: { enabled: flags.siding, materialId: phases.siding.materialId },
    trim: { enabled: flags.trim, materialId: phases.trim.materialId },
  };
}

export const PRESET_LABELS: Record<PresetId, string> = {
  'siding-only': 'Siding only',
  'reside-with-wrb': 'Re-side with WRB',
  'full-envelope': 'Full envelope rebuild',
  custom: 'Custom',
};
