import * as API from '../index';

describe('public API', () => {
  it('should export exactly the documented runtime values', () => {
    expect(Object.keys(API).sort()).toEqual([
      'AsyncExecutor',
      'BatchingScheduler',
      'Errors',
      'Executor',
      'Expression',
      'FormulaArray',
      'FormulaBoolean',
      'FormulaDataType',
      'FormulaDate',
      'FormulaDateRange',
      'FormulaDebugger',
      'FormulaDuration',
      'FormulaError',
      'FormulaErrorCode',
      'FormulaNull',
      'FormulaNumber',
      'FormulaObject',
      'FormulaOrchestrator',
      'FormulaRegExp',
      'FormulaRuntime',
      'FormulaScope',
      'FormulaString',
      'ImmediateScheduler',
      'Kind',
      'SyncExecutor',
      'initializeFormulaCore',
    ]);
  });
});
