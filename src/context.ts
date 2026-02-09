import { startElectron } from 'wdio-electron-service';
import {
  PageSnapshot,
  ElementInfo,
  ElectronAppConfig,
  ConsoleLogEntry,
  NetworkEntry,
  RecordedAction,
  MockResponse,
  SessionState
} from './types.js';
import { logger } from './utils/logger.js';
import { detectElectronVersion } from './utils/electron-detector.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WdioElement = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WdioBrowser = any;

export class Context {
  private browser: WdioBrowser | null = null;
  private snapshot: PageSnapshot | null = null;
  private appConfig: ElectronAppConfig | null = null;

  // CDP data
  private consoleLogs: ConsoleLogEntry[] = [];
  private networkEntries: NetworkEntry[] = [];
  private mockResponses: MockResponse[] = [];
  private cdpSession: unknown = null;

  // Recording state
  public recordingEnabled = false;
  public actionHistory: RecordedAction[] = [];

  async launchApp(config: ElectronAppConfig): Promise<void> {
    if (this.browser) {
      await this.close();
    }

    this.appConfig = config;

    // Detect Electron version from target app
    const appDir = config.cwd || config.binaryPath.replace(/\/node_modules\/.*/, '');
    const electronInfo = await detectElectronVersion(appDir);

    if (!electronInfo) {
      throw new Error(`Could not detect Electron version from ${appDir}. Make sure the app has electron installed.`);
    }

    logger.info(`Launching Electron app: ${config.binaryPath}`);
    logger.info(`Detected Electron v${electronInfo.version} (Chromium ${electronInfo.chromiumVersion})`);

    // Use the detected binary path if not explicitly provided
    const binaryPath = config.binaryPath || electronInfo.binaryPath;

    if (!binaryPath) {
      throw new Error('Could not find Electron binary. Please provide binaryPath in config.');
    }

    // Use appBinaryPath with appArgs
    // For development mode, use --app= flag to specify the app directory
    // wdio-electron-service passes appArgs as Chrome args, and --app= is how Electron loads an app
    const appArgs = config.args && config.args.length > 0
      ? config.args
      : [`--app=${appDir}`];  // Default: use --app= flag with app directory

    logger.info(`Launching with appBinaryPath: ${binaryPath}`);
    logger.info(`App args: ${appArgs.join(', ')}`);

    this.browser = await startElectron({
      appBinaryPath: binaryPath,
      appArgs
    });

    // Wait for first window if requested
    if (config.waitForFirstWindow !== false) {
      await this.browser.pause(1000);
    }

    // Set window size if specified - use JavaScript since WebDriver setWindowSize doesn't work
    if (config.windowSize) {
      await this.setWindowSizeViaJS(config.windowSize.width, config.windowSize.height);
    }

    // Initialize CDP session for advanced features
    await this.initializeCDP();

    logger.info('Electron app launched successfully');
  }

  private async initializeCDP(): Promise<void> {
    if (!this.browser) return;

    try {
      // Enable CDP domains for console and network monitoring
      this.cdpSession = await (this.browser as unknown as { getPuppeteer: () => Promise<unknown> }).getPuppeteer?.();

      if (this.cdpSession) {
        logger.debug('CDP session initialized');
      }
    } catch (err) {
      logger.warn('Could not initialize CDP session:', err);
    }
  }

  async getBrowser(): Promise<WdioBrowser> {
    if (!this.browser) {
      throw new Error('Electron app not launched. Call launchApp() first.');
    }
    return this.browser;
  }

  isConnected(): boolean {
    return this.browser !== null;
  }

  async captureSnapshot(): Promise<PageSnapshot> {
    const browser = await this.getBrowser();

    const title = await browser.getTitle();
    const url = await browser.getUrl();
    const elements = await this.discoverElements();

    this.snapshot = {
      title,
      url,
      elements,
      timestamp: Date.now()
    };

    return this.snapshot;
  }

  async getSnapshot(): Promise<PageSnapshot> {
    if (!this.snapshot) {
      return this.captureSnapshot();
    }
    return this.snapshot;
  }

  formatSnapshotAsText(): string {
    if (!this.snapshot) {
      return 'No snapshot available';
    }

    const lines: string[] = [
      `Window: ${this.snapshot.title}`,
      `URL: ${this.snapshot.url}`,
      '',
      'Interactive Elements:'
    ];

    for (const [ref, info] of this.snapshot.elements) {
      const label = info.ariaLabel || info.text || info.role || info.tagName;
      const enabled = info.isEnabled ? '' : ' [disabled]';
      lines.push(`  [${ref}] ${info.tagName}: ${label.slice(0, 50)}${enabled}`);
    }

    return lines.join('\n');
  }

  async getElementByRef(ref: string): Promise<WdioElement> {
    const snapshot = await this.getSnapshot();
    const info = snapshot.elements.get(ref);

    if (!info) {
      throw new Error(`Element ref not found: ${ref}. Available refs: ${Array.from(snapshot.elements.keys()).join(', ')}`);
    }

    const browser = await this.getBrowser();
    return this.findElement(browser, info);
  }

