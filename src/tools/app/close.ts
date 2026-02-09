import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ElectronCloseTool extends BaseTool {
  readonly name = 'electron_close';
  readonly description = 'Close the Electron application and end the WebdriverIO session';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    if (!context.isConnected()) {
      return this.error('No Electron app is currently running');
    }

    try {
      // Record action if recording is enabled
      context.recordAction('electron_close', {});

      await context.close();
      return this.success('Electron app closed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to close Electron app: ${message}`);
    }
  }
}
