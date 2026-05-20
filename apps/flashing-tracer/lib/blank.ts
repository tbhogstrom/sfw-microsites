import { ulid } from 'ulid';
import type { TraceProject } from './types';

export function blankProject(): TraceProject {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    image: null,
    trace: { points: [], inchesPerPixel: null },
    labels: {},
    labelOffsets: {},
    view: 'image',
  };
}
