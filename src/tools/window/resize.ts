/**
 * Resize window tool - uses JavaScript since WebDriver setWindowSize doesn't work with Electron
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  width: z.number().min(100).max(10000).describe('Window width in pixels'),
  height: z.number().min(100).max(10000).describe('Window height in pixels'),
  x: z.number().optional().describe('Window X position (optional)'),
  y: z.number().optional().describe('Window Y position (optional)')
});

export class ResizeWindowTool extends BaseTool {
  readonly name = 'electron_resize_window';
  readonly description = 'Resize the Electron app window to specified dimensions using JavaScript. Also supports setting window position.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { width, height, x, y } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const browser = await context.getBrowser();

      // Use JavaScript to resize - this works in Electron's renderer process
      const script = `
        (function() {
          // Try Electron's remote module (Electron < 14)
          if (typeof require !== 'undefined') {
            try {
              const { remote } = require('electron');
              if (remote && remote.getCurrentWindow) {
                const win = remote.getCurrentWindow();
                win.setSize(${width}, ${height});
                ${x !== undefined && y !== undefined ? `win.setPosition(${x}, ${y});` : ''}
                return { success: true, method: 'remote' };
              }
            } catch (e) {}

            // Try @electron/remote (Electron 14+)
            try {
              const remote = require('@electron/remote');
              if (remote && remote.getCurrentWindow) {
                const win = remote.getCurrentWindow();
                win.setSize(${width}, ${height});
                ${x !== undefined && y !== undefined ? `win.setPosition(${x}, ${y});` : ''}
                return { success: true, method: '@electron/remote' };
              }
            } catch (e) {}
          }

          // Fallback to window.resizeTo (limited - only works if window was opened with window.open)
          try {
            window.resizeTo(${width}, ${height});
            ${x !== undefined && y !== undefined ? `window.moveTo(${x}, ${y});` : ''}
            return { success: true, method: 'window.resizeTo' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await browser.execute(script) as { success: boolean; method?: string; error?: string };

      if (result && result.success) {
        context.recordAction(this.name, { width, height, x, y });

        let message = `Window resized to ${width}x${height}`;
        if (x !== undefined && y !== undefined) {
          message += ` at position (${x}, ${y})`;
        }
        message += ` using ${result.method}`;

        return this.success(message, true);
      }

      // Try CDP fallback
      return await this.resizeViaCDP(browser, width, height, x, y, context);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to resize window: ${message}`);
    }
  }

  private async resizeViaCDP(
    browser: unknown,
    width: number,
    height: number,
    x: number | undefined,
    y: number | undefined,
    context: Context
  ): Promise<ToolResult> {
    try {
      // Use CDP Emulation.setDeviceMetricsOverride to change viewport
      const b = browser as { call: (cmd: string, params: object) => Promise<unknown> };
      await b.call('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      });

      context.recordAction(this.name, { width, height, x, y });

      let message = `Viewport resized to ${width}x${height} using CDP`;
      if (x !== undefined && y !== undefined) {
        message += ` (position not supported via CDP)`;
      }
      return this.success(message, true);
    } catch (cdpErr) {
      return this.error(
        `Could not resize window. Electron apps may need @electron/remote enabled or IPC handlers for window management. ` +
        `Error: ${cdpErr instanceof Error ? cdpErr.message : String(cdpErr)}`
      );
    }
  }
}
