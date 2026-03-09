// Resize presets keyed by image category (from blob-manager/config.json)
// Sharp uses fit: 'inside' — scales down to fit without cropping or distorting
export const presets = {
  'hero':         { width: 1440, height: 810,  label: 'Hero — 1440×810' },
  'gallery':      { width: 800,  height: 600,  label: 'Gallery — 800×600' },
  'before-after': { width: 1000, height: 667,  label: 'Before/After — 1000×667' },
  'completed':    { width: 1000, height: 667,  label: 'Completed — 1000×667' },
  'damage':       { width: 800,  height: 600,  label: 'Damage — 800×600' },
  'process':      { width: 800,  height: 600,  label: 'Process — 800×600' },
  'repair':       { width: 800,  height: 600,  label: 'Repair — 800×600' },
  'team':         { width: 600,  height: 800,  label: 'Team — 600×800' },
  'equipment':    { width: 800,  height: 600,  label: 'Equipment — 800×600' },
};

export default presets;
