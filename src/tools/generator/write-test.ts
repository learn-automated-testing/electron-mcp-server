/**
 * Generator Write Test Tool - Save generated test code to file
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';
import { getGeneratorSession } from './setup.js';

const schema = z.object({
  filename: z.string().describe('Filename for the test (e.g., login.spec.ts)'),
  testCode: z.string().describe('The generated test code'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing file')
});

export class ElectronGeneratorWriteTestTool extends BaseTool {
  readonly name = 'electron_generator_write_test';
  readonly description = 'Save generated test code to a file in the output directory.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { filename, testCode, overwrite } = this.parseParams(schema, params);

    const session = getGeneratorSession();
    if (!session) {
      return this.error('No generator session active. Call electron_generator_setup first.');
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(session.outputDir, { recursive: true });

      const filePath = path.join(session.outputDir, filename);

      // Check if file exists
      try {
        await fs.access(filePath);
        if (!overwrite) {
          return this.error(`File ${filePath} already exists. Set overwrite=true to replace it.`);
        }
      } catch {
        // File doesn't exist, which is fine
      }

      // Write the test file
      await fs.writeFile(filePath, testCode, 'utf-8');

      // Add to session
      session.generatedTests.push({
        name: filename,
        filename: filePath,
        content: testCode,
        timestamp: Date.now()
      });

      const message = [
        `Test File Written Successfully`,
        `==============================`,
        `File: ${filePath}`,
        `Size: ${testCode.length} bytes`,
        `Lines: ${testCode.split('\n').length}`,
        ``,
        `Session Progress:`,
        `  Tests Generated: ${session.generatedTests.length}`,
        `  Actions Recorded: ${session.actionLog.length}`
      ].join('\n');

      return this.success(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to write test file: ${message}`);
    }
  }
}
