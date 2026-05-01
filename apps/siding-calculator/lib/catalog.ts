import type { Material, PhaseKey } from './types';

export const CATALOG: Material[] = [
  // --- Insulation ---
  {
    id: 'insul-fiberglass-r15',
    phase: 'insulation',
    brand: null,
    name: 'Fiberglass batt insulation R-15 (2x4 walls)',
    unit: 'roll',
    coveragePerUnit: 88,
    wastePct: 0.05,
  },
  {
    id: 'insul-mineralwool-r21',
    phase: 'insulation',
    brand: null,
    name: 'Mineral wool batt insulation R-21 (2x6 walls)',
    unit: 'roll',
    coveragePerUnit: 60,
    wastePct: 0.05,
  },

  // --- Sheathing ---
  {
    id: 'sheath-osb-7-16',
    phase: 'sheathing',
    brand: null,
    name: 'OSB sheathing 7/16" (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.1,
  },
  {
    id: 'sheath-cdx-1-2',
    phase: 'sheathing',
    brand: null,
    name: 'CDX plywood sheathing 1/2" (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.1,
  },

  // --- Vapor barrier / WRB ---
  {
    id: 'wrb-tyvek-drainwrap',
    phase: 'vaporBarrier',
    brand: 'DuPont',
    name: "Tyvek DrainWrap (5' x 200' roll)",
    unit: 'roll',
    coveragePerUnit: 1000,
    wastePct: 0.1,
    refDocPath: 'tyvek-drainwrap/Tyvek-DrainWrap-PIS.pdf',
  },
  {
    id: 'wrb-generic-housewrap',
    phase: 'vaporBarrier',
    brand: null,
    name: "Generic house wrap (9' x 150' roll)",
    unit: 'roll',
    coveragePerUnit: 1350,
    wastePct: 0.1,
  },

  // --- Siding ---
  {
    id: 'sid-hardieplank-625',
    phase: 'siding',
    brand: 'James Hardie',
    name: 'HardiePlank Lap Siding (6.25" exposure)',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.1,
    refDocPath: 'james-hardie/HardiePlank-HZ10-install.pdf',
  },
  {
    id: 'sid-hardiepanel',
    phase: 'siding',
    brand: 'James Hardie',
    name: 'HardiePanel Vertical Siding (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.1,
    refDocPath: 'james-hardie/HardiePanel-HZ10-install.pdf',
  },
  {
    id: 'sid-cedar-bevel',
    phase: 'siding',
    brand: null,
    name: 'Western red cedar bevel siding',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.15,
    refDocPath: 'western-red-cedar/',
  },
  {
    id: 'sid-t1-11',
    phase: 'siding',
    brand: null,
    name: 'T1-11 plywood siding (4x8 sheet)',
    unit: 'sheet',
    coveragePerUnit: 32,
    wastePct: 0.1,
    refDocPath: 't1-11-siding/APA-Engineered-Wood-Construction-Guide-E30.pdf',
  },
  {
    id: 'sid-vinyl-generic',
    phase: 'siding',
    brand: null,
    name: 'Vinyl lap siding (generic, per square)',
    unit: 'sqft',
    coveragePerUnit: 1,
    wastePct: 0.1,
  },

  // --- Trim ---
  {
    id: 'trim-hardietrim-44',
    phase: 'trim',
    brand: 'James Hardie',
    name: 'HardieTrim 4/4 (~3.5" exposed face)',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.1,
    refDocPath: 'james-hardie/HardieTrim-HZ10-install.pdf',
  },
  {
    id: 'trim-cedar-1x4',
    phase: 'trim',
    brand: null,
    name: 'Western red cedar 1x4 trim',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.1,
  },
  {
    id: 'trim-pvc-1x4',
    phase: 'trim',
    brand: null,
    name: 'PVC trim board 1x4',
    unit: 'linft',
    coveragePerUnit: 1,
    wastePct: 0.1,
  },
];

export function materialsByPhase(phase: PhaseKey): Material[] {
  return CATALOG.filter((m) => m.phase === phase);
}

export function getMaterial(id: string): Material | null {
  return CATALOG.find((m) => m.id === id) ?? null;
}
