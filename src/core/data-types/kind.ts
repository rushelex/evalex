/**
 * Names the data types of formula values: the `kind` of every result is one of them, so a host narrows a result by it.
 *
 * @remarks
 * `Any` stands for every type in routine signatures and is never the kind of a value.
 *
 * @example
 * ```ts
 * const result = scope.evaluate('price * quantity', { price: 250, quantity: 4 });
 *
 * if (result.kind === Kind.Number) {
 *   result.value; // 1000, typed as number
 * }
 * ```
 */
export const Kind = {
  Any: 'Any',
  Array: 'Array',
  Boolean: 'Boolean',
  Null: 'Null',
  Number: 'Number',
  Object: 'Object',
  String: 'String',
  Date: 'Date',
  DateTime: 'DateTime',
  Duration: 'Duration',
  DateRange: 'DateRange',
  RegExp: 'RegExp',
} as const;

// eslint-disable-next-line ts/no-redeclare -- a value and a type under one name, the way an enum reads
export type Kind = (typeof Kind)[keyof typeof Kind];
