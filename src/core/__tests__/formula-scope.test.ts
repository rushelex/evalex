import { fc, it } from '@fast-check/vitest';

import { formulaValueArbitrary, loc } from '../../testing-library';
import { FormulaBoolean, FormulaDateRange, FormulaDateTime, FormulaDuration, FormulaNumber, FormulaString, Kind } from '../data-types';
import { Errors } from '../errors';
import { Formula } from '../formula';
import { FormulaScope } from '../formula-scope';

describe(FormulaScope, () => {
  describe('evaluate', () => {
    it('should evaluate a formula over plain values', () => {
      expect(new FormulaScope().evaluate('price * quantity', { price: 250, quantity: 4 })).toBeFormulaDataType(FormulaNumber, 1000);
    });

    it('should evaluate a formula without values', () => {
      expect(new FormulaScope().evaluate('1 + 2')).toBeFormulaDataType(FormulaNumber, 3);
    });

    it('should turn values into text with the formatters of the scope', () => {
      const scope = new FormulaScope({ format: { number: (number) => `<${number}>` } });

      expect(scope.evaluate('"x" + n', { n: 1 })).toBeFormulaDataType(FormulaString, 'x<1>');
    });

    it('should read a date range given as its start and end', () => {
      const period = { start: new Date('2024-07-01T00:00:00Z'), end: new Date('2024-07-28T00:00:00Z') };

      expect(new FormulaScope().evaluate('period', { period })).toBeInstanceOf(FormulaDateRange);
    });

    it.prop([formulaValueArbitrary()])('should give back a formula value passed in as it is', (value) => {
      expect(new FormulaScope().evaluate('value', { value })).toBe(value);
    });

    it('should compute a result passed back as input as it did inside one formula', () => {
      const scope = new FormulaScope();
      const third = scope.evaluate('1 / 3');

      expect(scope.evaluate('third * 3', { third })).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should evaluate calls nested as deep as the limit allows', () => {
      expect(new FormulaScope().evaluate(`${'abs('.repeat(255)}1${')'.repeat(255)}`)).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should reject a formula nested too deep with a syntax error instead of overflowing the stack', () => {
      expect(() => new FormulaScope().evaluate(`${'('.repeat(5000)}1${')'.repeat(5000)}`))
        .toThrow('Nested or chained more than 256 levels deep. [256,257]');
    });
  });

  describe('host values', () => {
    it('should not convert a value the formula does not read', () => {
      // @ts-expect-error a map fails to compile; a host without types reaches the check at run time
      expect(new FormulaScope().evaluate('price * 2', { price: 1, meta: new Map() })).toBeFormulaDataType(FormulaNumber, 2);
    });

    it('should name the path of a value it cannot convert, starting at its name', () => {
      // @ts-expect-error a map fails to compile; a host without types reaches the check at run time
      expect(() => new FormulaScope().evaluate('order.tags()', { order: { qty: 1, tags: new Map() } }))
        .toThrow(new TypeError('Cannot convert order.tags to a formula value: Map has no formula form.'));
    });

    it('should not convert a field the formula does not read', () => {
      // @ts-expect-error a map fails to compile; a host without types reaches the check at run time
      expect(new FormulaScope().evaluate('order.qty()', { order: { qty: 1, tags: new Map() } })).toBeFormulaDataType(FormulaNumber, 1);
    });

    it('should read a getter of a record only when the formula reads its field', () => {
      let reads = 0;
      const order = {
        qty: 1,
        get total(): number {
          reads++;
          return 10;
        },
      };

      new FormulaScope().evaluate('order.qty()', { order });

      expect(reads).toBe(0);
    });

    describe('records that link to each other', () => {
      interface Project { readonly name: string; readonly rate: number; readonly tasks: Task[] }
      interface Task { readonly title: string; project?: Project }

      function linkedRecords(): { readonly project: Project; readonly task: Task } {
        const task: Task = { title: 'Design' };
        const project: Project = { name: 'Apollo', rate: 100, tasks: [task] };
        task.project = project;

        return { project, task };
      }

      it('should follow the links both ways', () => {
        const { project, task } = linkedRecords();
        const scope = new FormulaScope();

        expect(scope.evaluate('task.project().rate()', { task })).toBeFormulaDataType(FormulaNumber, 100);
        expect(scope.evaluate('project.tasks().first().project().tasks().length()', { project })).toBeFormulaDataType(FormulaNumber, 1);
      });

      it('should write a record that links back, stopping at the link', () => {
        const { task } = linkedRecords();

        expect(new FormulaScope().evaluate('format(task)', { task })).toBeFormulaDataType(FormulaString, '{ title: "Design", project: { name: "Apollo", rate: 100, tasks: [{…}] } }');
      });

      it('should compare records that link back by what they hold', () => {
        const { project, task } = linkedRecords();
        const other = linkedRecords();
        other.task.project = { ...other.project, rate: 200 };

        const scope = new FormulaScope();

        expect(scope.evaluate('task.project() == project', { task, project })).toBeFormulaDataType(FormulaBoolean, true);
        expect(scope.evaluate('task == other', { task, other: other.task })).toBeFormulaDataType(FormulaBoolean, false);
      });
    });

    it('should read a value once however many times the formula reads its name', () => {
      let reads = 0;
      const values = {
        get price(): number {
          reads++;
          return 2;
        },
      };

      new FormulaScope().evaluate('price + price * price', values);

      expect(reads).toBe(1);
    });

    it.each([
      { label: 'a name the values inherit', name: 'price', values: Object.create({ price: 1 }) as object },
      { label: 'a name of the object prototype', name: 'toString', values: {} },
      { label: 'a name that holds a function', name: 'onChange', values: { onChange: () => undefined } },
    ])('should not find $label', ({ name, values }) => {
      expect(() => new FormulaScope().evaluate(name, values)).toThrow(Errors.Reference.VariableNotDefined.create(
        { name },
        { location: loc(0, name.length) },
      ));
    });
  });

  describe('format', () => {
    it('should reject a name list of the wrong length when the scope is created', () => {
      expect(() => new FormulaScope({ format: { names: { months: ['a'] } } })).toThrow(new TypeError('format.names.months must hold 12 names, not 1.'));
    });
  });

  describe('timeZone', () => {
    const ZONES = ['UTC', 'Europe/Moscow', 'America/New_York', 'Asia/Kolkata', 'Pacific/Chatham', '+05:45', '-09:30'];
    const zoneArbitrary = fc.constantFrom(...ZONES);
    const instantArbitrary = fc.date({ min: new Date('1900-01-01T00:00Z'), max: new Date('2200-01-01T00:00Z'), noInvalidDate: true });
    const utc = (instant: string): Temporal.ZonedDateTime => Temporal.Instant.from(instant).toZonedDateTimeISO('UTC');

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.prop([instantArbitrary, zoneArbitrary])('should read the fields of a date in the zone of the scope', (instant, timeZone) => {
      const fields = new FormulaScope({ timeZone }).evaluate('[year(at), month(at), date(at), day(at), week(at), hour(at), minute(at)]', { at: instant });
      const local = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timeZone);

      expect(fields.toString()).toBe([local.year, local.month, local.day, local.dayOfWeek, local.weekOfYear, local.hour, local.minute].join(', '));
    });

    it.prop([instantArbitrary, zoneArbitrary])('should format a date in the zone of the scope as formatDate does when given that zone', (instant, timeZone) => {
      const pattern = 'YYYY-MM-DD HH:mm dddd Z';

      expect(new FormulaScope({ timeZone }).evaluate(`formatDate(at, "${pattern}")`, { at: instant }).value)
        .toBe(new FormulaScope().evaluate(`formatDate(at, "${pattern}", "${timeZone}")`, { at: instant }).value);
    });

    it.prop([instantArbitrary, zoneArbitrary])('should give back dates in UTC whatever the zone of the scope', (instant, timeZone) => {
      const result = new FormulaScope({ timeZone }).evaluate('at.add(1, "days")', { at: instant });

      expect(result.kind === Kind.DateTime && result.value.timeZoneId).toBe('UTC');
    });

    it('should give today the start of the current day in the zone of the scope', () => {
      vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockImplementation((timeZone) => Temporal.Instant.from('2026-10-07T22:30Z').toZonedDateTimeISO(timeZone ?? 'UTC'));

      expect(new FormulaScope({ timeZone: 'Europe/Moscow' }).evaluate('today()')).toBeFormulaDataType(FormulaDateTime, utc('2026-10-07T21:00Z'));
    });

    it('should read a date and time written without an offset in the zone of the scope', () => {
      expect(new FormulaScope({ timeZone: 'Europe/Moscow' }).evaluate('parseDate("2026-10-07T10:00")')).toBeFormulaDataType(FormulaDateTime, utc('2026-10-07T07:00Z'));
    });

    it('should read a host date and time without a zone in the zone of the scope', () => {
      const scope = new FormulaScope({ timeZone: 'Europe/Moscow' });
      const at = Temporal.PlainDateTime.from('2026-10-07T10:00');

      expect(scope.evaluate('at', { at })).toBeFormulaDataType(FormulaDateTime, utc('2026-10-07T07:00Z'));
      expect(scope.evaluator().evaluate({ at, copy: new Formula('at') }).copy).toBeFormulaDataType(FormulaDateTime, utc('2026-10-07T07:00Z'));
    });

    it('should keep the time of day when a day added crosses a daylight saving change', () => {
      const scope = new FormulaScope({ timeZone: 'Europe/Berlin' });

      expect(scope.evaluate('parseDate("2026-03-28T12:00+01:00").add(1, "days")')).toBeFormulaDataType(FormulaDateTime, utc('2026-03-29T10:00Z'));
      expect(scope.evaluate('parseDate("2026-03-29T12:00+02:00").subtract(1, "days")')).toBeFormulaDataType(FormulaDateTime, utc('2026-03-28T11:00Z'));
    });

    it('should count the days between two dates by the calendar of the zone of the scope', () => {
      const days = new FormulaScope({ timeZone: 'Europe/Berlin' }).evaluate('parseDate("2026-03-29T12:00+02:00").between(parseDate("2026-03-28T12:00+01:00"), "days")');

      expect(days).toBeFormulaDataType(FormulaDuration, Temporal.Duration.from({ days: 1 }));
    });

    it('should keep the zone given to formatDate over the zone of the scope', () => {
      expect(new FormulaScope({ timeZone: 'Europe/Moscow' }).evaluate('formatDate(parseDate("2026-10-07T22:30Z"), "D HH:mm", "UTC")'))
        .toBeFormulaDataType(FormulaString, '7 22:30');
    });

    it('should reject a time zone it does not know when the scope is created', () => {
      expect(() => new FormulaScope({ timeZone: 'Mars/Base' })).toThrow(new RangeError(
        'timeZone "Mars/Base" is neither a time zone name such as "Europe/Berlin" nor an offset such as "+05:00".',
      ));
    });
  });

  describe('runtime', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should refuse to be created without Temporal, naming the polyfill to import', () => {
      vi.stubGlobal('Temporal', undefined);

      expect(() => new FormulaScope()).toThrow(new ReferenceError(
        'evalex needs Temporal, which this runtime lacks. Import "temporal-polyfill/global" before creating a FormulaScope.',
      ));
    });
  });
});
