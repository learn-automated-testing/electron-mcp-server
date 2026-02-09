/**
 * Generator Setup Tool - Initialize a test generation session
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  testPlan: z.string().describe('Path to test plan file or test plan content'),
  framework: z.enum([
    'webdriverio-js',
    'webdriverio-ts',
    'playwright-js',
    'playwright-ts'
  ]).describe('Test framework to generate code for'),
  outputDir: z.string().optional().describe('Directory to save generated tests (defaults to ./tests)')
});

interface GeneratorSession {
  testPlan: string;
  framework: string;
  outputDir: string;
  startTime: number;
  generatedTests: GeneratedTest[];
  actionLog: ActionLogEntry[];
}

interface GeneratedTest {
  name: string;
  filename: string;
  content: string;
  timestamp: number;
}

interface ActionLogEntry {
  action: string;
  element?: string;
  value?: string;
  timestamp: number;
  success: boolean;
  screenshot?: string;
}

// Store session
let generatorSession: GeneratorSession | null = null;

export function getGeneratorSession(): GeneratorSession | null {
  return generatorSession;
}

export function setGeneratorSession(session: GeneratorSession | null): void {
  generatorSession = session;
}

export function addToActionLog(entry: ActionLogEntry): void {
  if (generatorSession) {
    generatorSession.actionLog.push(entry);
  }
}

export class ElectronGeneratorSetupTool extends BaseTool {
  readonly name = 'electron_generator_setup';
  readonly description = 'Initialize a test generation session. Provide a test plan and target framework.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { testPlan, framework, outputDir } = this.parseParams(schema, params);

    // Initialize the generator session
    const session: GeneratorSession = {
      testPlan,
      framework,
      outputDir: outputDir || './tests',
      startTime: Date.now(),
      generatedTests: [],
      actionLog: []
    };

    setGeneratorSession(session);

    const frameworkInfo = this.getFrameworkInfo(framework);

    const message = [
      `Test Generation Session Initialized`,
      `===================================`,
      `Framework: ${framework}`,
      `Output Directory: ${session.outputDir}`,
      ``,
      `Framework Details:`,
      `  Language: ${frameworkInfo.language}`,
      `  Test Runner: ${frameworkInfo.runner}`,
      `  File Extension: ${frameworkInfo.extension}`,
      ``,
      `Next steps:`,
      `1. Launch the app with electron_launch`,
      `2. Start recording with electron_start_recording`,
      `3. Execute test steps and verify with electron_verify_* tools`,
      `4. Stop recording with electron_stop_recording`,
      `5. Generate tests with electron_generate_test`,
      `6. Save tests with electron_generator_write_test`
    ].join('\n');

    return this.success(message);
  }

  private getFrameworkInfo(framework: string): { language: string; runner: string; extension: string } {
    const info: Record<string, { language: string; runner: string; extension: string }> = {
      'webdriverio-js': { language: 'JavaScript', runner: 'Mocha', extension: '.spec.js' },
      'webdriverio-ts': { language: 'TypeScript', runner: 'Mocha', extension: '.spec.ts' },
      'playwright-js': { language: 'JavaScript', runner: 'Playwright Test', extension: '.spec.js' },
      'playwright-ts': { language: 'TypeScript', runner: 'Playwright Test', extension: '.spec.ts' }
    };
    return info[framework] || info['webdriverio-ts'];
  }
}
