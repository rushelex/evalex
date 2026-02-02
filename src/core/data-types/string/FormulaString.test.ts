import { Errors } from '~/core/errors';

import { evaluate, loc } from '../../../testing-library';
import { FormulaArray } from '../array';
import { FormulaBoolean } from '../boolean';
import { FormulaRegExp } from '../regexp';
import { FormulaString } from './FormulaString';

describe('FormulaString', () => {
  describe('Initialization', () => {
    it('should initialize from string', () => {
      const result = new FormulaString('hello');
      expect(result).toBeFormulaDataType(FormulaString, 'hello');
    });
  });

  describe('Own Methods', () => {
    describe('upper', () => {
      it('should convert text to uppercase', () => {
        const result = evaluate('"hello".upper()');
        expect(result).toBeFormulaDataType(FormulaString, 'HELLO');
      });

      it('should not convert empty text to uppercase', () => {
        const result = evaluate('"".upper()');
        expect(result).toBeFormulaDataType(FormulaString, '');
      });

      it('should throw error when upper() method is called with arguments', () => {
        expect(() => {
          evaluate('"hello".upper("arg")');
        }).toThrow(Errors.Argument.ExactCount.create(
          { actual: 1, expected: 0 },
          { location: loc(8, 13) },
        ));
      });
    });

    describe('lower', () => {
      it('should convert text to lowercase', () => {
        const result = evaluate('"HELLO".lower()');
        expect(result).toBeFormulaDataType(FormulaString, 'hello');
      });

      it('should not convert empty text to lowercase', () => {
        const result = evaluate('"".lower()');
        expect(result).toBeFormulaDataType(FormulaString, '');
      });

      it('should throw error when lower() method is called with arguments', () => {
        expect(() => {
          evaluate('"hello".lower("arg")');
        }).toThrow(
          Errors.Argument.ExactCount.create(
            { actual: 1, expected: 0 },
            { location: loc(8, 13) },
          ),
        );
      });
    });

    describe('trim', () => {
      it('should return the string with leading and trailing whitespace removed', () => {
        const result = evaluate('"  hello  ".trim()');
        expect(result).toBeFormulaDataType(FormulaString, 'hello');
        if (result instanceof FormulaString) {
          expect(result.value).toBe('hello');
        }
      });

      it('should return the same string if there is no leading or trailing whitespace', () => {
        const result = evaluate('"hello".trim()');
        expect(result).toBeFormulaDataType(FormulaString, 'hello');
        if (result instanceof FormulaString) {
          expect(result.value).toBe('hello');
        }
      });

      it('should return an empty string if the string is empty', () => {
        const result = evaluate('"".trim()');
        expect(result).toBeFormulaDataType(FormulaString, '');
      });

      it('should throw error when trim() method is called with arguments', () => {
        expect(() => {
          evaluate('"hello".trim("arg")');
        }).toThrow(
          Errors.Argument.ExactCount.create(
            { actual: 1, expected: 0 },
            { location: loc(8, 12) },
          ),
        );
      });
    });

    describe('match', () => {
      it('should find all matches with global flag', () => {
        const result = evaluate('"Hello 42 world 101".match("\\\\d+", "g")');

        expect(result).toBeFormulaDataType(FormulaArray, [
          new FormulaString('42'),
          new FormulaString('101'),
        ]);
      });

      it('should find first match without global flag', () => {
        const result = evaluate('"Hello 42 world 101".match("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaArray, [
          new FormulaString('42'),
        ]);
      });

      it('should return empty array when no matches found', () => {
        const result = evaluate('"Hello world".match("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaArray, []);
      });

      it('should work with case insensitive flag', () => {
        const result = evaluate('"Hello WORLD".match("hello", "i")');
        expect(result).toBeFormulaDataType(FormulaArray, [
          new FormulaString('Hello'),
        ]);
      });

      it('should throw error for unsupported arguments', () => {
        expect(() => {
          evaluate('"test".match(42)');
        }).toThrow(
          Errors.Argument.PatternMismatch.create(
            {
              patterns: [
                { patternIndex: 0, message: 'Expected type String.', location: loc(13, 15) },
                { patternIndex: 1, message: 'Expected type RegExp.', location: loc(13, 15) },
              ],
            },
            { location: loc(7, 12) },
          ),
        );

        expect(() => {
          evaluate(
            '"test".match(regexp, "g")',
            { context: { regexp: new FormulaRegExp('test', 'i') } },
          );
        }).toThrow(Errors.Argument.TypeMismatch.create(
          { actual: 'RegExp', expected: ['String'], argumentPosition: 1 },
          { location: loc(13, 19) },
        ));
      });

      it('should throw error for invalid regex pattern', () => {
        expect(() => {
          evaluate('"test".match("[")');
        }).toThrow(Errors.Evaluation.InvalidRegExp.create(
          {
            reason: 'Invalid regular expression: /[/: Unterminated character class',
            expression: '"test".match("[")',
          },
          { location: loc(7, 12) },
        ));
      });
    });

    describe('test', () => {
      it('should return true when pattern matches', () => {
        const result = evaluate('"Hello 123".test("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should return false when pattern does not match', () => {
        const result = evaluate('"Hello world".test("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaBoolean, false);
      });

      it('should work with case insensitive flag', () => {
        const result = evaluate('"Hello".test("hello", "i")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should throw error for invalid regex pattern', () => {
        expect(() => {
          evaluate('"test".test("[")');
        }).toThrow(Errors.Evaluation.InvalidRegExp.create(
          {
            reason: 'Invalid regular expression: /[/: Unterminated character class',
            expression: '"test".test("[")',
          },
          { location: loc(7, 11) },
        ));
      });
    });

    describe('replace', () => {
      it('should replace first match', () => {
        const result = evaluate('"Hello world".replace("world", "universe")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello universe');
      });

      it('should replace first match with regex pattern', () => {
        const result = evaluate('"Hello 123 world 456".replace("\\\\d+", "XXX")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello XXX world 456');
      });

      it('should work with case insensitive flag', () => {
        const result = evaluate('"Hello WORLD".replace("world", "universe", "i")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello universe');
      });

      it('should return original string when no match found', () => {
        const result = evaluate('"Hello world".replace("\\\\d+", "XXX")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello world');
      });

      it('should throw error for invalid regex pattern', () => {
        expect(() => {
          evaluate('"test".replace("[", "replacement")');
        }).toThrow(Errors.Evaluation.InvalidRegExp.create(
          {
            reason: 'Invalid regular expression: /[/: Unterminated character class',
            expression: '"test".replace("[", "replacement")',
          },
          { location: loc(7, 14) },
        ));
      });
    });

    describe('replaceAll', () => {
      it('should replace all matches', () => {
        const result = evaluate('"Hello 123 world 456".replaceAll("\\\\d+", "XXX")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello XXX world XXX');
      });

      it('should replace all literal matches', () => {
        const result = evaluate('"foo bar foo baz".replaceAll("foo", "qux")');
        expect(result).toBeFormulaDataType(FormulaString, 'qux bar qux baz');
      });

      it('should work with case insensitive flag', () => {
        const result = evaluate('"Hello HELLO hello".replaceAll("hello", "hi", "i")');
        expect(result).toBeFormulaDataType(FormulaString, 'hi hi hi');
      });

      it('should return original string when no match found', () => {
        const result = evaluate('"Hello world".replaceAll("\\\\d+", "XXX")');
        expect(result).toBeFormulaDataType(FormulaString, 'Hello world');
      });

      it('should throw error for invalid regex pattern', () => {
        expect(() => {
          evaluate('"test".replaceAll("[", "replacement")');
        }).toThrow(Errors.Evaluation.InvalidRegExp.create(
          {
            reason: 'Invalid regular expression: /[/: Unterminated character class',
            expression: '"test".replaceAll("[", "replacement")',
          },
          { location: loc(7, 17) },
        ));
      });
    });

    describe('contains', () => {
      it('should return true when pattern is found', () => {
        const result = evaluate('"Hello world".contains("wor")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should return false when pattern is not found', () => {
        const result = evaluate('"Hello world".contains("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaBoolean, false);
      });

      it('should work with regex patterns', () => {
        const result = evaluate('"Hello 123".contains("\\\\d+")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should work with case insensitive flag', () => {
        const result = evaluate('"Hello".contains("hello", "i")');
        expect(result).toBeFormulaDataType(FormulaBoolean, true);
      });

      it('should throw error for invalid regex pattern', () => {
        expect(() => {
          evaluate('"test".contains("[")');
        }).toThrow(Errors.Evaluation.InvalidRegExp.create(
          {
            reason: 'Invalid regular expression: /[/: Unterminated character class',
            expression: '"test".contains("[")',
          },
          { location: loc(7, 15) },
        ));
      });
    });
  });
});