  /**
   * Set window size using JavaScript - works around Electron/Chromedriver limitation
   */
  async setWindowSizeViaJS(width: number, height: number, x?: number, y?: number): Promise<boolean> {
    if (!this.browser) return false;

    const script = `
      (function() {
        // Try Electron's remote module (Electron < 14)
        if (typeof require !== 'undefined') {
          try {
            const { remote } = require('electron');
            if (remote && remote.getCurrentWindow) {
              const win = remote.getCurrentWindow();
              win.setSize(${width}, ${height});
              ${x !== undefined && y !== undefined ? `win.setPosition(${x}, ${y});` : ''}
              return { success: true, method: 'remote' };
            }
          } catch (e) {}

          // Try @electron/remote (Electron 14+)
          try {
            const remote = require('@electron/remote');
            if (remote && remote.getCurrentWindow) {
              const win = remote.getCurrentWindow();
              win.setSize(${width}, ${height});
              ${x !== undefined && y !== undefined ? `win.setPosition(${x}, ${y});` : ''}
              return { success: true, method: '@electron/remote' };
            }
          } catch (e) {}
        }

        // Fallback to window.resizeTo
        try {
          window.resizeTo(${width}, ${height});
          ${x !== undefined && y !== undefined ? `window.moveTo(${x}, ${y});` : ''}
          return { success: true, method: 'window.resizeTo' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;

    try {
      const result = await this.browser.execute(script) as { success: boolean };
      if (result?.success) {
        logger.info(`Window resized to ${width}x${height}`);
        return true;
      }
    } catch (err) {
      logger.warn('Could not resize window via JS:', err);
    }

    // Try CDP fallback - set viewport size
    try {
      await this.browser.call('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      });
      logger.info(`Viewport resized to ${width}x${height} via CDP`);
      return true;
    } catch (err) {
      logger.warn('Could not resize via CDP:', err);
    }

    return false;
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.deleteSession();
      } catch (err) {
        logger.warn('Error closing browser session:', err);
      }
      this.browser = null;
      this.snapshot = null;
      this.consoleLogs = [];
      this.networkEntries = [];
      this.mockResponses = [];
      this.cdpSession = null;
      this.appConfig = null;
    }
  }

  // Recording methods
  recordAction(tool: string, params: Record<string, unknown>, elementInfo?: RecordedAction['elementInfo']): void {
    if (this.recordingEnabled) {
      this.actionHistory.push({
        tool,
        params,
        timestamp: Date.now(),
        elementInfo
      });
    }
  }

  startRecording(): void {
    this.recordingEnabled = true;
    this.actionHistory = [];
    logger.info('Recording started');
  }

  stopRecording(): RecordedAction[] {
    this.recordingEnabled = false;
    logger.info(`Recording stopped with ${this.actionHistory.length} actions`);
    return this.actionHistory;
  }

  clearRecording(): void {
    this.actionHistory = [];
  }

  getRecordingStatus(): { enabled: boolean; actionCount: number } {
    return {
      enabled: this.recordingEnabled,
      actionCount: this.actionHistory.length
    };
  }

  // Console log methods
  addConsoleLog(entry: ConsoleLogEntry): void {
    this.consoleLogs.push(entry);
  }

  getConsoleLogs(level?: string): ConsoleLogEntry[] {
    if (level) {
      return this.consoleLogs.filter(log => log.level === level);
    }
    return [...this.consoleLogs];
  }

  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  // Network methods
  addNetworkEntry(entry: NetworkEntry): void {
    this.networkEntries.push(entry);
  }

  getNetworkEntries(filter?: { url?: string | RegExp; method?: string }): NetworkEntry[] {
    let entries = [...this.networkEntries];

    if (filter?.url) {
      entries = entries.filter(e => {
        if (typeof filter.url === 'string') {
          return e.url.includes(filter.url);
        }
        return filter.url!.test(e.url);
      });
    }

    if (filter?.method) {
      entries = entries.filter(e => e.method === filter.method);
    }

    return entries;
  }

  clearNetworkEntries(): void {
    this.networkEntries = [];
  }

  // Mock responses
  addMockResponse(mock: MockResponse): void {
    this.mockResponses.push(mock);
  }

  getMockResponses(): MockResponse[] {
    return [...this.mockResponses];
  }

  clearMockResponses(): void {
    this.mockResponses = [];
  }

  // Session state
  async getSessionState(): Promise<SessionState> {
    if (!this.browser) {
      return {
        isConnected: false,
        recordingEnabled: this.recordingEnabled,
        actionCount: this.actionHistory.length
      };
    }

    try {
      const title = await this.browser.getTitle();
      const windowHandles = await this.browser.getWindowHandles();

      return {
        isConnected: true,
        appPath: this.appConfig?.binaryPath,
        windowTitle: title,
        windowCount: windowHandles.length,
        recordingEnabled: this.recordingEnabled,
        actionCount: this.actionHistory.length
      };
    } catch {
      return {
        isConnected: false,
        recordingEnabled: this.recordingEnabled,
        actionCount: this.actionHistory.length
      };
    }
  }

  // Element discovery
  private async discoverElements(): Promise<Map<string, ElementInfo>> {
    const browser = await this.getBrowser();
    const elements = new Map<string, ElementInfo>();

    // Find all interactive elements
    const interactiveSelectors = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const selector = interactiveSelectors.join(', ');

    try {
      const foundElementsPromise = browser.$$(selector);
      const foundElements = await foundElementsPromise;

      let refCount = 1;
      const elementsToProcess = (foundElements as unknown as WdioElement[]).slice(0, 100);
      for (const el of elementsToProcess) {
        try {
          const isDisplayed = await el.isDisplayed();
          if (!isDisplayed) continue;

          const ref = `e${refCount++}`;
          const info = await this.extractElementInfo(el, ref);
          elements.set(ref, info);
        } catch {
          // Element might be stale, skip it
          continue;
        }
      }
    } catch (err) {
      logger.warn('Error discovering elements:', err);
    }

    return elements;
  }

  private async extractElementInfo(el: WdioElement, ref: string): Promise<ElementInfo> {
    const tagName = await el.getTagName();
    const text = await el.getText();
    const ariaLabel = await el.getAttribute('aria-label');
    const role = await el.getAttribute('role');
    const id = await el.getAttribute('id');
    const name = await el.getAttribute('name');
    const type = await el.getAttribute('type');
    const href = await el.getAttribute('href');
    const placeholder = await el.getAttribute('placeholder');
    const className = await el.getAttribute('class');
    const isEnabled = await el.isEnabled();

    let boundingBox: ElementInfo['boundingBox'] | undefined;
    try {
      const location = await el.getLocation();
      const size = await el.getSize();
      boundingBox = {
        x: location.x,
        y: location.y,
        width: size.width,
        height: size.height
      };
    } catch {
      // Bounding box not available
    }

    const isClickable = ['a', 'button', 'input'].includes(tagName.toLowerCase()) ||
                        role === 'button' ||
                        role === 'link';

    const attributes: Record<string, string> = {};
    if (id) attributes['id'] = id;
    if (name) attributes['name'] = name;
    if (type) attributes['type'] = type;
    if (href) attributes['href'] = href;
    if (placeholder) attributes['placeholder'] = placeholder;
    if (className) attributes['class'] = className;

    return {
      ref,
      tagName,
      text: text.slice(0, 100),
      ariaLabel: ariaLabel || undefined,
      role: role || undefined,
      isClickable,
      isVisible: true,
      isEnabled,
      attributes,
      boundingBox
    };
  }

  private async findElement(browser: WdioBrowser, info: ElementInfo): Promise<WdioElement> {
    // Try multiple strategies to find the element

    // 1. Try by ID
    if (info.attributes['id']) {
      try {
        const el = browser.$(`#${info.attributes['id']}`);
        if (await el.isDisplayed()) return el as unknown as WdioElement;
      } catch { /* continue to next strategy */ }
    }

    // 2. Try by name
    if (info.attributes['name']) {
      try {
        const el = browser.$(`[name="${info.attributes['name']}"]`);
        if (await el.isDisplayed()) return el as unknown as WdioElement;
      } catch { /* continue to next strategy */ }
    }

    // 3. Try by aria-label
    if (info.ariaLabel) {
      try {
        const el = browser.$(`[aria-label="${info.ariaLabel}"]`);
        if (await el.isDisplayed()) return el as unknown as WdioElement;
      } catch { /* continue to next strategy */ }
    }

    // 4. Try by text content (for buttons/links)
    if (info.text && ['a', 'button'].includes(info.tagName.toLowerCase())) {
      try {
        const el = browser.$(`//${info.tagName}[contains(text(), "${info.text.slice(0, 30)}")]`);
        if (await el.isDisplayed()) return el as unknown as WdioElement;
      } catch { /* continue to next strategy */ }
    }

    // 5. Try by role
    if (info.role) {
      try {
        const el = browser.$(`[role="${info.role}"]`);
        if (await el.isDisplayed()) return el as unknown as WdioElement;
      } catch { /* continue to next strategy */ }
    }

    // 6. Fall back to position-based search
    const elementsPromise = browser.$$(info.tagName);
    const elements = await elementsPromise;
    for (const el of elements as unknown as WdioElement[]) {
      try {
        if (!await el.isDisplayed()) continue;

        const location = await el.getLocation();
        if (info.boundingBox &&
            Math.abs(location.x - info.boundingBox.x) < 10 &&
            Math.abs(location.y - info.boundingBox.y) < 10) {
          return el;
        }
      } catch { /* continue */ }
    }

    throw new Error(`Could not find element: ${info.ref} (${info.tagName})`);
  }

  // Execute JavaScript in the app context
  async executeScript<T>(script: string, args?: unknown[]): Promise<T> {
    const browser = await this.getBrowser();
    return browser.execute(script, ...(args || [])) as T;
  }

  // Take screenshot
  async takeScreenshot(): Promise<string> {
    const browser = await this.getBrowser();
    return browser.saveScreenshot('./screenshot.png').then(() => {
      // WebdriverIO saveScreenshot returns void, we need to get base64
      return browser.takeScreenshot();
    });
  }
}
