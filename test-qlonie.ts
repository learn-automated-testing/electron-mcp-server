/**
 * Test script to explore the Qlonie Electron app using electron-mcp-server
 */

import { Context } from './src/context.js';

async function testQlonieApp() {
  console.log('🚀 Starting Qlonie app test...\n');

  const context = new Context();
  // Path to the Qlonie app directory (contains package.json with main: "dist/main/main.js")
  const appPath = '/Users/r.vanderhorst/Documents/develop/AI-tester/electron-app';

  try {
    console.log('📱 Launching Qlonie app...');

    // Launch Qlonie app - context automatically uses --app= flag with appDir
    await context.launchApp({
      binaryPath: `${appPath}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`,
      cwd: appPath,
      // No need to pass args - context will use --app=${appDir} automatically
      windowSize: { width: 1280, height: 800 }
    });

    console.log('✅ App launched!\n');

    // Capture snapshot
    console.log('🔍 Capturing UI snapshot...\n');
    await context.captureSnapshot();
    const snapshotText = context.formatSnapshotAsText();
    console.log(snapshotText);

    // Take screenshot
    const browser = await context.getBrowser();
    const screenshot = await browser.takeScreenshot();
    const fs = await import('fs/promises');
    await fs.writeFile('qlonie-screenshot.png', screenshot, 'base64');
    console.log('\n📸 Screenshot saved: qlonie-screenshot.png\n');

    console.log('✅ Test completed successfully!');

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    console.log('\n🔚 Closing app...');
    await context.close();
  }
}

testQlonieApp();
