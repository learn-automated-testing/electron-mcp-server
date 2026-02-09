import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  script: z.string().describe('JavaScript code to execute in the app context'),
  args: z.array(z.unknown()).optional().describe('Arguments to pass to the script'),
  returnValue: z.boolean().optional().default(true).describe('Whether to return the script result')
});

export class ElectronCDPEvaluateTool extends BaseTool {
  readonly name = 'electron_cdp_evaluate';
  readonly description = 'Execute JavaScript code in the Electron app context and return the result';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { script, args, returnValue } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const browser = await context.getBrowser();

      // Wrap script in a function if it doesn't return anything explicitly
      const wrappedScript = returnValue
        ? `return (function() { ${script} })()`
        : script;

      const result = await browser.execute(wrappedScript, ...(args || []));

      // Record action if recording is enabled
      context.recordAction('electron_cdp_evaluate', { script: script.slice(0, 100) });

      if (!returnValue) {
        return this.success('Script executed successfully');
      }

      // Format the result
      let resultStr: string;
      if (result === undefined) {
        resultStr = 'undefined';
      } else if (result === null) {
        resultStr = 'null';
      } else if (typeof result === 'object') {
        resultStr = JSON.stringify(result, null, 2);
      } else {
        resultStr = String(result);
      }

      return this.success(`Script result:\n${resultStr}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Script execution failed: ${message}`);
    }
  }
}
