/**
 * Healer Run Tests Tool - Execute test suite and collect failure information
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  testPath: z.string().describe('Path to test file or directory to run'),
  framework: z.enum([
    'webdriverio',
    'playwright',
    'mocha',
    'jest'
  ]).optional().default('webdriverio').describe('Test framework being used'),
  configPath: z.string().optional().describe('Path to test configuration file'),
  timeout: z.number().optional().default(300000).describe('Test timeout in milliseconds')
});

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  stack?: string;
}

export class ElectronHealerRunTestsTool extends BaseTool {
  readonly name = 'electron_healer_run_tests';
  readonly description = 'Execute test suite and collect failure information for debugging.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, framework = 'webdriverio', configPath, timeout } = this.parseParams(schema, params);

    try {
      const command = this.buildCommand(framework, testPath, configPath ?? undefined);

      let output: string;
      let exitCode = 0;

      try {
        output = execSync(command, {
          encoding: 'utf-8',
          timeout,
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
      } catch (err) {
        const execError = err as { stdout?: string; stderr?: string; status?: number };
        output = (execError.stdout || '') + '\n' + (execError.stderr || '');
        exitCode = execError.status || 1;
      }

      const results = this.parseTestResults(output, framework ?? 'webdriverio');

      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;

      const lines: string[] = [
        `Test Execution Complete`,
        `=======================`,
        `Exit Code: ${exitCode}`,
        ``,
        `Results Summary:`,
        `  Passed: ${passed}`,
        `  Failed: ${failed}`,
        `  Skipped: ${skipped}`,
        `  Total: ${results.length}`,
        ``
      ];

      if (failed > 0) {
        lines.push(`Failed Tests:`);
        lines.push(`-------------`);
        for (const result of results.filter(r => r.status === 'failed')) {
          lines.push(`\n  ❌ ${result.name}`);
          if (result.error) {
            lines.push(`     Error: ${result.error}`);
          }
          if (result.stack) {
            // Show first few lines of stack trace
            const stackLines = result.stack.split('\n').slice(0, 5);
            lines.push(`     Stack:`);
            for (const line of stackLines) {
              lines.push(`       ${line}`);
            }
          }
        }
        lines.push('');
        lines.push(`Next Steps:`);
        lines.push(`1. Use electron_healer_debug_test to investigate specific failures`);
        lines.push(`2. Use electron_snapshot to see current UI state`);
        lines.push(`3. Use electron_healer_fix_test to apply fixes`);
      } else if (results.length === 0) {
        lines.push(`No test results found in output. Raw output:`);
        lines.push(output.substring(0, 2000));
      } else {
        lines.push(`All tests passed! ✅`);
      }

      return this.success(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to run tests: ${message}`);
    }
  }

  private buildCommand(framework: string, testPath: string, configPath?: string): string {
    switch (framework) {
      case 'webdriverio':
        return configPath
          ? `npx wdio ${configPath} --spec ${testPath}`
          : `npx wdio run --spec ${testPath}`;
      case 'playwright':
        return configPath
          ? `npx playwright test ${testPath} --config=${configPath}`
          : `npx playwright test ${testPath}`;
      case 'mocha':
        return configPath
          ? `npx mocha ${testPath} --config ${configPath}`
          : `npx mocha ${testPath}`;
      case 'jest':
        return configPath
          ? `npx jest ${testPath} --config=${configPath}`
          : `npx jest ${testPath}`;
      default:
        return `npx ${framework} ${testPath}`;
    }
  }

  private parseTestResults(output: string, framework: string): TestResult[] {
    const results: TestResult[] = [];

    // Generic patterns that work across frameworks
    const passedPattern = /✓|PASS|passed|✔/gi;
    const failedPattern = /✗|FAIL|failed|✘|Error:|AssertionError/gi;

    // Try to extract test names and statuses
    const lines = output.split('\n');

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;

      // Check for test result patterns
      if (passedPattern.test(line)) {
        const name = line.replace(/✓|✔|PASS(ED)?/gi, '').trim();
        if (name) {
          results.push({ name, status: 'passed', duration: 0 });
        }
      } else if (failedPattern.test(line)) {
        const name = line.replace(/✗|✘|FAIL(ED)?|Error:|AssertionError/gi, '').trim();
        if (name && name.length < 200) {
          // Find error message in subsequent lines
          const idx = lines.indexOf(line);
          let error = '';
          let stack = '';
          for (let i = idx + 1; i < Math.min(idx + 20, lines.length); i++) {
            if (lines[i].includes('at ') || lines[i].includes('Error')) {
              stack += lines[i] + '\n';
            } else if (!lines[i].match(/✓|✗|PASS|FAIL/)) {
              error += lines[i].trim() + ' ';
            }
          }
          results.push({
            name,
            status: 'failed',
            duration: 0,
            error: error.trim() || undefined,
            stack: stack.trim() || undefined
          });
        }
      }
    }

    return results;
  }
}
