import { SyntaxError } from '../../parser/grammar/parser';
import { FormulaNumber, FormulaString } from '../data-types';
import { FormulaError } from '../errors';
import { Formula } from '../formula';
import { FormulaScope } from '../formula-scope';

const scope = new FormulaScope();

describe('FormulaEvaluator', () => {
  describe('formula cells', () => {
    it('should compute a formula over the fields of its own record', () => {
      const view = scope.evaluator().evaluate({ price: 250, quantity: 4, cost: new Formula('price * quantity') });

      expect(view.cost).toBeFormulaDataType(FormulaNumber, 1000);
    });

    it('should compute a formula that reads other formulas, whatever their order in the record', () => {
      const view = scope.evaluator().evaluate({ c: new Formula('b * 2'), b: new Formula('a + 1'), a: 1 });

      expect(view.c).toBeFormulaDataType(FormulaNumber, 4);
      expect(view.b).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should compute a formula held directly by a list', () => {
      const view = scope.evaluator().evaluate({ n: 2, items: [new Formula('n * 2'), 5] });

      expect(view.items[0]).toBeFormulaDataType(FormulaNumber, 4);
      expect(view.items[1]).toBe(5);
    });

    it('should compute the formulas a formula reads as items of a list', () => {
      const view = scope.evaluator().evaluate({ total: new Formula('items.sum()'), items: [new Formula('1 + 1'), 3] });

      expect(view.total).toBeFormulaDataType(FormulaNumber, 5);
    });

    it('should compute the formulas of records read through a list', () => {
      const view = scope.evaluator().evaluate({
        total: new Formula('orders.map(current.double()).sum()'),
        orders: [{ amount: 1, double: new Formula('amount * 2') }, { amount: 2, double: new Formula('amount * 2') }],
      });

      expect(view.total).toBeFormulaDataType(FormulaNumber, 6);
    });

    it('should compute a formula of a record read through a field', () => {
      const view = scope.evaluator().evaluate({
        total: new Formula('project.cost() + 1'),
        project: { rate: 10, hours: 3, cost: new Formula('rate * hours') },
      });

      expect(view.total).toBeFormulaDataType(FormulaNumber, 31);
    });

    it('should recompute after the host changes its data', () => {
      const evaluator = scope.evaluator();
      const form = { area: 2, cost: new Formula('area * 10') };

      evaluator.evaluate(form);
      form.area = 3;

      expect(evaluator.evaluate(form).cost).toBeFormulaDataType(FormulaNumber, 30);
    });

    it('should turn values into text with the formatters of the scope', () => {
      const evaluator = new FormulaScope({ format: { number: (number) => `<${number}>` } }).evaluator();

      expect(evaluator.evaluate({ n: 1, text: new Formula('"x" + n') }).text).toBeFormulaDataType(FormulaString, 'x<1>');
    });
  });

  describe('names', () => {
    it('should read a name of an enclosing object, skipping lists', () => {
      const view = scope.evaluator().evaluate({ taxRate: 0.2, orders: [{ amount: 100, tax: new Formula('amount * taxRate') }] });

      expect(view.orders[0]?.tax).toBeFormulaDataType(FormulaNumber, 20);
    });

    it('should let a field of the own record hide a field of the same name further out', () => {
      const view = scope.evaluator().evaluate({ rate: 2, group: { rate: 3, value: new Formula('rate') } });

      expect(view.group.value).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should read a list by the name of the field that holds it, at any depth', () => {
      const view = scope.evaluator().evaluate({
        orders: [{ amount: 1 }, { amount: 2 }],
        summary: { totals: { all: new Formula('orders.map(current.amount()).sum()') } },
      });

      expect(view.summary.totals.all).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should read no names from a list', () => {
      const view = scope.evaluator().evaluate({ length: 5, items: [{ value: new Formula('length') }] });

      expect(view.items[0]?.value).toBeFormulaDataType(FormulaNumber, 5);
    });

    it('should not read a field holding a function, looking further out instead', () => {
      const view = scope.evaluator().evaluate({ rate: 2, group: { rate: () => 3, value: new Formula('rate') } });

      expect(view.group.value).toBeFormulaDataType(FormulaNumber, 2);
    });
  });

  describe('records reached by several paths', () => {
    it('should place a record at its shallowest path', () => {
      const shared = { value: new Formula('hours') };
      const view = scope.evaluator().evaluate({
        a: { hours: 1, b: { hours: 2, shared } },
        c: { hours: 3, shared },
        d: { hours: 4, e: { hours: 5, shared } },
      });

      expect(view.c.shared.value).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should place a record at the first of equally shallow paths in key order', () => {
      const shared = { value: new Formula('hours') };
      const view = scope.evaluator().evaluate({ x: { hours: 1, shared }, y: { hours: 2, shared } });

      expect(view.x.shared.value).toBeFormulaDataType(FormulaNumber, 1);
      expect(view.y.shared).toBe(view.x.shared);
    });

    it('should compute records that link to each other both ways', () => {
      interface Task { hours: number; project?: Project; cost: Formula }
      interface Project { rate: number; tasks: Task[] }

      const task: Task = { hours: 3, cost: new Formula('project.rate() * hours') };
      const project: Project = { rate: 10, tasks: [task] };

      task.project = project;

      const view = scope.evaluator().evaluate({ projects: [project] });
      const taskView = view.projects[0]?.tasks[0];

      expect(taskView?.cost).toBeFormulaDataType(FormulaNumber, 30);
      expect(taskView?.project).toBe(view.projects[0]);
    });
  });

  describe('view', () => {
    it('should keep the shape of the data and leave the data as it is', () => {
      const cost = new Formula('price * 2');
      const data = { price: 3, cost, tags: ['a'] };
      const view = scope.evaluator().evaluate(data);

      expect(view.cost).toBeFormulaDataType(FormulaNumber, 6);
      expect(view).toStrictEqual({ price: 3, cost: view.cost, tags: ['a'] });
      expect(data.cost).toBe(cost);
    });

    it('should give back as they are the objects and lists that hold no formula', () => {
      const meta = { author: 'Ann', tags: ['a'] };
      const view = scope.evaluator().evaluate({ meta, list: [{ n: 1 }], total: new Formula('1') });

      expect(view.meta).toBe(meta);
    });

    it('should keep the class of a record that holds a formula', () => {
      class Line {
        readonly cost = new Formula('qty * 2');

        constructor(readonly qty: number) {}

        describe(): string {
          return `${this.qty} items`;
        }
      }

      const view = scope.evaluator().evaluate({ line: new Line(3) });

      expect(view.line).toBeInstanceOf(Line);
      expect(view.line.cost).toBeFormulaDataType(FormulaNumber, 6);
    });

    it('should read a getter only when a formula reads it', () => {
      const read = vi.fn(() => 5);
      const record = { cost: new Formula('1') };

      Object.defineProperty(record, 'lazy', { enumerable: true, get: read });

      const view = scope.evaluator().evaluate({ record });

      expect(read).not.toHaveBeenCalled();
      expect(Reflect.get(view.record, 'lazy')).toBe(5);
    });

    it('should read a getter a formula reads', () => {
      const record = { cost: new Formula('lazy * 2') };

      Object.defineProperty(record, 'lazy', { enumerable: true, get: () => 5 });

      expect(scope.evaluator().evaluate({ record }).record.cost).toBeFormulaDataType(FormulaNumber, 10);
    });
  });

  describe('errors', () => {
    it('should keep the error of a failing formula in its cell', () => {
      const view = scope.evaluator().evaluate({ a: 1, broken: new Formula('a + missing'), fine: new Formula('a + 1') });

      expect(view.broken).toBeInstanceOf(FormulaError);
      expect((view.broken as FormulaError).message).toBe('Variable "missing" is not defined. [4,11]');
      expect(view.fine).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should keep the syntax error of a formula that does not parse in its cell', () => {
      const view = scope.evaluator().evaluate({ broken: new Formula('1 +') });

      expect(view.broken).toBeInstanceOf(SyntaxError);
    });
  });
});

describe(Formula, () => {
  it('should keep its text', () => {
    expect(new Formula('a + 1').text).toBe('a + 1');
  });
});
