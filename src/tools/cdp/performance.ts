import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  action: z.enum(['get', 'timing', 'memory']).describe('Action: get general metrics, navigation timing, or memory info')
});

interface PerformanceResult {
  timestamp: number;
  timing: {
    domContentLoaded?: number;
    loadComplete?: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  } | null;
  resources: number;
}

interface TimingResult {
  startTime: number;
  redirectTime: number;
  dnsTime: number;
  connectTime: number;
  requestTime: number;
  responseTime: number;
  domInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
}

interface MemoryResult {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export class ElectronCDPPerformanceTool extends BaseTool {
  readonly name = 'electron_cdp_performance';
  readonly description = 'Get performance metrics from the Electron app including timing and memory';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { action } = this.parseParams(schema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is currently running. Launch an app first with electron_launch.');
    }

    try {
      const browser = await context.getBrowser();

      switch (action) {
        case 'get': {
          const script = `
            (function() {
              var perf = window.performance;
              var navEntries = perf.getEntriesByType('navigation');
              var entries = navEntries.length > 0 ? navEntries[0] : null;
              var paintEntries = perf.getEntriesByType('paint');
              var firstPaint = paintEntries.find(function(e) { return e.name === 'first-paint'; });
              var fcp = paintEntries.find(function(e) { return e.name === 'first-contentful-paint'; });
              return {
                timestamp: Date.now(),
                timing: entries ? {
                  domContentLoaded: entries.domContentLoadedEventEnd - entries.startTime,
                  loadComplete: entries.loadEventEnd - entries.startTime,
                  firstPaint: firstPaint ? firstPaint.startTime : null,
                  firstContentfulPaint: fcp ? fcp.startTime : null
                } : null,
                resources: perf.getEntriesByType('resource').length
              };
            })();
          `;
          const metrics = await browser.execute(script) as unknown as PerformanceResult;

          const lines = [
            'Performance Metrics:',
            `  Timestamp: ${new Date(metrics.timestamp).toISOString()}`,
            `  Resources loaded: ${metrics.resources}`
          ];

          if (metrics.timing) {
            lines.push(
              `  DOM Content Loaded: ${metrics.timing.domContentLoaded?.toFixed(2)}ms`,
              `  Load Complete: ${metrics.timing.loadComplete?.toFixed(2)}ms`
            );
            if (metrics.timing.firstPaint) {
              lines.push(`  First Paint: ${metrics.timing.firstPaint.toFixed(2)}ms`);
            }
            if (metrics.timing.firstContentfulPaint) {
              lines.push(`  First Contentful Paint: ${metrics.timing.firstContentfulPaint.toFixed(2)}ms`);
            }
          }

          return this.success(lines.join('\n'));
        }

        case 'timing': {
          const script = `
            (function() {
              var perf = window.performance;
              var navEntries = perf.getEntriesByType('navigation');
              var navEntry = navEntries.length > 0 ? navEntries[0] : null;
              if (!navEntry) return null;
              return {
                startTime: navEntry.startTime,
                redirectTime: navEntry.redirectEnd - navEntry.redirectStart,
                dnsTime: navEntry.domainLookupEnd - navEntry.domainLookupStart,
                connectTime: navEntry.connectEnd - navEntry.connectStart,
                requestTime: navEntry.responseStart - navEntry.requestStart,
                responseTime: navEntry.responseEnd - navEntry.responseStart,
                domInteractive: navEntry.domInteractive - navEntry.startTime,
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.startTime,
                loadComplete: navEntry.loadEventEnd - navEntry.startTime
              };
            })();
          `;
          const timing = await browser.execute(script) as unknown as TimingResult | null;

          if (!timing) {
            return this.success('Navigation timing not available');
          }

          const lines = [
            'Navigation Timing:',
            `  Redirect: ${timing.redirectTime.toFixed(2)}ms`,
            `  DNS Lookup: ${timing.dnsTime.toFixed(2)}ms`,
            `  Connection: ${timing.connectTime.toFixed(2)}ms`,
            `  Request: ${timing.requestTime.toFixed(2)}ms`,
            `  Response: ${timing.responseTime.toFixed(2)}ms`,
            `  DOM Interactive: ${timing.domInteractive.toFixed(2)}ms`,
            `  DOM Content Loaded: ${timing.domContentLoaded.toFixed(2)}ms`,
            `  Load Complete: ${timing.loadComplete.toFixed(2)}ms`
          ];

          return this.success(lines.join('\n'));
        }

        case 'memory': {
          const script = `
            (function() {
              var perf = performance;
              if (!perf.memory) return null;
              return {
                usedJSHeapSize: perf.memory.usedJSHeapSize,
                totalJSHeapSize: perf.memory.totalJSHeapSize,
                jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
              };
            })();
          `;
          const memory = await browser.execute(script) as unknown as MemoryResult | null;

          if (!memory) {
            return this.success('Memory info not available');
          }

          const formatBytes = (bytes: number) => {
            const mb = bytes / (1024 * 1024);
            return `${mb.toFixed(2)} MB`;
          };

          const lines = [
            'Memory Usage:',
            `  Used JS Heap: ${formatBytes(memory.usedJSHeapSize)}`,
            `  Total JS Heap: ${formatBytes(memory.totalJSHeapSize)}`,
            `  JS Heap Limit: ${formatBytes(memory.jsHeapSizeLimit)}`,
            `  Heap Usage: ${((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100).toFixed(1)}%`
          ];

          return this.success(lines.join('\n'));
        }

        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Performance operation failed: ${message}`);
    }
  }
}
