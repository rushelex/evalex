import type { FormulaDataType } from '../FormulaDataType';
import type { ToFormulaDataType } from '../types';

import { Errors } from '~/core/errors';

import { evaluate, loc } from '../../../testing-library';
import { routinesRegistry } from '../../routines/registry';
import { FormulaArray } from '../array';
import { FormulaBoolean } from '../boolean';
import { FormulaDateTime } from '../date-time';
import { FormulaNull } from '../null';
import { FormulaNumber } from '../number';
import { FormulaRegExp } from '../regexp';
import { FormulaString } from '../string';
import { FormulaObject } from './FormulaObject';

describe('FormulaObject', () => {
  describe('Constructor and Basic Functionality', () => {
    it('should accept FormulaDataType objects in constructor', () => {
      const obj = new FormulaObject({
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        active: new FormulaBoolean(true),
        score: new FormulaNull(),
      });

      expect(obj).toBeFormulaDataType(FormulaObject, {
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        active: new FormulaBoolean(true),
        score: new FormulaNull(),
      });
    });

    it('should handle nested objects', () => {
      const obj = new FormulaObject({
        user: new FormulaObject({
          name: new FormulaString('John'),
          profile: new FormulaObject({
            city: new FormulaString('New York'),
            age: new FormulaNumber(30),
          }),
        }),
        metadata: new FormulaObject({
          created: new FormulaString('2025-01-01'),
        }),
      });

      expect(obj).toBeFormulaDataType(FormulaObject, {
        user: new FormulaObject({
          name: new FormulaString('John'),
          profile: new FormulaObject({
            city: new FormulaString('New York'),
            age: new FormulaNumber(30),
          }),
        }),
        metadata: new FormulaObject({
          created: new FormulaString('2025-01-01'),
        }),
      });
    });

    it('should handle arrays within objects', () => {
      const obj = new FormulaObject({
        tags: new FormulaArray([
          new FormulaString('javascript'),
          new FormulaString('typescript'),
        ]),
        numbers: new FormulaArray([
          new FormulaNumber(1),
          new FormulaNumber(2),
          new FormulaNumber(3),
        ]),
        mixed: new FormulaArray([
          new FormulaString('text'),
          new FormulaNumber(42),
          new FormulaBoolean(true),
          new FormulaNull(),
        ]),
      });

      expect(obj).toBeFormulaDataType(FormulaObject, {
        tags: new FormulaArray([
          new FormulaString('javascript'),
          new FormulaString('typescript'),
        ]),
        numbers: new FormulaArray([
          new FormulaNumber(1),
          new FormulaNumber(2),
          new FormulaNumber(3),
        ]),
        mixed: new FormulaArray([
          new FormulaString('text'),
          new FormulaNumber(42),
          new FormulaBoolean(true),
          new FormulaNull(),
        ]),
      });
    });
  });

  describe('"convert" Static Method with Plain Objects', () => {
    it('should convert plain JavaScript object to Record<string, FormulaDataType>', () => {
      const plainObj = {
        name: 'John',
        age: 30,
        active: true,
        score: null,
      };

      const converted = FormulaObject.convert(plainObj);
      const formulaObj = new FormulaObject(converted);

      expect(formulaObj).toBeFormulaDataType(FormulaObject, {
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        active: new FormulaBoolean(true),
        score: new FormulaNull(),
      });
    });

    it('should handle nested objects in convert', () => {
      const plainObj = {
        user: {
          name: 'John',
          details: {
            city: 'New York',
            age: 30,
          },
        },
      };

      const converted = FormulaObject.convert(plainObj);
      const formulaObj = new FormulaObject(converted);

      expect(formulaObj).toBeFormulaDataType(FormulaObject, {
        user: new FormulaObject({
          name: new FormulaString('John'),
          details: new FormulaObject({
            city: new FormulaString('New York'),
            age: new FormulaNumber(30),
          }),
        }),
      });
    });

    it('should handle arrays in convert', () => {
      const plainObj = {
        tags: ['javascript', 'typescript'],
        numbers: [1, 2, 3],
        mixed: ['text', 42, true],
      };

      const converted = FormulaObject.convert(plainObj);
      const formulaObj = new FormulaObject(converted);

      expect(formulaObj).toBeInstanceOf(FormulaObject);
      expect(formulaObj.value.tags).toBeFormulaDataType(FormulaArray, [
        new FormulaString('javascript'),
        new FormulaString('typescript'),
      ]);
      expect(formulaObj.value.numbers).toBeFormulaDataType(FormulaArray, [
        new FormulaNumber(1),
        new FormulaNumber(2),
        new FormulaNumber(3),
      ]);
      expect(formulaObj.value.mixed).toBeFormulaDataType(FormulaArray, [
        new FormulaString('text'),
        new FormulaNumber(42),
        new FormulaBoolean(true),
      ]);
    });

    it('should handle special values in convert', () => {
      const plainObj = {
        nullValue: null,
        undefinedValue: undefined,
        date: new Date('2025-01-01'),
        regex: /test/g,
      };

      const converted = FormulaObject.convert(plainObj);
      const formulaObj = new FormulaObject(converted);

      expect(formulaObj).toBeFormulaDataType(FormulaObject, {
        nullValue: new FormulaNull(),
        undefinedValue: new FormulaNull(),
        date: FormulaDateTime.from(new Date('2025-01-01')),
        regex: new FormulaRegExp('test', 'g'),
      });
    });

    it('should convert an object that contains itself to an object that links back to itself', () => {
      const obj: Record<string, unknown> = { name: 'John' };
      obj.self = obj;

      const fields: Record<string, FormulaDataType> = FormulaObject.convert(obj);
      const self = fields.self;

      expect(self instanceof FormulaObject && self.value.self).toBe(self);
    });
  });

  describe('"from" Static Method', () => {
    it('should convert plain JavaScript object to FormulaObject instance', () => {
      const plainObj = {
        name: 'John',
        age: 30,
        active: true,
        score: null,
      };

      const formulaObj = FormulaObject.from(plainObj);

      expect(formulaObj).toBeFormulaDataType(FormulaObject, {
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        active: new FormulaBoolean(true),
        score: new FormulaNull(),
      });
    });
  });

  describe('isEmpty and toString', () => {
    it('should return true for empty object', () => {
      const obj = new FormulaObject({});
      expect(obj.isEmpty()).toBe(true);
    });

    it('should return false for non-empty object', () => {
      const obj = new FormulaObject({
        name: new FormulaString('John'),
      });
      expect(obj.isEmpty()).toBe(false);
    });

    it('should return formatted string representation', () => {
      const obj = new FormulaObject({
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        tags: new FormulaArray([new FormulaString('javascript'), new FormulaString('typescript')]),
      });

      const result = obj.toString();
      expect(result).toBe('{ name: "John", age: 30, tags: ["javascript", "typescript"] }');
    });

    it('should handle empty object toString', () => {
      const obj = new FormulaObject({});
      expect(obj.toString()).toBe('{}');
    });
  });

  describe('Dynamic Field Access', () => {
    it('should support dynamic field access through formulas', () => {
      const result = evaluate('obj.name()', {
        context: {
          obj: new FormulaObject({
            name: new FormulaString('John'),
            age: new FormulaNumber(30),
          }),
        },
      });

      expect(result).toBeFormulaDataType(FormulaString, 'John');
    });

    it('should support nested field access', () => {
      const result = evaluate('obj.user().profile().city()', {
        context: {
          obj: new FormulaObject({
            user: new FormulaObject({
              profile: new FormulaObject({
                city: new FormulaString('New York'),
                country: new FormulaString('USA'),
              }),
            }),
          }),
        },
      });

      expect(result).toBeFormulaDataType(FormulaString, 'New York');
    });

    it('should return error for non-existent fields', () => {
      expect(() => {
        evaluate('obj.nonExistent()', {
          context: {
            obj: new FormulaObject({
              name: new FormulaString('John'),
            }),
          },
        });
      }).toThrow(Errors.Reference.FieldNotDefined.create({ name: 'nonExistent', target: 'Object' }, { location: loc(4, 15) }));
    });

    it('should return error when field access has arguments', () => {
      expect(() => {
        evaluate('obj.name("arg")', {
          context: {
            obj: new FormulaObject({
              name: new FormulaString('John'),
            }),
          },
        });
      }).toThrow(Errors.Argument.ExactCount.create(
        { actual: 1, expected: 0 },
        { location: loc(4, 8) },
      ));
    });
  });

  describe('Core Methods Inheritance', () => {
    it('should support empty() method', () => {
      const emptyObj = new FormulaObject({});
      const nonEmptyObj = new FormulaObject({
        name: new FormulaString('John'),
      });

      expect(emptyObj.isEmpty()).toBe(true);
      expect(nonEmptyObj.isEmpty()).toBe(false);

      // Test through formula evaluation
      const emptyResult = evaluate('emptyObj.empty()', {
        context: { emptyObj },
      });

      const nonEmptyResult = evaluate('nonEmptyObj.empty()', {
        context: { nonEmptyObj },
      });

      expect(emptyResult).toBeFormulaDataType(FormulaBoolean, true);
      expect(nonEmptyResult).toBeFormulaDataType(FormulaBoolean, false);
    });

    it('should support format() method', () => {
      const obj = new FormulaObject({
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
      });

      const result = evaluate('obj.format()', {
        context: { obj },
      });

      expect(result).toBeFormulaDataType(FormulaString, '{ name: "John", age: 30 }');
    });

    it('should prioritize static methods over field access', () => {
      const result = evaluate('obj.empty()', {
        context: {
          obj: new FormulaObject({
            empty: new FormulaString('field value'), // This should be ignored
            name: new FormulaString('John'),
          }),
        },
      });

      // Should call static empty() method, not access field
      expect(result).toBeFormulaDataType(FormulaBoolean, false);
    });
  });

  describe('Integration with Formula Evaluation System', () => {
    it('should work with basic formula evaluation', () => {
      const productData = {
        name: 'Test Product',
        price: 29.99,
        quantity: 3,
      };

      const product = FormulaObject.from(productData);
      const context = { product };

      const result = evaluate('product.price() * product.quantity()', { context });

      expect(result).toBeFormulaDataType(FormulaNumber, 89.97);
    });

    it('should work with nested object access in formulas', () => {
      const orderData = {
        customer: {
          name: 'John Doe',
          tier: 'premium',
        },
        items: [
          { name: 'Widget A', price: 10 },
          { name: 'Widget B', price: 15 },
        ],
      };

      const order = FormulaObject.from(orderData);
      const context = { order };

      const customerName = evaluate('order.customer().name()', { context });
      expect(customerName).toBeFormulaDataType(FormulaString, 'John Doe');

      const itemCount = evaluate('order.items().length()', { context });
      expect(itemCount).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should work with conditional logic', () => {
      const userData = {
        age: 25,
        status: 'active',
        permissions: ['read', 'write'],
      };

      const user = FormulaObject.from(userData);
      const context = { user };

      const accessLevel = evaluate(
        'if(user.age() >= 18 && user.status() == "active", "full", "limited")',
        { context },
      );

      expect(accessLevel).toBeFormulaDataType(FormulaString, 'full');
    });

    it('should work with array operations on object properties', () => {
      const teamData = {
        name: 'Development Team',
        members: [
          { name: 'Alice', salary: 75000 },
          { name: 'Bob', salary: 80000 },
          { name: 'Charlie', salary: 70000 },
        ],
      };

      const team = FormulaObject.from(teamData);
      const context = { team };

      // Test array mapping on nested object properties
      const totalSalary = evaluate(
        'sum(team.members().map(current.salary()))',
        { context },
      );

      expect(totalSalary).toBeFormulaDataType(FormulaNumber, 225000);
    });

    it('should handle complex business logic scenarios', () => {
      const orderData = {
        items: [
          { name: 'Product A', price: 100, quantity: 2, category: 'electronics' },
          { name: 'Product B', price: 50, quantity: 1, category: 'books' },
        ],
        customer: {
          tier: 'premium',
          discount: 0.1,
        },
        shipping: {
          cost: 15,
          freeThreshold: 200,
        },
      };

      const order = FormulaObject.from(orderData);
      const context = { order };

      // Calculate subtotal
      const subtotal = evaluate(
        'sum(order.items().map(current.price() * current.quantity()))',
        { context },
      );
      expect(subtotal).toBeFormulaDataType(FormulaNumber, 250); // (100*2) + (50*1) = 250

      // Apply customer discount
      const discountedTotal = evaluate(
        'sum(order.items().map(current.price() * current.quantity())) * (1 - order.customer().discount())',
        { context },
      );
      expect(discountedTotal).toBeFormulaDataType(FormulaNumber, 225); // 250 * 0.9 = 225

      // Calculate shipping (free if over threshold)
      const shippingCost = evaluate(
        'if(sum(order.items().map(current.price() * current.quantity())) >= order.shipping().freeThreshold(), 0, order.shipping().cost())',
        { context },
      );
      expect(shippingCost).toBeFormulaDataType(FormulaNumber, 0); // Free shipping since 250 >= 200

      // Final total with discount and shipping
      const finalTotal = evaluate(`
        sum(order.items().map(current.price() * current.quantity())) *
        (1 - order.customer().discount()) +
        if(sum(order.items().map(current.price() * current.quantity())) >= order.shipping().freeThreshold(),
           0,
           order.shipping().cost())
      `, { context });

      expect(finalTotal).toBeFormulaDataType(FormulaNumber, 225); // 225 + 0 = 225
    });

    it('should work with mixed data types in context', () => {
      const configData = {
        app: {
          name: 'MyApp',
          version: '1.2.3',
        },
        features: {
          darkMode: true,
          notifications: false,
        },
      };

      const config = FormulaObject.from(configData);
      const basePrice = new FormulaNumber(99.99);
      const taxRate = new FormulaNumber(0.08);

      const context = { config, basePrice, taxRate };

      // Mix object access with regular formula variables
      const result = evaluate(
        'config.app().name() + " v" + config.app().version() + " - Total: " + (basePrice * (1 + taxRate))',
        { context },
      );

      expect(result).toBeFormulaDataType(FormulaString, 'MyApp v1.2.3 - Total: 107.9892');
    });

    it('should handle error cases gracefully', () => {
      const data = {
        user: {
          name: 'Test User',
        },
      };

      const obj = FormulaObject.from(data);
      const context = { obj };

      // Test accessing non-existent property
      expect(() => {
        evaluate('obj.nonExistent()', { context });
      }).toThrow(Errors.Reference.FieldNotDefined.create(
        { name: 'nonExistent', target: 'Object' },
        { location: loc(4, 15) },
      ));

      // Test accessing property with arguments (should fail)
      expect(() => {
        evaluate('obj.user("invalid")', { context });
      }).toThrow(Errors.Argument.ExactCount.create(
        { actual: 1, expected: 0 },
        { location: loc(4, 8) },
      ));
    });
  });

  describe('Inheritance from FormulaObject', () => {
    it('should inherit properties and methods', () => {
      interface PersonData {
        name: string;
        age: number;
        preferences: {
          theme: string;
        };
      }

      class FormulaPerson extends FormulaObject<ToFormulaDataType<PersonData>> {
        constructor(value: ToFormulaDataType<PersonData>) {
          super(value, 'Person');
        }
      }

      routinesRegistry.registerMethod(FormulaPerson, 'isAdult', {
        description: 'Checks if the user is an adult',
        examples: [
          {
            formula: (name) => name('person'),
            result: () => new FormulaBoolean(true),
          },
        ],
        arguments: [],
        handler: ({ instance }) => {
          return new FormulaBoolean(instance.value.age.value >= 18);
        },
      });

      const obj = new FormulaPerson({
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        preferences: new FormulaObject({
          theme: new FormulaString('dark'),
        }),
      });

      expect(obj).toBeFormulaDataType(FormulaObject, {
        name: new FormulaString('John'),
        age: new FormulaNumber(30),
        preferences: new FormulaObject({
          theme: new FormulaString('dark'),
        }),
      });

      const result = evaluate('person.isAdult()', { context: { person: obj } });
      expect(result).toBeFormulaDataType(FormulaBoolean, true);
    });
  });

  describe('Performance with Complex Objects', () => {
    it('should handle large nested objects efficiently', () => {
      const largeData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          profile: {
            age: 20 + (i % 50),
            department: `Dept ${i % 10}`,
            salary: 50000 + (i * 1000),
          },
        })),
      };

      const data = FormulaObject.from(largeData);
      const context = { data };

      const start = performance.now();

      // Access nested property in large dataset
      const result = evaluate('data.users().length()', { context });

      const end = performance.now();
      const executionTime = end - start;

      expect(result).toBeFormulaDataType(FormulaNumber, 100);
      expect(executionTime).toBeLessThan(50); // Should complete within 50ms
    });
  });

  describe('FormulaRegExp Integration', () => {
    it('should work with FormulaRegExp objects in FormulaObject', () => {
      const data = {
        pattern: /\d+/g,
        text: 'Hello 42 world 101',
      };

      const obj = FormulaObject.from(data);
      const context = { obj };

      // Test that regex is properly converted
      expect(obj.value.pattern).toBeInstanceOf(FormulaRegExp);

      // Test using regex in formula evaluation
      const result = evaluate('obj.text().match(obj.pattern())', { context });

      expect(result).toBeFormulaDataType(FormulaArray, [
        new FormulaString('42'),
        new FormulaString('101'),
      ]);
    });

    it('should handle complex objects with regex patterns', () => {
      const validationRules = {
        email: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/,
        // eslint-disable-next-line regexp/strict
        phone: /^\+?[\d\s-()]+$/,
        zipCode: /^\d{5}(-\d{4})?$/,
      };

      const rules = FormulaObject.from(validationRules);

      expect(rules.value.email).toBeFormulaDataType(FormulaRegExp, { pattern: '^[^\\s@]+@[^\\s@][^\\s.@]*\\.[^\\s@]+$', flags: '' });
      expect(rules.value.phone).toBeFormulaDataType(FormulaRegExp, { pattern: '^\\+?[\\d\\s-()]+$', flags: '' });
      expect(rules.value.zipCode).toBeFormulaDataType(FormulaRegExp, { pattern: '^\\d{5}(-\\d{4})?$', flags: '' });
    });
  });
});
