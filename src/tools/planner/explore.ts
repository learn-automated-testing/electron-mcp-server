/**
 * Planner Explore Tool - Document a screen/feature during test planning
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';
import { getPlannerSession, setPlannerSession } from './setup.js';

const schema = z.object({
  screenName: z.string().describe('Name of the screen being explored (e.g., "Login Screen", "Dashboard")'),
  description: z.string().optional().describe('Description of what this screen does'),
  features: z.array(z.object({
    name: z.string().describe('Feature name'),
    description: z.string().describe('What the feature does'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    testCases: z.array(z.string()).optional().describe('Suggested test cases for this feature')
  })).optional().describe('Features discovered on this screen'),
  notes: z.string().optional().describe('Additional notes about this screen')
});

export class ElectronPlannerExploreTool extends BaseTool {
  readonly name = 'electron_planner_explore';
  readonly description = 'Document a screen or feature during test planning. Captures the current state and adds it to the planning session.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { screenName, description, features, notes } = this.parseParams(schema, params);

    const session = getPlannerSession();
    if (!session) {
      return this.error('No planning session active. Call electron_planner_setup first.');
    }

    if (!context.isConnected()) {
      return this.error('No Electron app is running. Launch the app first with electron_launch.');
    }

    try {
      // Capture current snapshot
      const snapshot = await context.captureSnapshot();
      const browser = await context.getBrowser();

      // Take screenshot
      const screenshotPath = `${session.outputDir}/${screenName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
      let screenshotSaved = false;
      try {
        await browser.saveScreenshot(screenshotPath);
        screenshotSaved = true;
      } catch {
        // Screenshot saving might fail, continue anyway
      }

      // Add screen info to session
      const screenInfo = {
        name: screenName,
        url: snapshot.url,
        screenshot: screenshotSaved ? screenshotPath : undefined,
        elements: snapshot.elements.size,
        timestamp: Date.now()
      };
      session.screens.push(screenInfo);

      // Add features to session
      if (features) {
        for (const feature of features) {
          session.features.push({
            name: feature.name,
            screen: screenName,
            description: feature.description,
            priority: feature.priority ?? 'medium',
            testCases: feature.testCases || []
          });
        }
      }

      setPlannerSession(session);

      // Build response
      const lines = [
        `Screen Documented: ${screenName}`,
        `================================`,
        `URL: ${snapshot.url}`,
        `Elements Found: ${snapshot.elements.size}`,
        screenshotSaved ? `Screenshot: ${screenshotPath}` : 'Screenshot: Not saved',
        ``
      ];

      if (description) {
        lines.push(`Description: ${description}`, '');
      }

      if (features && features.length > 0) {
        lines.push(`Features (${features.length}):`);
        for (const f of features) {
          lines.push(`  - ${f.name} [${f.priority}]`);
          lines.push(`    ${f.description}`);
          if (f.testCases && f.testCases.length > 0) {
            lines.push(`    Test cases: ${f.testCases.join(', ')}`);
          }
        }
        lines.push('');
      }

      if (notes) {
        lines.push(`Notes: ${notes}`, '');
      }

      lines.push(`Session Progress:`);
      lines.push(`  Screens documented: ${session.screens.length}`);
      lines.push(`  Features identified: ${session.features.length}`);

      return this.success(lines.join('\n'), true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to explore screen: ${message}`);
    }
  }
}
