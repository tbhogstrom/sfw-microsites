import { z } from 'zod';

export const PHASE_KEYS = ['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export const PRESET_IDS = ['siding-only', 'reside-with-wrb', 'full-envelope', 'custom'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const OPENING_TYPES = ['window', 'door', 'garage-door', 'vent'] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

const PositiveFt = z.number().finite().positive();
const NonNegFt = z.number().finite().nonnegative();

export const OpeningSchema = z.object({
  id: z.string().min(1),
  type: z.enum(OPENING_TYPES),
  x: NonNegFt,
  y: NonNegFt,
  widthFt: PositiveFt,
  heightFt: PositiveFt,
  label: z.string().optional(),
});
export type Opening = z.infer<typeof OpeningSchema>;

const PhaseSlotSchema = z.object({
  enabled: z.boolean(),
  materialId: z.string().nullable(),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.literal(1),
  canvas: z.object({
    widthFt: PositiveFt,
    heightFt: PositiveFt,
    snapInches: z.union([z.literal(0), z.literal(6), z.literal(12)]),
  }),
  wall: z.object({
    rect: z.object({
      x: NonNegFt,
      y: NonNegFt,
      widthFt: PositiveFt,
      heightFt: PositiveFt,
    }),
    gable: z
      .object({
        peakHeightFt: PositiveFt,
        peakOffsetFt: z.number().finite(),
      })
      .optional(),
  }),
  openings: z.array(OpeningSchema),
  scope: z.object({
    presetId: z.enum(PRESET_IDS),
    phases: z
      .object({
        insulation: PhaseSlotSchema,
        sheathing: PhaseSlotSchema,
        vaporBarrier: PhaseSlotSchema,
        siding: PhaseSlotSchema,
        trim: PhaseSlotSchema,
      })
      .strict(),
  }),
  lead: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
      address: z.string().min(1),
      capturedAt: z.string(),
      hubspotSubmittedAt: z.string().optional(),
    })
    .optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const MaterialSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(PHASE_KEYS),
  brand: z.string().nullable(),
  name: z.string().min(1),
  unit: z.enum(['sqft', 'linft', 'sheet', 'roll', 'piece']),
  coveragePerUnit: PositiveFt,
  wastePct: z.number().finite().min(0).max(1),
  notes: z.string().optional(),
  refDocPath: z.string().optional(),
});
export type Material = z.infer<typeof MaterialSchema>;
