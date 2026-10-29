/**
 * Returns the name of a routine argument, refusing a blank one.
 *
 * @remarks
 * Signature help shows the name and error messages name the argument by it, so a blank name would show as nothing.
 *
 * @throws Error when the name is empty or only whitespace.
 */
export function argumentName(name: string): string {
  if (name.trim() === '') {
    throw new Error(`An argument name must not be blank, got "${name}".`);
  }

  return name;
}
