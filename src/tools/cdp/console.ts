import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  action: z.enum(['get', 'clear', 'start', 'stop']).describe('Action: get logs, clear logs, start/stop monitoring'),
  level: z.enum(['log', 'info', 'warn', 'error', 'debug']).optional().describe('Filter by log level')
});

interface CapturedLog {
  level: string;
  message: string;
  timestamp: number;
}

export class ElectronCDPConsoleTool extends BaseTool {
  readonly name = 'electron_cdp_console';
  readonly description = 'Capture and retrieve console logs from the Electron app';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action, level } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      switch (action) {
        case 'get': {
          const logs = context.getConsoleLogs(level);

          if (logs.length === 0) {
            return this.success(level ? `No ${level} logs captured` : 'No console logs captured');
          }

          const summary = logs.map(log => {
            const time = new Date(log.timestamp).toISOString();
            return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
          }).join('\n');

          return this.success(`Console logs (${logs.length}):\n${summary}`);
        }

        case 'clear': {
          context.clearConsoleLogs();
          return this.success('Console logs cleared');
        }

        case 'start': {
          try {
            const browser = await context.getBrowser();

            // Inject console interceptor using string script
            const script = `
              (function() {
                var originalConsole = Object.assign({}, console);
                var capturedLogs = [];
                window.__capturedLogs = capturedLogs;
                ['log', 'info', 'warn', 'error', 'debug'].forEach(function(lvl) {
                  console[lvl] = function() {
                    var args = Array.prototype.slice.call(arguments);
                    capturedLogs.push({
                      level: lvl,
                      message: args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '),
                      timestamp: Date.now()
                    });
                    originalConsole[lvl].apply(console, args);
                  };
                });
              })();
            `;
            await browser.execute(script);

            return this.success('Console monitoring started');
          } catch {
            return this.success('Console monitoring may require manual setup with CDP');
          }
        }

        case 'stop': {
          try {
            const browser = await context.getBrowser();

            const logs = await browser.execute('return window.__capturedLogs || [];') as unknown as CapturedLog[];

            // Add to context
            for (const log of logs) {
              context.addConsoleLog(log);
            }

            return this.success(`Console monitoring stopped. Retrieved ${logs.length} logs.`);
          } catch {
            return this.success('Console monitoring stopped');
          }
        }

        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Console operation failed: ${message}`);
    }
  }
}
