import { z } from 'zod';

export const PointSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
});

export const TraceSchema = z.object({
  points: z.array(PointSchema),
  inchesPerPixel: z.number().nullable(),
});

export const ImageRefSchema = z.object({
  blobUrl: z.string(),
  widthPx: z.number(),
  heightPx: z.number(),
});

export const ViewModeSchema = z.union([z.literal('image'), z.literal('detail')]);

export const LabelOffsetSchema = z.object({ dx: z.number(), dy: z.number() });

export const TraceProjectSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.literal(1),
  image: ImageRefSchema.nullable(),
  trace: TraceSchema,
  labels: z.record(z.string()),
  labelOffsets: z.record(LabelOffsetSchema).default({}),
  view: ViewModeSchema,
});

export type Point = z.infer<typeof PointSchema>;
export type Trace = z.infer<typeof TraceSchema>;
export type ImageRef = z.infer<typeof ImageRefSchema>;
export type ViewMode = z.infer<typeof ViewModeSchema>;
export type LabelOffset = z.infer<typeof LabelOffsetSchema>;
export type TraceProject = z.infer<typeof TraceProjectSchema>;

export type ToolMode = 'trace' | 'select' | 'label';

export type Segment = { a: Point; b: Point; index: number };

export type InteriorVertex = {
  vertex: Point;
  prev: Point;
  next: Point;
  index: number;
};
