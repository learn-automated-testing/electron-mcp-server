import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) from the snapshot')
});

export class ElectronClickTool extends BaseTool {
  readonly name = 'electron_click';
  readonly description = 'Click on an element using its reference from the snapshot';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const snapshot = await context.getSnapshot();
      const elementInfo = snapshot.elements.get(ref);

      const element = await context.getElementByRef(ref);
      await element.click();

      // Record action if recording is enabled
      context.recordAction('electron_click', { ref }, elementInfo ? {
        ref,
        tagName: elementInfo.tagName,
        text: elementInfo.text,
        attributes: elementInfo.attributes
      } : undefined);

      return this.success(`Clicked element ${ref}`, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to click element ${ref}: ${message}`);
    }
  }
}
