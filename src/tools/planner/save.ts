/**
 * Planner Save Tool - Generate and save the test plan
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';
import { getPlannerSession, setPlannerSession } from './setup.js';

const schema = z.object({
  filename: z.string().optional().describe('Filename for the test plan (defaults to app-name-test-plan.md)'),
  includeScreenshots: z.boolean().optional().default(true).describe('Whether to include screenshot references'),
  additionalNotes: z.string().optional().describe('Additional notes to include in the test plan')
});

export class ElectronPlannerSaveTool extends BaseTool {
  readonly name = 'electron_planner_save';
  readonly description = 'Generate and save the test plan document based on the planning session.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { filename, includeScreenshots, additionalNotes } = this.parseParams(schema, params);

    const session = getPlannerSession();
    if (!session) {
      return this.error('No planning session active. Call electron_planner_setup first.');
    }

    if (session.screens.length === 0) {
      return this.error('No screens have been documented. Use electron_planner_explore to document screens first.');
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(session.outputDir, { recursive: true });

      // Generate filename
      const planFilename = filename || `${session.appName.toLowerCase().replace(/\s+/g, '-')}-test-plan.md`;
      const planPath = path.join(session.outputDir, planFilename);

      // Generate the test plan
      const testPlan = this.generateTestPlan(session, includeScreenshots ?? true, additionalNotes);

      // Write the file
      await fs.writeFile(planPath, testPlan, 'utf-8');

      // Clear the session
      setPlannerSession(null);

      const message = [
        `Test Plan Generated Successfully`,
        `================================`,
        `File: ${planPath}`,
        ``,
        `Summary:`,
        `  Application: ${session.appName}`,
        `  Screens Documented: ${session.screens.length}`,
        `  Features Identified: ${session.features.length}`,
        `  Test Cases: ${session.features.reduce((sum, f) => sum + f.testCases.length, 0)}`,
        ``,
        `Next Steps:`,
        `1. Review and approve the test plan`,
        `2. Pass to electron-test-generator agent to create test scripts`
      ].join('\n');

      return this.success(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test plan: ${message}`);
    }
  }

  private generateTestPlan(
    session: { appName: string; appPath: string; scope: string; startTime: number; screens: Array<{ name: string; url: string; screenshot?: string; elements: number; timestamp: number }>; features: Array<{ name: string; screen: string; description: string; priority: 'high' | 'medium' | 'low'; testCases: string[] }> },
    includeScreenshots: boolean,
    additionalNotes?: string
  ): string {
    const lines: string[] = [];
    const date = new Date().toISOString().split('T')[0];

    // Header
    lines.push(`# Test Plan: ${session.appName}`);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **Application**: ${session.appName}`);
    lines.push(`- **App Path**: ${session.appPath}`);
    lines.push(`- **Test Scope**: ${session.scope}`);
    lines.push(`- **Created**: ${date}`);
    lines.push(`- **Framework**: Electron`);
    lines.push('');

    // Application Architecture
    lines.push('## Application Architecture');
    lines.push('');
    lines.push('### Screens');
    lines.push('');
    lines.push('| Screen | URL | Elements |');
    lines.push('|--------|-----|----------|');
    for (const screen of session.screens) {
      lines.push(`| ${screen.name} | ${screen.url} | ${screen.elements} |`);
    }
    lines.push('');

    if (includeScreenshots) {
      lines.push('### Screenshots');
      lines.push('');
      for (const screen of session.screens) {
        if (screen.screenshot) {
          lines.push(`#### ${screen.name}`);
          lines.push(`![${screen.name}](${screen.screenshot})`);
          lines.push('');
        }
      }
    }

    // Feature Inventory
    lines.push('## Feature Inventory');
    lines.push('');
    lines.push('| Feature | Screen | Priority | Test Cases |');
    lines.push('|---------|--------|----------|------------|');
    for (const feature of session.features) {
      lines.push(`| ${feature.name} | ${feature.screen} | ${feature.priority} | ${feature.testCases.length} |`);
    }
    lines.push('');

    // Test Scenarios
    lines.push('## Test Scenarios');
    lines.push('');

    // Group features by screen
    const screenFeatures = new Map<string, typeof session.features>();
    for (const feature of session.features) {
      if (!screenFeatures.has(feature.screen)) {
        screenFeatures.set(feature.screen, []);
      }
      screenFeatures.get(feature.screen)!.push(feature);
    }

    let testCaseNum = 1;
    for (const [screenName, features] of screenFeatures) {
      lines.push(`### Screen: ${screenName}`);
      lines.push('');

      for (const feature of features) {
        lines.push(`#### Feature: ${feature.name}`);
        lines.push('');
        lines.push(`**Description**: ${feature.description}`);
        lines.push(`**Priority**: ${feature.priority.toUpperCase()}`);
        lines.push('');

        if (feature.testCases.length > 0) {
          for (const testCase of feature.testCases) {
            lines.push(`##### TC-${String(testCaseNum).padStart(3, '0')}: ${testCase}`);
            lines.push('');
            lines.push('**Prerequisites**: TBD');
            lines.push('');
            lines.push('**Steps**:');
            lines.push('1. [Define test steps]');
            lines.push('');
            lines.push('**Expected Result**: [Define expected outcome]');
            lines.push('');
            lines.push('---');
            lines.push('');
            testCaseNum++;
          }
        } else {
          // Generate placeholder test cases
          lines.push(`##### TC-${String(testCaseNum).padStart(3, '0')}: Happy path for ${feature.name}`);
          lines.push('');
          lines.push('**Prerequisites**: TBD');
          lines.push('');
          lines.push('**Steps**:');
          lines.push('1. [Define test steps]');
          lines.push('');
          lines.push('**Expected Result**: [Define expected outcome]');
          lines.push('');
          lines.push('---');
          lines.push('');
          testCaseNum++;
        }
      }
    }

    // Additional Notes
    if (additionalNotes) {
      lines.push('## Additional Notes');
      lines.push('');
      lines.push(additionalNotes);
      lines.push('');
    }

    // Electron-Specific Considerations
    lines.push('## Electron-Specific Considerations');
    lines.push('');
    lines.push('### Areas to Test');
    lines.push('- [ ] Window management (resize, minimize, maximize, close)');
    lines.push('- [ ] Menu bar and context menus');
    lines.push('- [ ] Keyboard shortcuts');
    lines.push('- [ ] IPC communication between main and renderer');
    lines.push('- [ ] File system operations');
    lines.push('- [ ] Native dialogs');
    lines.push('- [ ] System tray (if applicable)');
    lines.push('- [ ] Auto-update functionality (if applicable)');
    lines.push('');

    // Appendix
    lines.push('## Appendix');
    lines.push('');
    lines.push('### Test Environment');
    lines.push('- **OS**: [Specify target operating systems]');
    lines.push('- **Electron Version**: [From app package.json]');
    lines.push('- **Node Version**: [Required version]');
    lines.push('');
    lines.push('### Test Data Requirements');
    lines.push('- [List any test data needed]');
    lines.push('');

    return lines.join('\n');
  }
}
