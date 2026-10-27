/* eslint-disable test/prefer-lowercase-title */
import type { FormulaEvaluator, FormulaView } from 'evalex';
import type { CellValue, RawCellContent } from 'hyperformula';

import { Formula, FormulaScope } from 'evalex';
import { HyperFormula } from 'hyperformula';
import { expect, it } from 'vitest';

/**
 * Head-to-head comparison benchmark: evalex vs HyperFormula
 *
 * Both engines hold the same order table. Each row has a price, a quantity and a discount,
 * and five computed columns: subtotal, rounded total, size, caption and the row's share of the grand total.
 * Totals are summed in blocks of 50 rows and the blocks into a grand total,
 * so a price edit reaches its row, its block, the grand total and then the share of every row.
 *
 * Each engine is driven through the API its docs suggest to hosts:
 * evalex through `evaluator.evaluate` over the host's records, HyperFormula through its sheet methods.
 */

const BLOCK_SIZE = 50;

const TABLE_SIZES = [200, 1900] as const;

const PASTE_SIZE = 100;

const HF_CONFIG = { licenseKey: 'gpl-v3' } as const;

// Sheet columns of the HyperFormula table: A–C inputs, D–H computed, J block totals, K1 grand total
const HF_COLUMN = {
  price: 0,
  size: 5,
  label: 6,
  share: 7,
  grand: 10,
} as const;

interface OrderRow {
  readonly price: number;
  readonly quantity: number;
  readonly discount: number;
}

interface OrderLine extends OrderRow {
  price: number;
  readonly number: number;
  readonly subtotal: Formula;
  readonly total: Formula;
  readonly size: Formula;
  readonly label: Formula;
  readonly share: Formula;
}

interface OrderBlock {
  readonly lines: readonly OrderLine[];
  readonly total: Formula;
}

interface OrderTable {
  readonly blocks: readonly OrderBlock[];
  readonly grand: Formula;
}

interface EvalexTable {
  readonly evaluator: FormulaEvaluator;
  readonly data: OrderTable;
  view: FormulaView<OrderTable>;
}

interface PriceEdit {
  readonly firstRow: number;
  readonly prices: readonly number[];
}

const scope = new FormulaScope();

it('Comparison: both engines compute the same table', () => {
  const rows = orderRows(TABLE_SIZES[0]);
  const { view } = buildEvalexTable(rows);
  const sheet = HyperFormula.buildFromArray(sheetData(rows), HF_CONFIG);
  const lastRow = rows.length - 1;
  const lastLine = view.blocks.at(-1)!.lines.at(-1)!;

  // evalex rounds the exact decimal half up, while HyperFormula rounds the binary double:
  // a total such as 487.305 becomes 487.31 in evalex and 487.30 in HyperFormula, so each row may differ by a cent
  expect(Math.abs(Number(String(view.grand)) - hfGrandTotal(sheet))).toBeLessThanOrEqual(rows.length * 0.01);
  expect(Number(String(lastLine.share))).toBeCloseTo(Number(hfCell({ sheet, col: HF_COLUMN.share, row: lastRow })), 6);
  expect(String(lastLine.size)).toBe(hfCell({ sheet, col: HF_COLUMN.size, row: lastRow }));
  expect(String(lastLine.label)).toBe(hfCell({ sheet, col: HF_COLUMN.label, row: lastRow }));
});

/**
 * Scenario 1: Opening a table
 * Computes every formula of new data with a new evaluator, as when a user opens a document
 */
for (const rowCount of TABLE_SIZES) {
  it(`Comparison: open a ${rowCount}-row table (${formulaCount(rowCount)} formulas)`, async ({ bench }) => {
    const rows = orderRows(rowCount);

    await bench.compare(
      bench('evalex, new evaluator', () => {
        evalexGrandTotal(buildEvalexTable(rows));
      }),
      bench('HyperFormula, new workbook', () => {
        const sheet = HyperFormula.buildFromArray(sheetData(rows), HF_CONFIG);

        hfGrandTotal(sheet);
      }),
      { warmupIterations: 3, iterations: 20 },
    );
  });
}

/**
 * Scenario 2: Editing one price
 * A price in the middle of the table changes, which reaches its row, its block,
 * the grand total and the share of every row
 */
for (const rowCount of TABLE_SIZES) {
  it(`Comparison: edit one price in a ${rowCount}-row table`, async ({ bench }) => {
    const rows = orderRows(rowCount);
    const firstRow = Math.floor(rowCount / 2);
    let table: EvalexTable;
    let sheet: HyperFormula;
    let step = 0;

    await bench.compare(
      bench(
        'evalex',
        {
          beforeAll: () => {
            table = buildEvalexTable(rows);
          },
        },
        () => {
          editEvalexPrices({ table, edit: { firstRow, prices: [editedPrice(++step)] } });
          evalexGrandTotal(table);
        },
      ),
      bench(
        'HyperFormula',
        {
          beforeAll: () => {
            sheet = HyperFormula.buildFromArray(sheetData(rows), HF_CONFIG);
          },
        },
        () => {
          editHFPrices({ sheet, edit: { firstRow, prices: [editedPrice(++step)] } });
          hfGrandTotal(sheet);
        },
      ),
      { warmupIterations: 10, iterations: 100 },
    );
  });
}

