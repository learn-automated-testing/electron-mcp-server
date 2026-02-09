import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  binaryPath: z.string().describe('Path to the Electron application binary (.app on macOS, .exe on Windows)'),
  args: z.array(z.string()).optional().describe('Command line arguments to pass to the app'),
  cwd: z.string().optional().describe('Working directory for the app'),
  env: z.record(z.string()).optional().describe('Environment variables to set'),
  windowWidth: z.number().optional().default(1280).describe('Initial window width'),
  windowHeight: z.number().optional().default(720).describe('Initial window height'),
  waitTimeout: z.number().optional().default(10000).describe('Timeout in ms to wait for app to start')
});

export class ElectronLaunchTool extends BaseTool {
  readonly name = 'electron_launch';
  readonly description = 'Launch an Electron application for testing. Connects via WebdriverIO with the Electron service.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { binaryPath, args, cwd, env, windowWidth, windowHeight, waitTimeout } = this.parseParams(schema, params);

    try {
      await context.launchApp({
        binaryPath,
        args,
        cwd,
        env,
        windowSize: {
          width: windowWidth || 1280,
          height: windowHeight || 720
        },
        waitForFirstWindow: true,
        waitTimeout: waitTimeout || 10000
      });

      // Record action if recording is enabled
      context.recordAction('electron_launch', { binaryPath, args });

      return this.success(`Electron app launched: ${binaryPath}`, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to launch Electron app: ${message}`);
    }
  }
}
