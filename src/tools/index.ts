import { BaseTool } from './base.js';

// App lifecycle
import { ElectronLaunchTool, ElectronCloseTool } from './app/index.js';

// Elements
import { ElectronSnapshotTool, ElectronClickTool, ElectronTypeTool } from './elements/index.js';

// Page
import { ElectronScreenshotTool } from './page/index.js';

// Window
import { ResizeWindowTool } from './window/index.js';

// Recording
import { ElectronStartRecordingTool, ElectronStopRecordingTool, ElectronRecordingStatusTool } from './recording/index.js';

// Generator
import { ElectronGenerateTestTool, ElectronGeneratorSetupTool, ElectronGeneratorWriteTestTool, ElectronGeneratorReadLogTool } from './generator/index.js';

// CDP tools
import { ElectronCDPNetworkTool, ElectronCDPConsoleTool, ElectronCDPPerformanceTool, ElectronCDPEvaluateTool } from './cdp/index.js';

// Planner tools
import { ElectronPlannerSetupTool, ElectronPlannerExploreTool, ElectronPlannerSaveTool } from './planner/index.js';

// Healer tools
import { ElectronHealerRunTestsTool, ElectronHealerDebugTestTool, ElectronHealerFixTestTool } from './healer/index.js';

// Verification tools
import { ElectronVerifyElementVisibleTool, ElectronVerifyTextVisibleTool, ElectronVerifyValueTool, ElectronGenerateLocatorTool } from './verification/index.js';

export function getAllTools(): BaseTool[] {
  return [
    // App lifecycle (2)
    new ElectronLaunchTool(),
    new ElectronCloseTool(),

    // Elements (3)
    new ElectronSnapshotTool(),
    new ElectronClickTool(),
    new ElectronTypeTool(),

    // Page (1)
    new ElectronScreenshotTool(),

    // Window (1)
    new ResizeWindowTool(),

    // Recording (3)
    new ElectronStartRecordingTool(),
    new ElectronStopRecordingTool(),
    new ElectronRecordingStatusTool(),

    // Generator (4)
    new ElectronGenerateTestTool(),
    new ElectronGeneratorSetupTool(),
    new ElectronGeneratorWriteTestTool(),
    new ElectronGeneratorReadLogTool(),

    // CDP (4)
    new ElectronCDPNetworkTool(),
    new ElectronCDPConsoleTool(),
    new ElectronCDPPerformanceTool(),
    new ElectronCDPEvaluateTool(),

    // Planner (3)
    new ElectronPlannerSetupTool(),
    new ElectronPlannerExploreTool(),
    new ElectronPlannerSaveTool(),

    // Healer (3)
    new ElectronHealerRunTestsTool(),
    new ElectronHealerDebugTestTool(),
    new ElectronHealerFixTestTool(),

    // Verification (4)
    new ElectronVerifyElementVisibleTool(),
    new ElectronVerifyTextVisibleTool(),
    new ElectronVerifyValueTool(),
    new ElectronGenerateLocatorTool()
  ];
}

// Re-export all tools for direct access
export {
  // App
  ElectronLaunchTool,
  ElectronCloseTool,
  // Elements
  ElectronSnapshotTool,
  ElectronClickTool,
  ElectronTypeTool,
  // Page
  ElectronScreenshotTool,
  // Window
  ResizeWindowTool,
  // Recording
  ElectronStartRecordingTool,
  ElectronStopRecordingTool,
  ElectronRecordingStatusTool,
  // Generator
  ElectronGenerateTestTool,
  ElectronGeneratorSetupTool,
  ElectronGeneratorWriteTestTool,
  ElectronGeneratorReadLogTool,
  // CDP
  ElectronCDPNetworkTool,
  ElectronCDPConsoleTool,
  ElectronCDPPerformanceTool,
  ElectronCDPEvaluateTool,
  // Planner
  ElectronPlannerSetupTool,
  ElectronPlannerExploreTool,
  ElectronPlannerSaveTool,
  // Healer
  ElectronHealerRunTestsTool,
  ElectronHealerDebugTestTool,
  ElectronHealerFixTestTool,
  // Verification
  ElectronVerifyElementVisibleTool,
  ElectronVerifyTextVisibleTool,
  ElectronVerifyValueTool,
  ElectronGenerateLocatorTool
};
