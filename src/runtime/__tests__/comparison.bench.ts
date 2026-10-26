/* eslint-disable test/prefer-lowercase-title */
import type { FormulaDataType, NodeAdapter, Scheduler } from 'evalex';
import type { CellValue, RawCellContent } from 'hyperformula';

import {
  BatchingScheduler,
  Expression,
  FormulaNull,
  FormulaNumber,
  FormulaOrchestrator,
} from 'evalex';
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
 * evalex through `FormulaOrchestrator`, HyperFormula through its sheet methods.
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

interface Cell {
  readonly id: string;
  readonly expression?: Expression;
  value: FormulaDataType | null;
  error?: Error;
}

interface EvalexTable {
  readonly orchestrator: FormulaOrchestrator<Cell>;
  readonly cells: Map<string, Cell>;
}

interface PriceEdit {
  readonly firstRow: number;
  readonly prices: readonly number[];
}

const adapter: NodeAdapter<Cell> = {
  shouldProcess: (cell) => cell.expression !== undefined,
  toFormulaDataType: (cell) => cell.value ?? FormulaNull.instance(),
  toExpression: (cell) => cell.expression ?? null,
  onCalculate: (cell, value) => {
    cell.value = value;
    cell.error = undefined;
  },
  onError: (cell, error) => {
    cell.error = error;
  },
};

it('Comparison: both engines compute the same table', async () => {
  const rows = orderRows(TABLE_SIZES[0]);
  const table = await buildEvalexTable({ rows });
  const sheet = HyperFormula.buildFromArray(sheetData(rows), HF_CONFIG);
  const lastRow = rows.length - 1;

  const failed = [...table.cells.values()].filter((cell) => cell.error !== undefined);

  expect(failed).toEqual([]);

  // evalex rounds the exact decimal half up, while HyperFormula rounds the binary double:
  // a total such as 487.305 becomes 487.31 in evalex and 487.30 in HyperFormula, so each row may differ by a cent
  expect(Math.abs((table.cells.get('grand')!.value!.value as number) - hfGrandTotal(sheet))).toBeLessThanOrEqual(rows.length * 0.01);
  expect(table.cells.get(`share_${lastRow}`)!.value!.value).toBeCloseTo(hfCell({ sheet, col: HF_COLUMN.share, row: lastRow }) as number, 6);
  expect(table.cells.get(`size_${lastRow}`)!.value!.value).toBe(hfCell({ sheet, col: HF_COLUMN.size, row: lastRow }));
  expect(table.cells.get(`label_${lastRow}`)!.value!.value).toBe(hfCell({ sheet, col: HF_COLUMN.label, row: lastRow }));
});

/**
 * Scenario 1: Opening a table
 * Builds the engine from scratch and calculates every formula, as when a user opens a document
 */
for (const rowCount of TABLE_SIZES) {
  it(`Comparison: open a ${rowCount}-row table (${formulaCount(rowCount)} formulas)`, async ({ bench }) => {
    const rows = orderRows(rowCount);

    await bench.compare(
      bench('evalex, new orchestrator', async () => {
        const table = await buildEvalexTable({ rows });
        evalexGrandTotal(table);
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
          beforeAll: async () => {
            table = await buildEvalexTable({ rows });
          },
        },
        async () => {
          await editEvalexPrices({ table, edit: { firstRow, prices: [editedPrice(++step)] } });
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
 * 100 neighboring prices change at once, as when a user pastes a range
 * evalex runs once with the default scheduler, which processes each update as it comes,
 * and once with `BatchingScheduler`, which its docs suggest for bursts of input
 */
for (const rowCount of TABLE_SIZES) {
  it(`Comparison: paste ${PASTE_SIZE} prices into a ${rowCount}-row table`, async ({ bench }) => {
    const rows = orderRows(rowCount);
    const firstRow = rowCount - PASTE_SIZE;
    const pastedPrices = (start: number) => Array.from({ length: PASTE_SIZE }, (_, offset) => editedPrice(start + offset));
    let immediateTable: EvalexTable;
    let batchingTable: EvalexTable;
    let sheet: HyperFormula;
    let step = 0;

    await bench.compare(
      bench(
        'evalex, default scheduler',
        {
          beforeAll: async () => {
            immediateTable = await buildEvalexTable({ rows });
          },
        },
        async () => {
          await editEvalexPrices({ table: immediateTable, edit: { firstRow, prices: pastedPrices(++step) } });
          evalexGrandTotal(immediateTable);
        },
      ),
      bench(
        'evalex, BatchingScheduler with no delay',
        {
          beforeAll: async () => {
            batchingTable = await buildEvalexTable({ rows, scheduler: new BatchingScheduler({ delayMs: 0 }) });
          },
        },
        async () => {
          await editEvalexPrices({ table: batchingTable, edit: { firstRow, prices: pastedPrices(++step) } });
          evalexGrandTotal(batchingTable);
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

async function buildEvalexTable({ rows, scheduler }: { rows: readonly OrderRow[]; scheduler?: Scheduler }): Promise<EvalexTable> {
  const orchestrator = new FormulaOrchestrator<Cell>({ adapter, scheduler });
  const cells = new Map<string, Cell>();

  const add = (cell: Cell) => {
    cells.set(cell.id, cell);
    orchestrator.add(cell);
  };

  const addFormula = (id: string, formula: string) => {
    add({ id, expression: new Expression(formula), value: null });
  };

  // Inputs first, then every formula after the cells it reads, as a host loading a saved table would add them
  rows.forEach((row, i) => {
    add({ id: `price_${i}`, value: new FormulaNumber(row.price) });
    add({ id: `quantity_${i}`, value: new FormulaNumber(row.quantity) });
    add({ id: `discount_${i}`, value: new FormulaNumber(row.discount) });
  });

  rows.forEach((_, i) => {
    addFormula(`subtotal_${i}`, `price_${i} * quantity_${i}`);
    addFormula(`total_${i}`, `round(subtotal_${i} * (1 - discount_${i}), 2)`);
    addFormula(`size_${i}`, `if(total_${i} > 500, "large", "small")`);
    addFormula(`label_${i}`, `"Order " + ${i + 1} + ": " + total_${i}`);
  });

  for (let block = 0; block < blockCount(rows.length); block++) {
    const totals = rows
      .slice(block * BLOCK_SIZE, (block + 1) * BLOCK_SIZE)
      .map((_, offset) => `total_${block * BLOCK_SIZE + offset}`);

    addFormula(`block_${block}`, `sum(${totals.join(', ')})`);
  }

  const blocks = Array.from({ length: blockCount(rows.length) }, (_, block) => `block_${block}`);

  addFormula('grand', `sum(${blocks.join(', ')})`);

  rows.forEach((_, i) => {
    addFormula(`share_${i}`, `total_${i} / grand`);
  });

  await orchestrator.waitForProcessing();

  return { orchestrator, cells };
}

async function editEvalexPrices({ table, edit }: { table: EvalexTable; edit: PriceEdit }): Promise<void> {
  edit.prices.forEach((price, offset) => {
    const id = `price_${edit.firstRow + offset}`;

    table.cells.get(id)!.value = new FormulaNumber(price);
    table.orchestrator.enqueueDependents(id);
  });

  await table.orchestrator.waitForProcessing();
}

function evalexGrandTotal(table: EvalexTable): FormulaDataType | null {
  return table.cells.get('grand')!.value;
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
  return hfCell({ sheet, col: HF_COLUMN.grand, row: 0 }) as number;
}
