import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, RecordedAction } from '../../types.js';

const schema = z.object({
  format: z.enum(['webdriverio_js', 'webdriverio_ts', 'playwright_js', 'playwright_ts']).describe('Test framework and language format'),
  testName: z.string().optional().default('test_electron_app').describe('Name for the test function'),
  filename: z.string().optional().describe('Optional filename to save the test script'),
  appPath: z.string().optional().describe('Path to the Electron app binary for the generated test')
});

export class ElectronGenerateTestTool extends BaseTool {
  readonly name = 'electron_generate_test';
  readonly description = 'Generate executable test code from recorded actions for WebdriverIO or Playwright';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { format, testName, filename, appPath } = this.parseParams(schema, params);

    if (context.actionHistory.length === 0) {
      return this.error('No actions recorded. Start recording first with electron_start_recording tool.');
    }

    const testNameStr = testName || 'test_electron_app';
    const appPathStr = appPath || '/path/to/your/electron-app';

    const generators: Record<string, () => string> = {
      webdriverio_js: () => this.generateWebdriverIOJS(context.actionHistory, testNameStr, appPathStr),
      webdriverio_ts: () => this.generateWebdriverIOTS(context.actionHistory, testNameStr, appPathStr),
      playwright_js: () => this.generatePlaywrightJS(context.actionHistory, testNameStr, appPathStr),
      playwright_ts: () => this.generatePlaywrightTS(context.actionHistory, testNameStr, appPathStr)
    };

    const generator = generators[format];
    if (!generator) {
      return this.error(`Unsupported format: ${format}`);
    }

    const script = generator();

    // Save to file if requested
    if (filename) {
      try {
        const fs = await import('fs/promises');
        await fs.writeFile(filename, script);
        return this.success(`Generated ${format} test (${context.actionHistory.length} actions).\nSaved to: ${filename}\n\n${script}`, false);
      } catch (err) {
        return this.success(`Generated ${format} test (${context.actionHistory.length} actions).\nFailed to save to ${filename}\n\n${script}`, false);
      }
    }

