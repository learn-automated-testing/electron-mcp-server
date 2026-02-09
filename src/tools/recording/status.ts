import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ElectronRecordingStatusTool extends BaseTool {
  readonly name = 'electron_recording_status';
  readonly description = 'Get the current recording status and action count';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const status = context.getRecordingStatus();

    const statusText = status.enabled
      ? `Recording is ACTIVE with ${status.actionCount} actions recorded`
      : `Recording is STOPPED with ${status.actionCount} actions in history`;

    return this.success(statusText);
  }
}
