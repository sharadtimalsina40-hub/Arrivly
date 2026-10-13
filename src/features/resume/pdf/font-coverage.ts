// Exact Unicode coverage ranges from pdfmake 0.3.11's bundled
// Roboto-Regular.ttf. Keeping this list beside the pinned dependency lets us
// reject unsupported text rather than silently replacing candidate facts with
// missing-glyph boxes. Whitespace layout controls are handled separately.
const ROBOTO_CODE_POINT_RANGES: readonly (readonly [number, number])[] = [
  [0x0020, 0x007e],
  [0x00a0, 0x017f],
  [0x018f, 0x018f],
  [0x0192, 0x0192],
  [0x01a0, 0x01a1],
  [0x01af, 0x01b0],
  [0x01f0, 0x01f0],
  [0x01fa, 0x01ff],
  [0x0218, 0x021b],
  [0x0237, 0x0237],
  [0x0259, 0x0259],
  [0x02bc, 0x02bc],
  [0x02c6, 0x02c7],
  [0x02c9, 0x02c9],
  [0x02d8, 0x02dd],
  [0x02f3, 0x02f3],
  [0x0300, 0x0301],
  [0x0303, 0x0303],
  [0x0309, 0x0309],
  [0x030f, 0x030f],
  [0x0323, 0x0323],
  [0x0384, 0x038a],
  [0x038c, 0x038c],
  [0x038e, 0x03a1],
  [0x03a3, 0x03ce],
  [0x03d1, 0x03d2],
  [0x03d6, 0x03d6],
  [0x0400, 0x0486],
  [0x0488, 0x0513],
  [0x1e00, 0x1e01],
  [0x1e3e, 0x1e3f],
  [0x1e80, 0x1e85],
  [0x1e9e, 0x1e9e],
  [0x1ea0, 0x1ef9],
  [0x1f4d, 0x1f4d],
  [0x2000, 0x200b],
  [0x2010, 0x2011],
  [0x2013, 0x2015],
  [0x2017, 0x201e],
  [0x2020, 0x2022],
  [0x2025, 0x2027],
  [0x2030, 0x2030],
  [0x2032, 0x2033],
  [0x2039, 0x203a],
  [0x203c, 0x203c],
  [0x2044, 0x2044],
  [0x2070, 0x2070],
  [0x2074, 0x208e],
  [0x20a3, 0x20a4],
  [0x20a6, 0x20ac],
  [0x20b1, 0x20b1],
  [0x20b9, 0x20ba],
  [0x20bc, 0x20bd],
  [0x20c1, 0x20c1],
  [0x2105, 0x2105],
  [0x2113, 0x2113],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
  [0x2126, 0x2126],
  [0x212e, 0x212e],
  [0x215b, 0x215e],
  [0x2202, 0x2202],
  [0x2206, 0x2206],
  [0x220f, 0x220f],
  [0x2211, 0x2212],
  [0x221a, 0x221a],
  [0x221e, 0x221e],
  [0x222b, 0x222b],
  [0x2248, 0x2248],
  [0x2260, 0x2260],
  [0x2264, 0x2265],
  [0x25a0, 0x25a0],
  [0x25ca, 0x25cb],
  [0x25cf, 0x25cf],
  [0xfb01, 0xfb04],
  [0xfeff, 0xfeff],
];

const ALLOWED_WHITESPACE_CODE_POINTS = new Set([0x0009, 0x000a, 0x000d]);
const CONTENT_KEYS = ['text', 'stack', 'ul', 'ol', 'columns'] as const;

function isSupportedCodePoint(codePoint: number): boolean {
  if (ALLOWED_WHITESPACE_CODE_POINTS.has(codePoint)) {
    return true;
  }

  return ROBOTO_CODE_POINT_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

/** Returns the first character the bundled PDF font cannot render. */
export function findUnsupportedPdfCharacter(
  content: unknown,
): string | undefined {
  if (typeof content === 'string') {
    for (const character of content) {
      const codePoint = character.codePointAt(0);

      if (codePoint !== undefined && !isSupportedCodePoint(codePoint)) {
        return character;
      }
    }

    return undefined;
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      const unsupportedCharacter = findUnsupportedPdfCharacter(item);

      if (unsupportedCharacter) {
        return unsupportedCharacter;
      }
    }

    return undefined;
  }

  if (content && typeof content === 'object') {
    const record = content as Readonly<Record<string, unknown>>;

    for (const key of CONTENT_KEYS) {
      if (key in record) {
        const unsupportedCharacter = findUnsupportedPdfCharacter(record[key]);

        if (unsupportedCharacter) {
          return unsupportedCharacter;
        }
      }
    }
  }

  return undefined;
}
