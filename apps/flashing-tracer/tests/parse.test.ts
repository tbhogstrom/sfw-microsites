import { describe, expect, it } from 'vitest';
import { formatLength, parseLength } from '@/lib/parse';

describe('parseLength', () => {
  const cases: Array<[string, number]> = [
    ['42', 42],
    ['42.5', 42.5],
    ['42"', 42],
    ['42 1/2', 42.5],
    ['42 1/2"', 42.5],
    ['1/2', 0.5],
    ['1/2"', 0.5],
    ["3'", 36],
    ["0.5'", 6],
    ['3\' 6"', 42],
    ['3\'-6"', 42],
    ['3\'-6 1/2"', 42.5],
    ["3' 6 1/2", 42.5],
  ];

  for (const [input, expected] of cases) {
    it(`parses "${input}" → ${expected}`, () => {
      expect(parseLength(input)).toBeCloseTo(expected, 6);
    });
  }

  const rejects = ['', '   ', 'abc', '3 / 0', "3'-", 'banana 1/2', '1//2'];
  for (const input of rejects) {
    it(`rejects "${input}"`, () => {
      expect(parseLength(input)).toBeNull();
    });
  }
});

describe('formatLength', () => {
  it('renders short inches without feet', () => {
    expect(formatLength(0.5).ftIn).toBe('1/2"');
    expect(formatLength(11.5).ftIn).toBe('11 1/2"');
  });

  it('renders feet and inches with reduced fraction', () => {
    expect(formatLength(42.5).ftIn).toBe(`3'-6 1/2"`);
    expect(formatLength(42).ftIn).toBe(`3'-6"`);
    expect(formatLength(36).ftIn).toBe(`3'-0"`);
  });

  it('rounds to nearest sixteenth', () => {
    expect(formatLength(0.0625).ftIn).toBe('1/16"');
    expect(formatLength(0.03).ftIn).toBe('0"');
  });

  it('renders three-decimal inches', () => {
    expect(formatLength(42.5).decimal).toBe('42.500"');
  });

  it('handles non-finite gracefully', () => {
    expect(formatLength(Number.NaN).decimal).toBe('—');
    expect(formatLength(Number.POSITIVE_INFINITY).ftIn).toBe('—');
  });
});
