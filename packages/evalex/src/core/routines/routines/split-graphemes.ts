// Text routines count user-perceived characters, so an emoji sequence like 👨‍👩‍👧 is one character
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Splits text into user-perceived characters (grapheme clusters), the unit every text routine counts in. */
export function splitGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}
