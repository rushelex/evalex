import { defineCoreMethods } from '../core-methods';
import { FormulaRegExp } from './FormulaRegExp';

defineCoreMethods(FormulaRegExp);

// FormulaRegExp doesn't need additional methods beyond core methods (empty, format)
// It's primarily used as input for FormulaString regex methods
