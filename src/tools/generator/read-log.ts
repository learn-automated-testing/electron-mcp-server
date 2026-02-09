/**
 * Generator Read Log Tool - Read the action log from the generation session
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';
import { getGeneratorSession } from './setup.js';

const schema = z.object({
  format: z.enum(['text', 'json']).optional().default('text').describe('Output format for the action log')
});

export class ElectronGeneratorReadLogTool extends BaseTool {
  readonly name = 'electron_generator_read_log';
  readonly description = 'Read the action log from the current generation session. Shows all recorded actions.';
  readonly inputSchema = schema;

  async execute(_context: Context, params: unknown): Promise<ToolResult> {
    const { format } = this.parseParams(schema, params);

    const session = getGeneratorSession();
    if (!session) {
      return this.error('No generator session active. Call electron_generator_setup first.');
    }

    if (session.actionLog.length === 0) {
      return this.success('No actions recorded yet. Start recording with electron_start_recording and perform actions.');
    }

    if (format === 'json') {
      return this.success(JSON.stringify(session.actionLog, null, 2));
    }

    // Text format
    const lines: string[] = [
      `Action Log (${session.actionLog.length} actions)`,
      `========================================`,
      ``
    ];

    for (let i = 0; i < session.actionLog.length; i++) {
      const entry = session.actionLog[i];
      const timestamp = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
      const status = entry.success ? '✓' : '✗';

      let actionStr = `${i + 1}. [${timestamp}] ${status} ${entry.action}`;
      if (entry.element) {
        actionStr += ` on "${entry.element}"`;
      }
      if (entry.value) {
        actionStr += ` with value "${entry.value}"`;
      }
      lines.push(actionStr);
    }

    lines.push('');
    lines.push(`Summary:`);
    lines.push(`  Total Actions: ${session.actionLog.length}`);
    lines.push(`  Successful: ${session.actionLog.filter(a => a.success).length}`);
    lines.push(`  Failed: ${session.actionLog.filter(a => !a.success).length}`);

    return this.success(lines.join('\n'));
  }
}
