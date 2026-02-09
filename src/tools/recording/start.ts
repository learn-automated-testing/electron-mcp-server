import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ElectronStartRecordingTool extends BaseTool {
  readonly name = 'electron_start_recording';
  readonly description = 'Start recording user actions to generate test scripts later';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    context.startRecording();
    return this.success('Recording started - all actions will be tracked for test generation', false);
  }
}
