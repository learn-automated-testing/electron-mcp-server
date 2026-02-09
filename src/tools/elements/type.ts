import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  ref: z.string().describe('Element reference (e.g., e1, e2) for input field'),
  text: z.string().describe('Text to type into the field'),
  clear: z.boolean().optional().default(true).describe('Clear existing text before typing')
});

export class ElectronTypeTool extends BaseTool {
  readonly name = 'electron_type';
  readonly description = 'Type text into an input field or textarea';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, text, clear } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const snapshot = await context.getSnapshot();
      const elementInfo = snapshot.elements.get(ref);

      const element = await context.getElementByRef(ref);

      if (clear) {
        await element.clearValue();
      }

      await element.setValue(text);

      // Record action if recording is enabled
      context.recordAction('electron_type', { ref, text, clear }, elementInfo ? {
        ref,
        tagName: elementInfo.tagName,
        text: elementInfo.text,
        attributes: elementInfo.attributes
      } : undefined);

      return this.success(`Typed "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}" into ${ref}`, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to type into element ${ref}: ${message}`);
    }
  }
}
