import { ProcessedArgument } from './processed-argument';

/**
 * A value that stands for every value of its kind when a call is checked without evaluating it: the type check reads its
 * kind, and a check of an argument's own, which reads the value, passes on it.
 */
export class RepresentativeArgument extends ProcessedArgument {}
