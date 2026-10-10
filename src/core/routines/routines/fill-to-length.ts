import type { AST } from '../../../parser';

import { Errors } from '../../errors';
import { splitGraphemes } from './split-graphemes';

interface FillToLengthOptions {
  readonly text: string;
  /** Length to reach, in characters. */
  readonly length: number;
  readonly padding: string;
  /** Location of the length argument, blamed when the result would not fit in a JavaScript string. */
  readonly lengthLocation: AST.Location;
}

/**
 * Padding that `padStart` and `padEnd` add to reach the length, counted in characters as every text routine counts.
 *
 * @remarks
 * Empty when the text is already long enough or the padding is empty. The padding repeats and its last copy is cut.
 *
 * @throws FormulaError `Validation` pointing at the length, when the result would be too long for a JavaScript string.
 */
export function fillToLength({ text, length, padding, lengthLocation }: FillToLengthOptions): string {
  const fill = splitGraphemes(padding);
  const missing = length - splitGraphemes(text).length;

  if (missing <= 0 || fill.length === 0) {
    return '';
  }

  try {
    return padding.repeat(Math.floor(missing / fill.length)) + fill.slice(0, missing % fill.length).join('');
  }
  catch (error) {
    throw Errors.Argument.Validation.create({
      message: 'Expected a smaller length: the text would be too long.',
      expected: ['smaller length'],
      actual: length,
      argumentPosition: 2,
    }, { location: lengthLocation, cause: error instanceof Error ? error : undefined });
  }
}
