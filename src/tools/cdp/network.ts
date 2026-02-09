import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  action: z.enum(['get', 'clear', 'mock']).describe('Action to perform: get entries, clear entries, or set up mock'),
  filter: z.object({
    url: z.string().optional().describe('Filter by URL (partial match)'),
    method: z.string().optional().describe('Filter by HTTP method')
  }).optional().describe('Filter criteria for get action'),
  mock: z.object({
    url: z.string().describe('URL pattern to mock (exact match or regex)'),
    status: z.number().optional().default(200).describe('HTTP status code'),
    body: z.string().optional().describe('Response body'),
    contentType: z.string().optional().default('application/json').describe('Content type header')
  }).optional().describe('Mock configuration for mock action')
});

export class ElectronCDPNetworkTool extends BaseTool {
  readonly name = 'electron_cdp_network';
  readonly description = 'Interact with network requests via CDP: get captured requests, clear history, or set up mocks';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action, filter, mock } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      switch (action) {
        case 'get': {
          const entries = context.getNetworkEntries(filter);

          if (entries.length === 0) {
            return this.success('No network entries captured');
          }

          const summary = entries.map(e =>
            `${e.method} ${e.url} -> ${e.status || 'pending'} (${e.responseTime || 0}ms)`
          ).join('\n');

          return this.success(`Network entries (${entries.length}):\n${summary}`);
        }

        case 'clear': {
          context.clearNetworkEntries();
          return this.success('Network entries cleared');
        }

        case 'mock': {
          if (!mock) {
            return this.error('Mock configuration required for mock action');
          }

          context.addMockResponse({
            url: mock.url,
            status: mock.status,
            body: mock.body,
            contentType: mock.contentType
          });

          // Note: Actually intercepting requires additional CDP setup
          // This stores the mock configuration for reference
          return this.success(`Mock configured for ${mock.url} -> ${mock.status}`);
        }

        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Network operation failed: ${message}`);
    }
  }
}
