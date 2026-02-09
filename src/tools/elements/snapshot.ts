import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ElectronSnapshotTool extends BaseTool {
  readonly name = 'electron_snapshot';
  readonly description = 'Capture the current UI state including all interactive elements. Returns element references (e1, e2, etc.) that can be used for interactions.';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      await context.captureSnapshot();
      const snapshotText = context.formatSnapshotAsText();
      return this.success(snapshotText, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to capture snapshot: ${message}`);
    }
  }
}
