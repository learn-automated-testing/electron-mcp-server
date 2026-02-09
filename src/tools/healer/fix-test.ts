/**
 * Healer Fix Test Tool - Apply fixes to a test file
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  testPath: z.string().describe('Path to the test file to fix'),
  fixedCode: z.string().describe('The corrected test code'),
  fixDescription: z.string().describe('Description of what was fixed'),
  createBackup: z.boolean().optional().default(true).describe('Create a backup of the original file')
});

export class ElectronHealerFixTestTool extends BaseTool {
  readonly name = 'electron_healer_fix_test';
  readonly description = 'Apply fixes to a test file. Creates a backup and saves the corrected code.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { testPath, fixedCode, fixDescription, createBackup } = this.parseParams(schema, params);

    try {
      // Verify file exists
      try {
        await fs.access(testPath);
      } catch {
        return this.error(`Test file not found: ${testPath}`);
      }

      // Read original content for backup and comparison
      const originalContent = await fs.readFile(testPath, 'utf-8');

      // Create backup if requested
      let backupPath: string | undefined;
      if (createBackup) {
        const timestamp = Date.now();
        const ext = path.extname(testPath);
        const base = path.basename(testPath, ext);
        const dir = path.dirname(testPath);
        backupPath = path.join(dir, `${base}.backup-${timestamp}${ext}`);
        await fs.writeFile(backupPath, originalContent, 'utf-8');
      }

      // Write the fixed code
      await fs.writeFile(testPath, fixedCode, 'utf-8');

      // Calculate diff stats
      const originalLines = originalContent.split('\n').length;
      const fixedLines = fixedCode.split('\n').length;
      const linesDiff = fixedLines - originalLines;

      // Generate a simple diff summary
      const changes = this.summarizeChanges(originalContent, fixedCode);

      const lines: string[] = [
        `Test Fix Applied Successfully`,
        `=============================`,
        `File: ${testPath}`,
        backupPath ? `Backup: ${backupPath}` : 'Backup: Not created',
        ``,
        `Fix Description:`,
        `  ${fixDescription}`,
        ``,
        `Change Summary:`,
        `  Original lines: ${originalLines}`,
        `  Fixed lines: ${fixedLines}`,
        `  Difference: ${linesDiff >= 0 ? '+' : ''}${linesDiff} lines`,
        ``
      ];

      if (changes.length > 0) {
        lines.push(`Changes Made:`);
        for (const change of changes.slice(0, 10)) {
          lines.push(`  ${change}`);
        }
        if (changes.length > 10) {
          lines.push(`  ... and ${changes.length - 10} more changes`);
        }
        lines.push('');
      }

      lines.push(`Next Steps:`);
      lines.push(`1. Run electron_healer_run_tests to verify the fix`);
      lines.push(`2. If test still fails, use electron_healer_debug_test for more details`);
      lines.push(`3. If fix was incorrect, restore from backup: ${backupPath || 'N/A'}`);

      return this.success(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to apply fix: ${message}`);
    }
  }

  private summarizeChanges(original: string, fixed: string): string[] {
    const changes: string[] = [];
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');

    // Simple line-by-line comparison
    const maxLines = Math.max(originalLines.length, fixedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const fixedLine = fixedLines[i];

      if (origLine !== fixedLine) {
        if (origLine && fixedLine) {
          // Modified line
          if (origLine.trim() !== fixedLine.trim()) {
            changes.push(`Line ${i + 1}: Modified`);
          }
        } else if (!origLine && fixedLine) {
          // Added line
          changes.push(`Line ${i + 1}: Added`);
        } else if (origLine && !fixedLine) {
          // Removed line
          changes.push(`Line ${i + 1}: Removed`);
        }
      }
    }

    return changes;
  }
}
