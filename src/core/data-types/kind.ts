export const Kind = {
  Any: 'Any',
  Array: 'Array',
  Boolean: 'Boolean',
  Null: 'Null',
  Number: 'Number',
  Object: 'Object',
  String: 'String',
  Date: 'Date',
  Duration: 'Duration',
  DateRange: 'DateRange',
  RegExp: 'RegExp',
} as const;

// eslint-disable-next-line ts/no-redeclare -- a value and a type under one name, the way an enum reads
export type Kind = (typeof Kind)[keyof typeof Kind];