/**
 * Scenario 3: Pasting a column of prices
 * 100 neighboring prices change at once, as when a user pastes a range, and the host evaluates once after the paste
 */
for (const rowCount of TABLE_SIZES) {
  it(`Comparison: paste ${PASTE_SIZE} prices into a ${rowCount}-row table`, async ({ bench }) => {
    const rows = orderRows(rowCount);
    const firstRow = rowCount - PASTE_SIZE;
    const pastedPrices = (start: number) => Array.from({ length: PASTE_SIZE }, (_, offset) => editedPrice(start + offset));
    let table: EvalexTable;
    let sheet: HyperFormula;
    let step = 0;

    await bench.compare(
      bench(
        'evalex',
        {
          beforeAll: () => {
            table = buildEvalexTable(rows);
          },
        },
        () => {
          editEvalexPrices({ table, edit: { firstRow, prices: pastedPrices(++step) } });
          evalexGrandTotal(table);
        },
      ),
      bench(
        'HyperFormula',
        {
          beforeAll: () => {
            sheet = HyperFormula.buildFromArray(sheetData(rows), HF_CONFIG);
          },
        },
        () => {
          editHFPrices({ sheet, edit: { firstRow, prices: pastedPrices(++step) } });
          hfGrandTotal(sheet);
        },
      ),
      { warmupIterations: 5, iterations: 50 },
    );
  });
}

// Prices with cents, quantities from 1 to 20 and discounts from 0 to 15%, the same on every run.
// Decimals are parsed from text, so 32.77 is the double closest to 32.77 rather than 31.77 + 1
function orderRows(count: number): OrderRow[] {
  return Array.from({ length: count }, (_, i) => ({
    price: Number(`${((i * 1297) % 10000) + 100}e-2`),
    quantity: ((i * 7) % 20) + 1,
    discount: Number(`${((i * 13) % 4) * 5}e-2`),
  }));
}

// A price that differs from the one written on the previous step
function editedPrice(step: number): number {
  return Number(`${1000 + (step % 1000)}e-2`);
}

function blockCount(rowCount: number): number {
  return Math.ceil(rowCount / BLOCK_SIZE);
}

function formulaCount(rowCount: number): number {
  return rowCount * 5 + blockCount(rowCount) + 1;
}

// Rows in blocks of 50, each block with its total, and the grand total the share of every row reads by name
function buildEvalexTable(rows: readonly OrderRow[]): EvalexTable {
  const blocks = Array.from({ length: blockCount(rows.length) }, (_, block): OrderBlock => ({
    lines: rows.slice(block * BLOCK_SIZE, (block + 1) * BLOCK_SIZE).map((row, offset) => ({
      ...row,
      number: block * BLOCK_SIZE + offset + 1,
      subtotal: new Formula('price * quantity'),
      total: new Formula('round(subtotal * (1 - discount), 2)'),
      size: new Formula('if(total > 500, "large", "small")'),
      label: new Formula('"Order " + number + ": " + total'),
      share: new Formula('total / grand'),
    })),
    total: new Formula('lines.map(current.total()).sum()'),
  }));
  const data: OrderTable = { blocks, grand: new Formula('blocks.map(current.total()).sum()') };
  const evaluator = scope.evaluator();

  return { evaluator, data, view: evaluator.evaluate(data) };
}

function editEvalexPrices({ table, edit }: { table: EvalexTable; edit: PriceEdit }): void {
  edit.prices.forEach((price, offset) => {
    const row = edit.firstRow + offset;

    table.data.blocks[Math.floor(row / BLOCK_SIZE)].lines[row % BLOCK_SIZE].price = price;
  });

  table.view = table.evaluator.evaluate(table.data);
}

function evalexGrandTotal(table: EvalexTable): unknown {
  return table.view.grand;
}

// The same table as `buildEvalexTable`, laid out in columns A–H with block totals in J and the grand total in K1
function sheetData(rows: readonly OrderRow[]): RawCellContent[][] {
  const blocks = blockCount(rows.length);

  return rows.map((row, i) => {
    const r = i + 1;
    const blockStart = i * BLOCK_SIZE + 1;
    const blockEnd = Math.min((i + 1) * BLOCK_SIZE, rows.length);

    return [
      row.price,
      row.quantity,
      row.discount,
      `=A${r}*B${r}`,
      `=ROUND(D${r}*(1-C${r}),2)`,
      `=IF(E${r}>500,"large","small")`,
      `="Order "&${r}&": "&E${r}`,
      `=E${r}/$K$1`,
      null,
      i < blocks ? `=SUM(E${blockStart}:E${blockEnd})` : null,
      i === 0 ? `=SUM(J1:J${blocks})` : null,
    ];
  });
}

function editHFPrices({ sheet, edit }: { sheet: HyperFormula; edit: PriceEdit }): void {
  sheet.setCellContents(
    { sheet: 0, col: HF_COLUMN.price, row: edit.firstRow },
    edit.prices.map((price) => [price]),
  );
}

function hfCell({ sheet, col, row }: { sheet: HyperFormula; col: number; row: number }): CellValue {
  return sheet.getCellValue({ sheet: 0, col, row });
}

function hfGrandTotal(sheet: HyperFormula): number {
  return Number(hfCell({ sheet, col: HF_COLUMN.grand, row: 0 }));
}
