import { SyntaxError } from '~/parser/grammar/syntax-error';

// `instanceof` reads the code of a generic error class as `any`
export function isSyntaxError(value: unknown): value is SyntaxError {
  return value instanceof SyntaxError;
}
