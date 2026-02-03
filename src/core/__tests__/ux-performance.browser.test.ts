/* eslint-disable no-console */
/**
 * Browser-based performance test for formula evaluation UX.
 * Measures real-time perceived latency during typing.
 */
import { describe, expect, it } from 'vitest';

import { Expression, FormulaNumber } from '../index';

describe('UX Performance: Formula Evaluation Latency', () => {
  it('should evaluate simple formula under 1ms', () => {
    const expression = new Expression('A + B');
    const context = {
      A: new FormulaNumber(10),
      B: new FormulaNumber(20),
    };

    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      expression.evaluate({ context });
      const end = performance.now();
      latencies.push(end - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    // Report results
    console.log(`[UX Test] Avg latency: ${avgLatency.toFixed(4)}ms, Max: ${maxLatency.toFixed(4)}ms`);

    // Assertions
    expect(avgLatency).toBeLessThan(1); // Should be sub-millisecond
    expect(maxLatency).toBeLessThan(5); // Even worst case should be fast
  });

  it('should evaluate complex formula under 5ms', () => {
    const expression = new Expression('(A + B) * (A - B) / 2 + A * A + B * B');
    const context = {
      A: new FormulaNumber(100),
      B: new FormulaNumber(50),
    };

    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      expression.evaluate({ context });
      const end = performance.now();
      latencies.push(end - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    console.log(`[UX Test Complex] Avg latency: ${avgLatency.toFixed(4)}ms, Max: ${maxLatency.toFixed(4)}ms`);

    expect(avgLatency).toBeLessThan(5);
    expect(maxLatency).toBeLessThan(16); // Under 60fps threshold
  });

  it('should handle 100 rapid evaluations simulating fast typing', () => {
    const formulas = [
      'A',
      'A +',
      'A + B',
      'A + B *',
      'A + B * 2',
      'A + B * 2 +',
      'A + B * 2 + (',
      'A + B * 2 + (A',
      'A + B * 2 + (A -',
      'A + B * 2 + (A - B',
      'A + B * 2 + (A - B)',
    ];

    const context = {
      A: new FormulaNumber(10),
      B: new FormulaNumber(5),
    };

    const latencies: number[] = [];
    const errors: string[] = [];

    for (const formula of formulas) {
      const start = performance.now();
      try {
        const expression = new Expression(formula);
        expression.evaluate({ context });
      }
      catch {
        // Expected for incomplete formulas
        errors.push(formula);
      }
      const end = performance.now();
      latencies.push(end - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const totalTime = latencies.reduce((a, b) => a + b, 0);

    console.log(`[UX Typing Sim] Total: ${totalTime.toFixed(2)}ms for ${formulas.length} keystrokes`);
    console.log(`[UX Typing Sim] Avg per keystroke: ${avgLatency.toFixed(4)}ms`);
    console.log(`[UX Typing Sim] Parse errors (expected): ${errors.length}`);

    // Total processing time should be under 50ms for all keystrokes
    expect(totalTime).toBeLessThan(50);
  });

  it('should measure 60fps budget compliance (16.67ms)', () => {
    const expression = new Expression('A * B + A / B - A % B + A ^ 2');
    const contextBase = {
      A: new FormulaNumber(100),
      B: new FormulaNumber(7),
    };

    // Simulate 60 updates per second for 1 second
    const updates = 60;
    const latencies: number[] = [];

    for (let i = 0; i < updates; i++) {
      // Update context (simulating value change)
      const context = {
        A: new FormulaNumber(100 + i),
        B: contextBase.B,
      };

      const start = performance.now();
      expression.evaluate({ context });
      const end = performance.now();
      latencies.push(end - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const over16ms = latencies.filter((l) => l > 16.67).length;

    console.log(`[60fps Budget] Avg: ${avgLatency.toFixed(4)}ms, Max: ${maxLatency.toFixed(4)}ms`);
    console.log(`[60fps Budget] Frames over budget: ${over16ms}/${updates}`);

    // Should have zero frames over 16.67ms
    expect(over16ms).toBe(0);
    // Average should be well under budget
    expect(avgLatency).toBeLessThan(5);
  });

  it('should provide latency percentiles', () => {
    const expression = new Expression('A + B * 2');
    const context = {
      A: new FormulaNumber(10),
      B: new FormulaNumber(20),
    };

    const latencies: number[] = [];

    // Run 1000 iterations for good percentile data
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      expression.evaluate({ context });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`[Latency Percentiles]`);
    console.log(`  p50: ${p50.toFixed(4)}ms`);
    console.log(`  p90: ${p90.toFixed(4)}ms`);
    console.log(`  p95: ${p95.toFixed(4)}ms`);
    console.log(`  p99: ${p99.toFixed(4)}ms`);

    // 99th percentile should still be under 16ms
    expect(p99).toBeLessThan(16);
    // 50th percentile should be sub-millisecond
    expect(p50).toBeLessThan(1);
  });
});
