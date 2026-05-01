import { describe, it, expect } from 'vitest';
import { PRESETS, applyPreset } from '@/lib/presets';
import type { Project } from '@/lib/types';

const emptyPhases: Project['scope']['phases'] = {
  insulation: { enabled: false, materialId: null },
  sheathing: { enabled: false, materialId: null },
  vaporBarrier: { enabled: false, materialId: null },
  siding: { enabled: false, materialId: null },
  trim: { enabled: false, materialId: null },
};

describe('PRESETS', () => {
  it('exposes a flag table for every preset id', () => {
    expect(PRESETS['siding-only'].siding).toBe(true);
    expect(PRESETS['reside-with-wrb'].vaporBarrier).toBe(true);
    expect(PRESETS['full-envelope'].insulation).toBe(true);
    expect(PRESETS['custom']).toBeDefined();
  });

  it('siding-only enables only siding + trim', () => {
    const phases = applyPreset('siding-only', emptyPhases);
    expect(phases.siding.enabled).toBe(true);
    expect(phases.trim.enabled).toBe(true);
    expect(phases.insulation.enabled).toBe(false);
    expect(phases.sheathing.enabled).toBe(false);
    expect(phases.vaporBarrier.enabled).toBe(false);
  });

  it('reside-with-wrb enables wrb + siding + trim', () => {
    const phases = applyPreset('reside-with-wrb', emptyPhases);
    expect(phases.vaporBarrier.enabled).toBe(true);
    expect(phases.siding.enabled).toBe(true);
    expect(phases.trim.enabled).toBe(true);
    expect(phases.insulation.enabled).toBe(false);
    expect(phases.sheathing.enabled).toBe(false);
  });

  it('full-envelope enables everything', () => {
    const phases = applyPreset('full-envelope', emptyPhases);
    Object.values(phases).forEach((p) => expect(p.enabled).toBe(true));
  });

  it('custom leaves phases unchanged', () => {
    const before = { ...emptyPhases, siding: { enabled: true, materialId: 'x' } };
    const after = applyPreset('custom', before);
    expect(after).toEqual(before);
  });

  it('preserves materialId on enabled phases', () => {
    const before = { ...emptyPhases, siding: { enabled: false, materialId: 'sid-1' } };
    const after = applyPreset('siding-only', before);
    expect(after.siding.materialId).toBe('sid-1');
  });
});
