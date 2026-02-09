import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  filename: z.string().optional().describe('Optional filename to save screenshot to disk')
});

export class ElectronScreenshotTool extends BaseTool {
  readonly name = 'electron_screenshot';
  readonly description = 'Take a screenshot of the current Electron app window. Returns the screenshot as base64 image.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const browser = await context.getBrowser();
      const base64 = await browser.takeScreenshot();

      // Record action if recording is enabled
      context.recordAction('electron_screenshot', { filename });

      if (filename) {
        const fs = await import('fs/promises');
        await fs.writeFile(filename, base64, 'base64');
        return this.success(`Screenshot saved to ${filename}`);
      }

      return this.successWithImage('Screenshot captured', base64);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to take screenshot: ${message}`);
    }
  }
}
