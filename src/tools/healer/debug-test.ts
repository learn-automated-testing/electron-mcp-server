/**
 * Healer Debug Test Tool - Run a specific test in debug mode
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  testPath: z.string().describe('Path to the test file'),
  testName: z.string().describe('Name of the specific test to debug'),
  framework: z.enum([
    'webdriverio',
    'playwright',
    'mocha',
    'jest'
  ]).optional().default('webdriverio').describe('Test framework being used'),
  configPath: z.string().optional().describe('Path to test configuration file'),
  verbose: z.boolean().optional().default(true).describe('Enable verbose output')
});

export class ElectronHealerDebugTestTool extends BaseTool {
  readonly name = 'electron_healer_debug_test';
  readonly description = 'Run a specific test in debug mode with enhanced logging to diagnose failures.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, testName, framework = 'webdriverio', configPath, verbose = true } = this.parseParams(schema, params);

    try {
      const command = this.buildDebugCommand(framework, testPath, testName, configPath ?? undefined, verbose);

      let output: string;
      let exitCode = 0;

      try {
        output = execSync(command, {
          encoding: 'utf-8',
          timeout: 600000, // 10 minutes for debug mode
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            DEBUG: '*',
            LOG_LEVEL: 'trace',
            NODE_ENV: 'test'
          }
        });
      } catch (err) {
        const execError = err as { stdout?: string; stderr?: string; status?: number };
        output = (execError.stdout || '') + '\n' + (execError.stderr || '');
        exitCode = execError.status || 1;
      }

      // Parse debug output for useful information
      const analysis = this.analyzeDebugOutput(output);

      const lines: string[] = [
        `Debug Session Complete`,
        `======================`,
        `Test: ${testName}`,
        `File: ${testPath}`,
        `Exit Code: ${exitCode}`,
        ``
      ];

      if (analysis.errors.length > 0) {
        lines.push(`Errors Found (${analysis.errors.length}):`);
        for (const error of analysis.errors) {
          lines.push(`  • ${error}`);
        }
        lines.push('');
      }

      if (analysis.warnings.length > 0) {
        lines.push(`Warnings (${analysis.warnings.length}):`);
        for (const warning of analysis.warnings.slice(0, 10)) {
          lines.push(`  • ${warning}`);
        }
        lines.push('');
      }

      if (analysis.selectors.length > 0) {
        lines.push(`Selectors Used:`);
        for (const selector of analysis.selectors.slice(0, 20)) {
          lines.push(`  • ${selector}`);
        }
        lines.push('');
      }

      if (analysis.networkRequests.length > 0) {
        lines.push(`Network Requests:`);
        for (const req of analysis.networkRequests.slice(0, 10)) {
          lines.push(`  • ${req}`);
        }
        lines.push('');
      }

      lines.push(`Diagnosis:`);
      if (analysis.likelyCause) {
        lines.push(`  Likely Cause: ${analysis.likelyCause}`);
        lines.push(`  Suggested Fix: ${analysis.suggestedFix}`);
      } else {
        lines.push(`  Unable to determine root cause automatically.`);
        lines.push(`  Review the full output below.`);
      }

      lines.push('');
      lines.push(`Raw Output (last 3000 chars):`);
      lines.push('---');
      lines.push(output.slice(-3000));

      return this.success(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to debug test: ${message}`);
    }
  }

  private buildDebugCommand(
    framework: string,
    testPath: string,
    testName: string,
    configPath?: string,
    verbose?: boolean
  ): string {
    const verboseFlag = verbose ? '--verbose' : '';
    const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    switch (framework) {
      case 'webdriverio':
        return configPath
          ? `npx wdio ${configPath} --spec ${testPath} --mochaOpts.grep "${escapedTestName}" ${verboseFlag}`
          : `npx wdio run --spec ${testPath} --mochaOpts.grep "${escapedTestName}" ${verboseFlag}`;
      case 'playwright':
        return configPath
          ? `npx playwright test ${testPath} -g "${escapedTestName}" --config=${configPath} --debug`
          : `npx playwright test ${testPath} -g "${escapedTestName}" --debug`;
      case 'mocha':
        return configPath
          ? `npx mocha ${testPath} --grep "${escapedTestName}" --config ${configPath} ${verboseFlag}`
          : `npx mocha ${testPath} --grep "${escapedTestName}" ${verboseFlag}`;
      case 'jest':
        return configPath
          ? `npx jest ${testPath} -t "${escapedTestName}" --config=${configPath} --verbose`
          : `npx jest ${testPath} -t "${escapedTestName}" --verbose`;
      default:
        return `npx ${framework} ${testPath}`;
    }
  }

  private analyzeDebugOutput(output: string): {
    errors: string[];
    warnings: string[];
    selectors: string[];
    networkRequests: string[];
    likelyCause?: string;
    suggestedFix?: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const selectors: string[] = [];
    const networkRequests: string[] = [];
    let likelyCause: string | undefined;
    let suggestedFix: string | undefined;

    const lines = output.split('\n');

    for (const line of lines) {
      // Extract errors
      if (line.includes('Error:') || line.includes('error:')) {
        errors.push(line.trim().substring(0, 200));
      }

      // Extract warnings
      if (line.includes('Warning:') || line.includes('warn:')) {
        warnings.push(line.trim().substring(0, 200));
      }

      // Extract selectors
      const selectorMatch = line.match(/\$\(['"]([^'"]+)['"]\)|\.?\$\$?\(['"]([^'"]+)['"]\)/);
      if (selectorMatch) {
        selectors.push(selectorMatch[1] || selectorMatch[2]);
      }

      // Extract network requests
      if (line.includes('http://') || line.includes('https://')) {
        const urlMatch = line.match(/(https?:\/\/[^\s'"]+)/);
        if (urlMatch) {
          networkRequests.push(urlMatch[1].substring(0, 100));
        }
      }
    }

    // Determine likely cause
    if (output.includes('element not found') || output.includes('NoSuchElement')) {
      likelyCause = 'Element not found - selector may have changed';
      suggestedFix = 'Use electron_snapshot to see current elements and update selector';
    } else if (output.includes('timeout') || output.includes('Timeout')) {
      likelyCause = 'Timeout - element took too long to appear or action timed out';
      suggestedFix = 'Increase wait timeout or check if element is actually rendered';
    } else if (output.includes('stale element')) {
      likelyCause = 'Stale element reference - DOM was updated after finding element';
      suggestedFix = 'Re-query the element after any action that might update the DOM';
    } else if (output.includes('not clickable') || output.includes('not interactable')) {
      likelyCause = 'Element not interactable - may be hidden, covered, or disabled';
      suggestedFix = 'Wait for element to be clickable or check for overlays';
    } else if (errors.length > 0) {
      likelyCause = 'Test error - see error messages above';
      suggestedFix = 'Review error details and fix accordingly';
    }

    return {
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      selectors: [...new Set(selectors)],
      networkRequests: [...new Set(networkRequests)],
      likelyCause,
      suggestedFix
    };
  }
}