    return this.success(`Generated ${format} test from ${context.actionHistory.length} recorded actions:\n\n${script}`, false);
  }

  private generateWebdriverIOJS(actions: RecordedAction[], testName: string, appPath: string): string {
    const lines: string[] = [
      "const { remote } = require('webdriverio');",
      '',
      `describe('Electron App Tests', () => {`,
      '    let browser;',
      '',
      '    before(async () => {',
      '        browser = await remote({',
      '            capabilities: {',
      "                browserName: 'electron',",
      "                'wdio:electronServiceOptions': {",
      `                    appBinaryPath: '${appPath}'`,
      '                }',
      '            }',
      '        });',
      '    });',
      '',
      '    after(async () => {',
      '        await browser.deleteSession();',
      '    });',
      '',
      `    it('${testName.replace(/_/g, ' ')}', async () => {`
    ];

    for (const action of actions) {
      const code = this.actionToWebdriverIO(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push(
      '    });',
      '});'
    );

    return lines.join('\n');
  }

  private generateWebdriverIOTS(actions: RecordedAction[], testName: string, appPath: string): string {
    const lines: string[] = [
      "import { remote, Browser } from 'webdriverio';",
      '',
      `describe('Electron App Tests', () => {`,
      '    let browser: Browser;',
      '',
      '    before(async () => {',
      '        browser = await remote({',
      '            capabilities: {',
      "                browserName: 'electron',",
      "                'wdio:electronServiceOptions': {",
      `                    appBinaryPath: '${appPath}'`,
      '                }',
      '            }',
      '        });',
      '    });',
      '',
      '    after(async () => {',
      '        await browser.deleteSession();',
      '    });',
      '',
      `    it('${testName.replace(/_/g, ' ')}', async () => {`
    ];

    for (const action of actions) {
      const code = this.actionToWebdriverIO(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push(
      '    });',
      '});'
    );

    return lines.join('\n');
  }

  private generatePlaywrightJS(actions: RecordedAction[], testName: string, appPath: string): string {
    const lines: string[] = [
      "const { _electron: electron } = require('playwright');",
      "const { test, expect } = require('@playwright/test');",
      '',
      `test('${testName.replace(/_/g, ' ')}', async () => {`,
      `    const electronApp = await electron.launch({ executablePath: '${appPath}' });`,
      '    const window = await electronApp.firstWindow();',
      '',
      '    try {'
    ];

    for (const action of actions) {
      const code = this.actionToPlaywright(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push(
      '    } finally {',
      '        await electronApp.close();',
      '    }',
      '});'
    );

    return lines.join('\n');
  }

  private generatePlaywrightTS(actions: RecordedAction[], testName: string, appPath: string): string {
    const lines: string[] = [
      "import { _electron as electron, ElectronApplication, Page } from 'playwright';",
      "import { test, expect } from '@playwright/test';",
      '',
      `test('${testName.replace(/_/g, ' ')}', async () => {`,
      `    const electronApp: ElectronApplication = await electron.launch({ executablePath: '${appPath}' });`,
      '    const window: Page = await electronApp.firstWindow();',
      '',
      '    try {'
    ];

    for (const action of actions) {
      const code = this.actionToPlaywright(action);
      if (code) lines.push(`        ${code}`);
    }

    lines.push(
      '    } finally {',
      '        await electronApp.close();',
      '    }',
      '});'
    );

    return lines.join('\n');
  }

  private actionToWebdriverIO(action: RecordedAction): string {
    const { tool, params, elementInfo } = action;

    switch (tool) {
      case 'electron_launch':
        return `// App launched: ${params.binaryPath}`;
      case 'electron_click':
        return this.generateClickCode(params, elementInfo, 'wdio');
      case 'electron_type':
        return this.generateTypeCode(params, elementInfo, 'wdio');
      case 'electron_screenshot':
        return `await browser.saveScreenshot('${params.filename || 'screenshot.png'}');`;
      case 'electron_close':
        return '// App closed';
      default:
        return `// TODO: ${tool} - ${JSON.stringify(params)}`;
    }
  }

  private actionToPlaywright(action: RecordedAction): string {
    const { tool, params, elementInfo } = action;

    switch (tool) {
      case 'electron_launch':
        return `// App launched: ${params.binaryPath}`;
      case 'electron_click':
        return this.generateClickCode(params, elementInfo, 'playwright');
      case 'electron_type':
        return this.generateTypeCode(params, elementInfo, 'playwright');
      case 'electron_screenshot':
        return `await window.screenshot({ path: '${params.filename || 'screenshot.png'}' });`;
      case 'electron_close':
        return '// App closed';
      default:
        return `// TODO: ${tool} - ${JSON.stringify(params)}`;
    }
  }

  private generateClickCode(params: Record<string, unknown>, elementInfo: RecordedAction['elementInfo'], framework: 'wdio' | 'playwright'): string {
    if (!elementInfo) {
      return `// Click on element ${params.ref}`;
    }

    // Generate the best selector based on element info
    const selector = this.generateSelector(elementInfo);

    if (framework === 'wdio') {
      return `await browser.$('${selector}').click();`;
    } else {
      return `await window.click('${selector}');`;
    }
  }

  private generateTypeCode(params: Record<string, unknown>, elementInfo: RecordedAction['elementInfo'], framework: 'wdio' | 'playwright'): string {
    const text = params.text as string;

    if (!elementInfo) {
      return `// Type "${text}" into element ${params.ref}`;
    }

    const selector = this.generateSelector(elementInfo);

    if (framework === 'wdio') {
      if (params.clear) {
        return `await browser.$('${selector}').setValue('${text}');`;
      }
      return `await browser.$('${selector}').addValue('${text}');`;
    } else {
      if (params.clear) {
        return `await window.fill('${selector}', '${text}');`;
      }
      return `await window.type('${selector}', '${text}');`;
    }
  }

  private generateSelector(elementInfo: RecordedAction['elementInfo']): string {
    if (!elementInfo) return '';

    // Priority: id > name > aria-label > text content > tag
    if (elementInfo.attributes?.['id']) {
      return `#${elementInfo.attributes['id']}`;
    }
    if (elementInfo.attributes?.['name']) {
      return `[name="${elementInfo.attributes['name']}"]`;
    }
    if (elementInfo.attributes?.['aria-label']) {
      return `[aria-label="${elementInfo.attributes['aria-label']}"]`;
    }
    if (elementInfo.text && ['button', 'a'].includes(elementInfo.tagName.toLowerCase())) {
      return `${elementInfo.tagName}:has-text("${elementInfo.text.slice(0, 30)}")`;
    }
    return elementInfo.tagName;
  }
}
