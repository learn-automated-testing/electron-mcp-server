/**
 * Utility to detect Electron version from target app and manage chromedriver
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

interface ElectronInfo {
  version: string;
  chromiumVersion: string;
  binaryPath: string;
}

// Electron to Chromium version mapping (subset of common versions)
const ELECTRON_CHROMIUM_MAP: Record<string, string> = {
  '28': '120',
  '27': '118',
  '26': '116',
  '25': '114',
  '24': '112',
  '23': '110',
  '22': '108',
  '21': '106',
  '20': '104',
  '19': '102',
};

/**
 * Detect Electron version from an app path
 */
export async function detectElectronVersion(appPath: string): Promise<ElectronInfo | null> {
  try {
    // Try to find package.json in the app directory
    const packageJsonPath = path.join(appPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check devDependencies and dependencies for electron
      const electronVersion =
        packageJson.devDependencies?.electron ||
        packageJson.dependencies?.electron;

      if (electronVersion) {
        const version = electronVersion.replace(/[\^~>=<]/g, '');
        const majorVersion = version.split('.')[0];
        const chromiumVersion = ELECTRON_CHROMIUM_MAP[majorVersion] || '120';

        // Find the binary path
        const binaryPath = findElectronBinary(appPath);

        logger.info(`Detected Electron v${version} (Chromium ${chromiumVersion})`);

        return {
          version,
          chromiumVersion,
          binaryPath: binaryPath || ''
        };
      }
    }

    // Try to find electron in node_modules
    const electronPackagePath = path.join(appPath, 'node_modules', 'electron', 'package.json');
    if (fs.existsSync(electronPackagePath)) {
      const electronPackage = JSON.parse(fs.readFileSync(electronPackagePath, 'utf-8'));
      const version = electronPackage.version;
      const majorVersion = version.split('.')[0];
      const chromiumVersion = ELECTRON_CHROMIUM_MAP[majorVersion] || '120';
      const binaryPath = findElectronBinary(appPath);

      logger.info(`Detected Electron v${version} from node_modules`);

      return {
        version,
        chromiumVersion,
        binaryPath: binaryPath || ''
      };
    }

    return null;
  } catch (err) {
    logger.error('Failed to detect Electron version:', err);
    return null;
  }
}

/**
 * Find the Electron binary path for the given app
 */
export function findElectronBinary(appPath: string): string | null {
  const platform = process.platform;

  const possiblePaths = platform === 'darwin'
    ? [
        path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
        path.join(appPath, 'node_modules', '.bin', 'electron'),
      ]
    : platform === 'win32'
    ? [
        path.join(appPath, 'node_modules', 'electron', 'dist', 'electron.exe'),
        path.join(appPath, 'node_modules', '.bin', 'electron.cmd'),
      ]
    : [
        path.join(appPath, 'node_modules', 'electron', 'dist', 'electron'),
        path.join(appPath, 'node_modules', '.bin', 'electron'),
      ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Ensure chromedriver is available for the given Chromium version
 */
export async function ensureChromedriver(chromiumVersion: string): Promise<string> {
  const chromedriverDir = path.join(process.cwd(), '.chromedriver');
  const chromedriverPath = path.join(chromedriverDir, `chromedriver-${chromiumVersion}`);

  // Check if we already have the right version
  if (fs.existsSync(chromedriverPath)) {
    logger.info(`Using cached chromedriver for Chromium ${chromiumVersion}`);
    return chromedriverPath;
  }

  // Create directory if needed
  if (!fs.existsSync(chromedriverDir)) {
    fs.mkdirSync(chromedriverDir, { recursive: true });
  }

  // Install chromedriver using npm
  logger.info(`Installing chromedriver for Chromium ${chromiumVersion}...`);

  try {
    execSync(`npx @puppeteer/browsers install chromedriver@${chromiumVersion} --path ${chromedriverDir}`, {
      stdio: 'pipe'
    });

    // Find the installed chromedriver
    const files = fs.readdirSync(chromedriverDir, { recursive: true }) as string[];
    const chromedriverBin = files.find(f =>
      f.includes('chromedriver') && !f.endsWith('.zip')
    );

    if (chromedriverBin) {
      const fullPath = path.join(chromedriverDir, chromedriverBin);
      fs.chmodSync(fullPath, 0o755);
      return fullPath;
    }
  } catch (err) {
    logger.error('Failed to install chromedriver:', err);
  }

  throw new Error(`Could not install chromedriver for Chromium ${chromiumVersion}`);
}
