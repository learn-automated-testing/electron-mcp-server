import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({});

export class ElectronStopRecordingTool extends BaseTool {
  readonly name = 'electron_stop_recording';
  readonly description = 'Stop recording actions and return the recorded action list';
  readonly inputSchema = schema;

  async execute(context: Context, _params: unknown): Promise<ToolResult> {
    const actions = context.stopRecording();

    if (actions.length === 0) {
      return this.success('Recording stopped - no actions were recorded');
    }

    const actionSummary = actions.map((a, i) => {
      const params = Object.entries(a.params)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      return `${i + 1}. ${a.tool}(${params})`;
    }).join('\n');

    return this.success(`Recording stopped - ${actions.length} actions recorded:\n${actionSummary}`);
  }
}
