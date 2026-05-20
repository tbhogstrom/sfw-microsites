/**
 * Parse a length into decimal inches.
 * Accepts: `42`, `42.5`, `42 1/2`, `42 1/2"`, `3'`, `3' 6"`, `3'-6"`,
 * `3'-6 1/2"`, `0.5'`, `42"`. Returns null on failure or non-finite result.
 */
export function parseLength(input: string): number | null {
  if (input == null) return null;
  let s = input.trim();
  if (!s) return null;

  // Strip a single trailing inch mark.
  s = s.replace(/["”]\s*$/u, '').trim();
  if (!s) return null;

  // Form with a feet mark: split on the first `'`.
  const apostropheIdx = s.indexOf("'");
  if (apostropheIdx >= 0) {
    const feetStr = s.slice(0, apostropheIdx).trim();
    const afterFoot = s.slice(apostropheIdx + 1).trim();

    if (!/^-?\d+(?:\.\d+)?$/.test(feetStr)) return null;
    const ft = Number(feetStr);
    if (!Number.isFinite(ft)) return null;

    if (afterFoot === '') return ft * 12;

    // A hyphen separator is allowed only when inches follow it.
    let inchStr = afterFoot;
    if (inchStr.startsWith('-')) {
      inchStr = inchStr.slice(1).trim();
      if (inchStr === '') return null;
    }
    const inches = parseInchesPart(inchStr);
    if (inches == null) return null;
    return ft * 12 + inches;
  }

  return parseInchesPart(s);
}

function parseInchesPart(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Plain fraction `1/2`.
  const fracOnly = s.match(/^(-?\d+)\/(\d+)$/u);
  if (fracOnly) {
    const num = Number(fracOnly[1]);
    const den = Number(fracOnly[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }

  // Mixed `42 1/2`.
  const mixed = s.match(/^(-?\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/u);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return null;
    }
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (num / den);
  }

  // Plain decimal.
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

/**
 * Format decimal inches as both a feet-and-inches string (nearest 1/16")
 * and a three-decimal inches string.
 */
export function formatLength(decimalInches: number): { ftIn: string; decimal: string } {
  if (!Number.isFinite(decimalInches)) return { ftIn: '—', decimal: '—' };
  const decimal = `${decimalInches.toFixed(3)}"`;
  const ftIn = formatFeetInches(decimalInches);
  return { ftIn, decimal };
}

function formatFeetInches(decimalInches: number): string {
  const sign = decimalInches < 0 ? '-' : '';
  const abs = Math.abs(decimalInches);
  const totalSixteenths = Math.round(abs * 16);
  const feet = Math.floor(totalSixteenths / (12 * 16));
  const remSixteenths = totalSixteenths - feet * 12 * 16;
  const whole = Math.floor(remSixteenths / 16);
  const frac = remSixteenths - whole * 16;
  const fracPart = frac === 0 ? '' : reduceFraction(frac, 16);

  if (feet > 0) {
    const inchBody = fracPart ? `${whole} ${fracPart}` : `${whole}`;
    return `${sign}${feet}'-${inchBody}"`;
  }
  if (whole === 0 && fracPart) return `${sign}${fracPart}"`;
  if (fracPart) return `${sign}${whole} ${fracPart}"`;
  return `${sign}${whole}"`;
}

function reduceFraction(num: number, den: number): string {
  const g = gcd(num, den);
  return `${num / g}/${den / g}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
