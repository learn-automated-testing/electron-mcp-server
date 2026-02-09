import { z } from 'zod';

// Element reference from page snapshot
export interface ElementInfo {
  ref: string;           // e1, e2, e3...
  tagName: string;
  text: string;
  ariaLabel?: string;
  role?: string;
  isClickable: boolean;
  isVisible: boolean;
  isEnabled: boolean;
  attributes: Record<string, string>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Page state snapshot
export interface PageSnapshot {
  title: string;
  url: string;
  elements: Map<string, ElementInfo>;
  timestamp: number;
}

// Tool execution result
export interface ToolResult {
  content: string;
  isError?: boolean;
  captureSnapshot?: boolean;
  base64Image?: string;
}

// Tool definition for MCP
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

// Electron app configuration
export interface ElectronAppConfig {
  binaryPath: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  windowSize?: {
    width: number;
    height: number;
  };
  waitForFirstWindow?: boolean;
  waitTimeout?: number;
}

// Console log entry from CDP
export interface ConsoleLogEntry {
  level: string;
  message: string;
  timestamp: number;
  source?: string;
  args?: unknown[];
}

// Network request entry from CDP
export interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  responseTime?: number;
  contentType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  responseBody?: string;
}

// Performance metrics from CDP
export interface PerformanceMetrics {
  timestamp: number;
  metrics: Record<string, number>;
  timing?: PerformanceTiming;
}

export interface PerformanceTiming {
  navigationStart?: number;
  domContentLoaded?: number;
  loadEventEnd?: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

// Recording types
export interface RecordedAction {
  tool: string;
  params: Record<string, unknown>;
  timestamp: number;
  elementInfo?: {
    ref: string;
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
  };
}

// CDP mock response
export interface MockResponse {
  url: string | RegExp;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}

// Session state
export interface SessionState {
  isConnected: boolean;
  appPath?: string;
  windowTitle?: string;
  windowCount?: number;
  recordingEnabled: boolean;
  actionCount: number;
}
