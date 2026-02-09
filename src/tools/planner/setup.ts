/**
 * Planner Setup Tool - Initialize a test planning session
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

const schema = z.object({
  appName: z.string().describe('Name of the application being tested'),
  appPath: z.string().describe('Path to the Electron application'),
  scope: z.string().optional().describe('Scope of testing (e.g., "full", "login-flow", "settings")'),
  outputDir: z.string().optional().describe('Directory to save the test plan (defaults to ./test-plans)')
});

interface PlannerSession {
  appName: string;
  appPath: string;
  scope: string;
  outputDir: string;
  startTime: number;
  screens: ScreenInfo[];
  features: FeatureInfo[];
}

interface ScreenInfo {
  name: string;
  url: string;
  screenshot?: string;
  elements: number;
  timestamp: number;
}

interface FeatureInfo {
  name: string;
  screen: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  testCases: string[];
}

// Store session in context (we'll use a global for simplicity)
let plannerSession: PlannerSession | null = null;

export function getPlannerSession(): PlannerSession | null {
  return plannerSession;
}

export function setPlannerSession(session: PlannerSession | null): void {
  plannerSession = session;
}

export class ElectronPlannerSetupTool extends BaseTool {
  readonly name = 'electron_planner_setup';
  readonly description = 'Initialize a test planning session for an Electron application. Call this before exploring the app.';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { appName, appPath, scope, outputDir } = this.parseParams(schema, params);

    // Initialize the planner session
    const session: PlannerSession = {
      appName,
      appPath,
      scope: scope || 'full',
      outputDir: outputDir || './test-plans',
      startTime: Date.now(),
      screens: [],
      features: []
    };

    setPlannerSession(session);

    const message = [
      `Test Planning Session Initialized`,
      `================================`,
      `Application: ${appName}`,
      `App Path: ${appPath}`,
      `Scope: ${session.scope}`,
      `Output Directory: ${session.outputDir}`,
      ``,
      `Next steps:`,
      `1. Launch the app with electron_launch`,
      `2. Use electron_snapshot to capture UI elements`,
      `3. Use electron_planner_explore to document each screen`,
      `4. Use electron_planner_save to generate the test plan`
    ].join('\n');

    return this.success(message);
  }
}
