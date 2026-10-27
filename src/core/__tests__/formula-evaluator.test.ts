import type { FormulaView } from '../formula-evaluator';

import { fc, it } from '@fast-check/vitest';

import { SyntaxError } from '../../parser/grammar/parser';
import { FormulaDataType, FormulaNumber, FormulaString } from '../data-types';
import { Errors, FormulaError } from '../errors';
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

    it('should read a getter as a name whatever it returns, failing on a function', () => {
      const group = { value: new Formula('rate') };

      Object.defineProperty(group, 'rate', { enumerable: true, get: () => () => 3 });

      const view = scope.evaluator().evaluate({ rate: 2, group });

      expect(messageOf(view.group.value)).toBe('Cannot use "rate": its value failed. [0,4]');
    });
  });

  describe('parent', () => {
    it('should read a name hidden by a field of the own record from the enclosing object', () => {
      const view = scope.evaluator().evaluate({ rate: 2, group: { rate: 3, value: new Formula('parent(rate) * 10 + rate') } });

      expect(view.group.value).toBeFormulaDataType(FormulaNumber, 23);
    });

    it('should go one enclosing object further with each parent', () => {
      const view = scope.evaluator().evaluate({ rate: 1, a: { rate: 2, b: { rate: 3, value: new Formula('parent(parent(rate))') } } });

      expect(view.a.b.value).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should skip the list that holds the record', () => {
      const view = scope.evaluator().evaluate({ rate: 2, rows: [{ rate: 3, value: new Formula('parent(rate)') }] });

      expect(view.rows[0]?.value).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should keep the names of the formula itself, such as the item of a callback', () => {
      const view = scope.evaluator().evaluate({ rate: 2, group: { rate: 3, value: new Formula('[10].map(parent(rate) + current).sum()') } });

      expect(view.group.value).toBeFormulaDataType(FormulaNumber, 12);
    });

    it('should find no names above the root', () => {
      const view = scope.evaluator().evaluate({ rate: 2, value: new Formula('parent(rate)') });

      expect(messageOf(view.value)).toBe('Variable "rate" is not defined. [7,11]');
    });

    it('should find no enclosing object for a formula evaluated by name', () => {
      expect(() => scope.evaluate('parent(rate)', { rate: 2 })).toThrow('Variable "rate" is not defined. [7,11]');
    });
  });

  describe('previous and next', () => {
    it('should read the previous record of the list', () => {
      const view = scope.evaluator().evaluate({ rows: [1, 2, 3].map((amount) => ({ amount, total: new Formula('previous(total, 0) + amount') })) });

      expect(view.rows.map((row) => String(row.total))).toStrictEqual(['1', '3', '6']);
    });

    it('should read the next record of the list', () => {
      const view = scope.evaluator().evaluate({ rows: [1, 2, 3].map((amount) => ({ amount, rest: new Formula('next(rest, 0) + amount') })) });

      expect(view.rows.map((row) => String(row.rest))).toStrictEqual(['6', '5', '3']);
    });

    it('should evaluate the default over the own record where there is no neighbor', () => {
      const view = scope.evaluator().evaluate({ rows: [{ amount: 5, before: new Formula('previous(amount, amount * 2)') }] });

      expect(view.rows[0]?.before).toBeFormulaDataType(FormulaNumber, 10);
    });

    it('should read names outward from the neighbor record', () => {
      const view = scope.evaluator().evaluate({
        rate: 2,
        rows: [{ amount: 1 }, { amount: 5, change: new Formula('amount - previous(amount * rate, 0)') }],
      });

      expect(view.rows[1]?.change).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should give the default to a record outside a list', () => {
      const view = scope.evaluator().evaluate({ amount: 1, before: new Formula('previous(amount, 0)') });

      expect(view.before).toBeFormulaDataType(FormulaNumber, 0);
    });

    it('should give the default where the neighbor is not a record', () => {
      const view = scope.evaluator().evaluate({ rows: [1, { amount: 2, before: new Formula('previous(amount, 0)') }] });
      const [, row] = view.rows;

      expect(typeof row === 'object' && row.before).toBeFormulaDataType(FormulaNumber, 0);
    });

    it('should compute a running total of 20,000 records', () => {
      const rows = Array.from({ length: 20_000 }, () => ({ amount: 1, total: new Formula('previous(total, 0) + amount') }));

      expect(scope.evaluator().evaluate({ rows }).rows[19_999]?.total).toBeFormulaDataType(FormulaNumber, 20_000);
    });

    it('should fail the records that read each other as neighbors, pointing at the read', () => {
      const view = scope.evaluator().evaluate({ rows: [{ x: new Formula('next(x, 0)') }, { x: new Formula('previous(x, 0)') }] });

      expect(messageOf(view.rows[0]?.x)).toBe('Circular reference: "x" depends on this formula. [5,6]');
      expect(messageOf(view.rows[1]?.x)).toBe('Circular reference: "x" depends on this formula. [9,10]');
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

  describe('failed inputs', () => {
    it('should fail a formula that reads a failed cell with an input error at the read, caused by that cell', () => {
      const view = scope.evaluator().evaluate({ total: new Formula('missing * 2'), tax: new Formula('total * 0.1') });

      expect(Errors.Reference.InputError.is(view.tax)).toBe(true);
      expect(messageOf(view.tax)).toBe('Cannot use "total": its value failed. [0,5]');
      expect(causeOf(view.tax)).toBe(view.total);
    });

    it('should point each formula at the input it reads, not at what broke that input', () => {
      const view = scope.evaluator().evaluate({ a: new Formula('missing'), b: new Formula('a + 1'), c: new Formula('2 * b') });

      expect(messageOf(view.c)).toBe('Cannot use "b": its value failed. [4,5]');
      expect(causeOf(view.c)).toBe(view.b);
    });

    it('should fail a formula that reads a cell that does not parse, caused by its syntax error', () => {
      const view = scope.evaluator().evaluate({ broken: new Formula('1 +'), next: new Formula('broken + 1') });

      expect(messageOf(view.next)).toBe('Cannot use "broken": its value failed. [0,6]');
      expect(causeOf(view.next)).toBe(view.broken);
    });

    it('should fail a formula outside a cycle that reads a cell of the cycle with an input error', () => {
      const view = scope.evaluator().evaluate({ a: new Formula('b + 1'), b: new Formula('2 * a'), c: new Formula('a + 1') });

      expect(Errors.Reference.CircularReference.is(view.a)).toBe(true);
      expect(messageOf(view.c)).toBe('Cannot use "a": its value failed. [0,1]');
      expect(causeOf(view.c)).toBe(view.a);
    });

    it('should fail a formula that reads a value without a formula form, caused by the conversion error', () => {
      const view = scope.evaluator().evaluate({ tags: new Map(), count: new Formula('tags.size()') });

      expect(messageOf(view.count)).toBe('Cannot use "tags": its value failed. [0,4]');
      expect(causeOf(view.count)).toStrictEqual(new TypeError('Cannot convert tags to a formula value: Map has no formula form.'));
    });

    it('should fail a formula that reads a list with an item without a formula form, naming the item', () => {
      const view = scope.evaluator().evaluate({ items: [1, Number.NaN], total: new Formula('items.sum()') });

      expect(messageOf(view.total)).toBe('Cannot use "items": its value failed. [0,5]');
      expect(messageOf(causeOf(view.total))).toBe('Cannot convert items[1] to a formula value: NaN has no formula form.');
    });

    it('should fail a formula whose read of a field runs a getter that throws, pointing at the field read', () => {
      const offline = new Error('db offline');
      const view = scope.evaluator().evaluate({ order: throwingRecord(offline), count: new Formula('order.tags().count()') });

      expect(messageOf(view.count)).toBe('Cannot use "order.tags()": its value failed. [0,12]');
      expect(causeOf(view.count)).toBe(offline);
    });

    it('should report a failure of host data once, however many formulas read it', () => {
      const offline = new Error('db offline');
      const read = vi.fn((): never => {
        throw offline;
      });
      const onInputError = vi.fn();
      const order = {};

      Object.defineProperty(order, 'tags', { enumerable: true, get: read });

      const view = scope.evaluator({ onInputError }).evaluate({ order, a: new Formula('order.tags()'), b: new Formula('order.tags()') });

      expect(causeOf(view.a)).toBe(offline);
      expect(causeOf(view.b)).toBe(offline);
      expect(read).toHaveBeenCalledOnce();
      expect(onInputError.mock.calls).toStrictEqual([[offline]]);
    });

    it('should not report a failed formula as a failure of host data', () => {
      const onInputError = vi.fn();

      scope.evaluator({ onInputError }).evaluate({ total: new Formula('missing'), tax: new Formula('total * 0.1') });

      expect(onInputError).not.toHaveBeenCalled();
    });

    it('should report a thrown value that is not an error as an error caused by it', () => {
      const onInputError = vi.fn();
      const view = scope.evaluator({ onInputError }).evaluate({ order: throwingRecord('offline'), count: new Formula('order.tags()') });

      expect(causeOf(view.count)).toStrictEqual(new Error('A getter of host data threw offline.'));
      expect(causeOf(causeOf(view.count))).toBe('offline');
      expect(onInputError).toHaveBeenCalledWith(causeOf(view.count));
    });

    it('should keep computing the formulas that read nothing failed', () => {
      const view = scope.evaluator().evaluate({ tags: new Map(), count: new Formula('tags.size()'), fine: new Formula('1 + 1') });

      expect(view.fine).toBeFormulaDataType(FormulaNumber, 2);
    });
  });

  describe('passes', () => {
    it.prop([fc.array(edit(), { maxLength: 12 })], { numRuns: 200 })('should give after any edits what a new evaluator gives', (edits) => {
      const evaluator = scope.evaluator();
      const sheet = newSheet();

      for (const change of edits) {
        evaluator.evaluate(sheet);
        change(sheet);

        expect(describeView(evaluator.evaluate(sheet))).toStrictEqual(describeView(scope.evaluator().evaluate(sheet)));
      }
    });

    it('should give back the same view when nothing changed', () => {
      const evaluator = scope.evaluator();
      const data = { rows: [{ price: 2, cost: new Formula('price * 3') }] };

      expect(evaluator.evaluate(data)).toBe(evaluator.evaluate(data));
    });

    it('should give a new result only to the cells whose reads changed, keeping the copies of unchanged records', () => {
      const evaluator = scope.evaluator();
      const data = { rows: [{ price: 2, cost: new Formula('price * 3') }, { price: 5, cost: new Formula('price * 3') }] };
      const before = evaluator.evaluate(data);

      data.rows[1].price = 6;

      const after = evaluator.evaluate(data);

      expect(after.rows[0]).toBe(before.rows[0]);
      expect(after.rows[1]?.cost).toBeFormulaDataType(FormulaNumber, 18);
      expect(after).not.toBe(before);
    });

    it('should keep the very result of a formula whose reads did not change, such as a list', () => {
      const evaluator = scope.evaluator();
      const data = { items: [1, 2], other: 1, doubled: new Formula('items.map(current * 2)') };
      const before = evaluator.evaluate(data).doubled;

      data.other = 2;

      expect(evaluator.evaluate(data).doubled).toBe(before);
    });

    it('should keep the results of records that moved when a record is inserted before them', () => {
      const evaluator = scope.evaluator();
      const rows = [1, 2, 3].map((amount) => ({ amount, double: new Formula('amount * 2'), total: new Formula('previous(total, 0) + amount') }));
      const before = evaluator.evaluate({ rows });

      rows.unshift({ amount: 10, double: new Formula('amount * 2'), total: new Formula('previous(total, 0) + amount') });

      const after = evaluator.evaluate({ rows });

      expect(after.rows[1]?.double).toBe(before.rows[0]?.double);
      expect(after.rows[3]?.total).toBeFormulaDataType(FormulaNumber, 16);
    });

    it('should compute again a formula that reads a list changed in place', () => {
      const evaluator = scope.evaluator();
      const data = { items: [1, 2], total: new Formula('items.sum()') };

      evaluator.evaluate(data);
      data.items.push(3);

      expect(evaluator.evaluate(data).total).toBeFormulaDataType(FormulaNumber, 6);
    });

    it('should read again the fields of a record kept in the result of an earlier pass', () => {
      const evaluator = scope.evaluator();
      const rows = [{ price: 200, quantity: 1 }, { price: 50, quantity: 1 }];
      const data = { rows, expensive: new Formula('rows.filter(current.price() > 100)'), quantity: new Formula('expensive.map(current.quantity()).sum()') };

      evaluator.evaluate(data);
      rows[0].quantity = 7;

      expect(evaluator.evaluate(data).quantity).toBeFormulaDataType(FormulaNumber, 7);
    });

    it('should compute again a formula whose text changed, and keep the result of a new formula with the same text', () => {
      const evaluator = scope.evaluator();
      const data = { a: 2, b: new Formula('a * 2') };
      const before = evaluator.evaluate(data).b;

      data.b = new Formula('a * 2');

      expect(evaluator.evaluate(data).b).toBe(before);

      data.b = new Formula('a * 3');

      expect(evaluator.evaluate(data).b).toBeFormulaDataType(FormulaNumber, 6);
    });

    it('should keep the result a formula computes again equal to the one before', () => {
      const evaluator = scope.evaluator();
      const data = { a: 1, b: 2, half: new Formula('(a + b) / 2') };
      const before = evaluator.evaluate(data).half;

      data.a = 2;
      data.b = 1;

      expect(evaluator.evaluate(data).half).toBe(before);
    });

    it('should give fresh results in a record that comes back to the data after a pass without it', () => {
      const evaluator = scope.evaluator();
      const inner = { a: 1, double: new Formula('a * 2') };
      const outer = { inner };

      evaluator.evaluate({ outer });
      inner.a = 5;
      evaluator.evaluate({ inner });

      expect(evaluator.evaluate({ outer }).outer.inner.double).toBeFormulaDataType(FormulaNumber, 10);
    });

    it('should evaluate a formula that calls a volatile routine in every pass', () => {
      const evaluator = scope.evaluator();
      const data = { at: new Formula('now()') };

      expect(evaluator.evaluate(data).at).not.toBe(evaluator.evaluate(data).at);
    });

    it('should read names from the new place of a record moved to another object', () => {
      const evaluator = scope.evaluator();
      const record = { amount: 10, cost: new Formula('amount * rate') };
      const data = { low: { rate: 1, rows: [record] }, high: { rate: 2, rows: [] as typeof record[] } };

      evaluator.evaluate(data);
      data.high.rows.push(...data.low.rows.splice(0));

      expect(evaluator.evaluate(data).high.rows[0]?.cost).toBeFormulaDataType(FormulaNumber, 20);
    });

    it('should compute again a formula when a field added to its record hides the field it read further out', () => {
      const evaluator = scope.evaluator();
      const record: Record<string, unknown> = { amount: 10, cost: new Formula('amount * rate') };
      const data = { rate: 1, rows: [record] };

      evaluator.evaluate(data);
      record.rate = 3;

      expect(evaluator.evaluate(data).rows[0]?.cost).toBeFormulaDataType(FormulaNumber, 30);
    });

    it('should compute again a formula that reads a date changed in place', () => {
      const evaluator = scope.evaluator();
      const data = { due: new Date('2026-01-01T00:00:00Z'), later: new Formula('due.add(1, "days")') };

      evaluator.evaluate(data);
      data.due.setTime(Date.parse('2026-03-01T00:00:00Z'));

      expect(String(evaluator.evaluate(data).later)).toContain('2026-03-02');
    });

    it('should compute again a formula that reads a set changed in place', () => {
      const evaluator = scope.evaluator();
      const data = { tags: new Set([1]), total: new Formula('tags.sum()') };

      evaluator.evaluate(data);
      data.tags.delete(1);
      data.tags.add(5);

      expect(evaluator.evaluate(data).total).toBeFormulaDataType(FormulaNumber, 5);
    });

    it('should report a failure of host data again in a later pass', () => {
      const onInputError = vi.fn();
      const evaluator = scope.evaluator({ onInputError });
      const data = { tags: new Map(), count: new Formula('tags.size()') };

      evaluator.evaluate(data);
      evaluator.evaluate(data);

      expect(onInputError).toHaveBeenCalledTimes(2);
    });

    it('should fail a cycle an edit closes and compute its cells again once the edit is undone', () => {
      const evaluator = scope.evaluator();
      const data = { a: new Formula('b + 1'), b: new Formula('2') };

      evaluator.evaluate(data);
      data.b = new Formula('a * 2');

      expect(Errors.Reference.CircularReference.is(evaluator.evaluate(data).a)).toBe(true);

      data.b = new Formula('2');

      expect(evaluator.evaluate(data).a).toBeFormulaDataType(FormulaNumber, 3);
    });
  });

  describe('order', () => {
    it.prop([permutation(300)], { numRuns: 20 })('should compute a chain of formulas whatever the order of its cells', (order) => {
      const view = scope.evaluator().evaluate(chain(order));

      expect(view.v299).toBeFormulaDataType(FormulaNumber, 300);
    });

    it('should compute a chain of 20,000 formulas written from its end', () => {
      const order = Array.from({ length: 20_000 }, (_, index) => 19_999 - index);

      expect(scope.evaluator().evaluate(chain(order)).v19999).toBeFormulaDataType(FormulaNumber, 20_000);
    });

    it('should compute a chain of 20,000 formulas that read each other through records', () => {
      const records = Array.from({ length: 20_000 }, () => ({ next: {}, value: new Formula('next.value() + 1') }));

      records.forEach((record, index) => {
        record.next = records[index + 1] ?? { value: 0 };
      });

      expect(scope.evaluator().evaluate({ records }).records[0]?.value).toBeFormulaDataType(FormulaNumber, 20_000);
    });
  });

  describe('cycles', () => {
    it('should fail every cell of a cycle, pointing at the reference into the cycle', () => {
      const view = scope.evaluator().evaluate({ a: new Formula('b + 1'), b: new Formula('2 * a'), c: new Formula('1 + 1') });

      expect(messageOf(view.a)).toBe('Circular reference: "b" depends on this formula. [0,1]');
      expect(messageOf(view.b)).toBe('Circular reference: "a" depends on this formula. [4,5]');
      expect(view.c).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should fail a formula that reads itself', () => {
      const view = scope.evaluator().evaluate({ a: new Formula('a + 1') });

      expect(Errors.Reference.CircularReference.is(view.a)).toBe(true);
      expect(messageOf(view.a)).toBe('Circular reference: "a" depends on this formula. [0,1]');
    });

    it('should point at the read of a field that leads into the cycle', () => {
      const view = scope.evaluator().evaluate({ project: { cost: new Formula('total * 2') }, total: new Formula('project.cost() + 1') });

      expect(messageOf(view.total)).toBe('Circular reference: "project.cost()" depends on this formula. [0,14]');
      expect(messageOf(view.project.cost)).toBe('Circular reference: "total" depends on this formula. [0,5]');
    });

    it('should fail every cell of a cycle of 1,000 formulas, whatever the order of its cells', () => {
      const data = chain(Array.from({ length: 1000 }, (_, index) => 999 - index));

      data.v0 = new Formula('v999 + 1');

      const view = scope.evaluator().evaluate(data);
      const reads = Object.entries(view).map(([key, cell]) => [key, messageOf(cell)]);
      const expected = Object.keys(data).map((key) => {
        const read = key === 'v0' ? 'v999' : `v${Number(key.slice(1)) - 1}`;

        return [key, `Circular reference: "${read}" depends on this formula. [0,${read.length}]`];
      });

      expect(reads).toStrictEqual(expected);
    });
  });
});

describe(Formula, () => {
  it('should keep its text', () => {
    expect(new Formula('a + 1').text).toBe('a + 1');
  });
});

// Helpers

/** A record of cells `v0` to `v{n-1}`, each one more than the cell before it, written in the order of `order`. */
function chain(order: readonly number[]): Record<string, Formula | number> {
  return Object.fromEntries(order.map((index) => [`v${index}`, index === 0 ? 1 : new Formula(`v${index - 1} + 1`)]));
}

interface SheetRow {
  a: number;
  b: number | Formula;
  t: Formula;
  rate?: number;
}

interface Sheet {
  rate: number;
  rows: SheetRow[];
  total: Formula;
}

/** Formulas the cells `b` and `t` of a sheet row take, reading every way a formula reads: names, neighbors, lists, cycles. */
const SHEET_FORMULAS = ['previous(t, 0) + a', 'next(t, 0) + a', 'a * rate', 'parent(rate) + a', 'b + a', 'rows.map(current.a()).sum()', 't', 'b', 'missing'] as const;

type SheetEdit
  = | { readonly kind: 'a' | 'b' | 'rate'; readonly row: number; readonly value: number }
    | { readonly kind: 'formula b' | 'formula t'; readonly row: number; readonly text: string }
    | { readonly kind: 'insert'; readonly at: number; readonly value: number }
    | { readonly kind: 'remove' | 'unhide' | 'copy'; readonly row: number }
    | { readonly kind: 'reverse' | 'new list' }
    | { readonly kind: 'sheet rate'; readonly value: number };

function newSheet(): Sheet {
  return { rate: 2, rows: [1, 2, 3].map((value) => newRow(value)), total: new Formula('rows.map(current.t()).sum()') };
}

function newRow(a: number): SheetRow {
  return { a, b: new Formula('a * rate'), t: new Formula('previous(t, 0) + a') };
}

function edit(): fc.Arbitrary<(sheet: Sheet) => void> {
  const row = fc.nat();
  const value = fc.integer({ min: -3, max: 3 });
  const text = fc.constantFrom(...SHEET_FORMULAS);
  const edits: fc.Arbitrary<SheetEdit> = fc.oneof(
    fc.record({ kind: fc.constantFrom('a', 'b', 'rate'), row, value }),
    fc.record({ kind: fc.constantFrom('formula b', 'formula t'), row, text }),
    fc.record({ kind: fc.constant('insert'), at: row, value }),
    fc.record({ kind: fc.constantFrom('remove', 'unhide', 'copy'), row }),
    fc.record({ kind: fc.constantFrom('reverse', 'new list') }),
    fc.record({ kind: fc.constant('sheet rate'), value }),
  );

  return edits.map((change) => Object.assign((sheet: Sheet) => applyEdit(sheet, change), { toString: () => JSON.stringify(change) }));
}

function applyEdit(sheet: Sheet, change: SheetEdit): void {
  const { rows } = sheet;
  const index = 'row' in change ? change.row % Math.max(rows.length, 1) : 0;
  const row = rows[index];

  switch (change.kind) {
    case 'a':
    case 'b':
    case 'rate':
      if (row) {
        row[change.kind] = change.value;
      }
      break;

    case 'formula b':
    case 'formula t':
      if (row) {
        row[change.kind === 'formula b' ? 'b' : 't'] = new Formula(change.text);
      }
      break;

    case 'insert':
      rows.splice(change.at % (rows.length + 1), 0, newRow(change.value));
      break;

    case 'remove':
      rows.splice(index, 1);
      break;

    case 'unhide':
      delete row?.rate;
      break;

    case 'copy':
      if (row) {
        rows[index] = { ...row };
      }
      break;

    case 'reverse':
      rows.reverse();
      break;

    case 'new list':
      sheet.rows = [...rows];
      break;

    case 'sheet rate':
      sheet.rate = change.value;
      break;
  }
}

function describeView(view: FormulaView<Sheet>): unknown {
  return { total: describeCell(view.total), rows: view.rows.map((row) => [describeCell(row.b), describeCell(row.t)]) };
}

function describeCell(cell: unknown): string {
  if (cell instanceof Error) {
    return `${cell.name}: ${cell.message}`;
  }

  return cell instanceof FormulaDataType ? `${cell.kind} ${cell.toString()}` : String(cell);
}

function permutation(length: number): fc.Arbitrary<number[]> {
  const indexes = Array.from({ length }, (_, index) => index);

  return fc.shuffledSubarray(indexes, { minLength: length });
}

function messageOf(cell: unknown): string {
  return cell instanceof Error ? cell.message : String(cell);
}

function causeOf(cell: unknown): unknown {
  return cell instanceof Error ? cell.cause : undefined;
}

/** A record whose field `tags` is a getter that throws `thrown`. */
function throwingRecord(thrown: unknown): object {
  const record = {};

  Object.defineProperty(record, 'tags', {
    enumerable: true,
    get: (): never => {
      throw thrown;
    },
  });

  return record;
}
