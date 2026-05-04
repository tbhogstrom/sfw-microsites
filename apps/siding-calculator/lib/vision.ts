import Anthropic from '@anthropic-ai/sdk';

export type DetectedOpening = {
  type: 'window' | 'door' | 'garage-door' | 'vent';
  /** Bounding box, all percentages of image dimensions (0-100). */
  xPct: number; // left edge, top-left origin
  yPct: number; // top edge, top-left origin
  widthPct: number;
  heightPct: number;
};

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const SYSTEM_PROMPT = `You are an architectural vision assistant. The user provides a single photo of one exterior wall. Identify every distinct opening: windows, doors, garage doors, and roof/gable vents.

For each opening, return a tight bounding box. Coordinates are percentages of the image (top-left origin, 0-100):
- xPct: left edge
- yPct: top edge
- widthPct, heightPct: size

Skip anything that is not a real opening on the wall (no shadows, reflections, decorative shutters, light fixtures, or background features behind the wall). If the photo is not a wall photo or no openings are visible, return an empty list.`;

/**
 * Use Claude vision to identify openings in a single wall photo. Returns
 * percentage-bounded boxes; the caller is responsible for mapping % → wall
 * coordinates using its own wall dimensions.
 */
export async function detectOpenings(
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<DetectedOpening[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'record_openings',
        description:
          'Record every window, door, garage door, and vent visible on the wall in the photo.',
        input_schema: {
          type: 'object',
          properties: {
            openings: {
              type: 'array',
              description:
                'List of every opening detected. Empty array if none are visible or the image is not a wall.',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['window', 'door', 'garage-door', 'vent'],
                    description:
                      'window | door | garage-door | vent. Use "garage-door" for any rolling/overhead door wide enough for a vehicle.',
                  },
                  xPct: {
                    type: 'number',
                    description: 'Left edge of bounding box, percent of image width (0-100).',
                  },
                  yPct: {
                    type: 'number',
                    description:
                      'Top edge of bounding box, percent of image height (0-100), measured from top-left.',
                  },
                  widthPct: {
                    type: 'number',
                    description: 'Width of bounding box, percent of image width (0-100).',
                  },
                  heightPct: {
                    type: 'number',
                    description: 'Height of bounding box, percent of image height (0-100).',
                  },
                },
                required: ['type', 'xPct', 'yPct', 'widthPct', 'heightPct'],
              },
            },
          },
          required: ['openings'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_openings' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Identify every opening (window, door, garage door, vent) visible on the wall. Use the record_openings tool.',
          },
        ],
      },
    ],
  });

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'record_openings') {
      const input = block.input as { openings?: DetectedOpening[] };
      return Array.isArray(input.openings) ? input.openings : [];
    }
  }
  return [];
}
