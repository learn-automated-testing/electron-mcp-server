/**
 * Verification Tools - Verify elements, text, and values in the Electron app
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult } from '../../types.js';

// Verify Element Visible
const verifyElementSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., e1, e2)'),
  timeout: z.number().optional().default(5000).describe('Timeout in milliseconds')
});

export class ElectronVerifyElementVisibleTool extends BaseTool {
  readonly name = 'electron_verify_element_visible';
  readonly description = 'Verify that an element is visible on the screen.';
  readonly inputSchema = verifyElementSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, timeout } = this.parseParams(verifyElementSchema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is running. Launch the app first.');
    }

    try {
      const element = await context.getElementByRef(ref);

      // Wait for element to be displayed
      await element.waitForDisplayed({ timeout });

      const isDisplayed = await element.isDisplayed();

      if (isDisplayed) {
        context.recordAction('verify_element_visible', { ref }, { ref, tagName: 'unknown' });
        return this.success(`✓ Element ${ref} is visible`);
      } else {
        return this.error(`✗ Element ${ref} is not visible`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`✗ Verification failed for ${ref}: ${message}`);
    }
  }
}

// Verify Text Visible
const verifyTextSchema = z.object({
  text: z.string().describe('Text to verify is visible on the page'),
  exact: z.boolean().optional().default(false).describe('Require exact match (vs contains)'),
  timeout: z.number().optional().default(5000).describe('Timeout in milliseconds')
});

export class ElectronVerifyTextVisibleTool extends BaseTool {
  readonly name = 'electron_verify_text_visible';
  readonly description = 'Verify that specific text is visible on the page.';
  readonly inputSchema = verifyTextSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { text, exact, timeout } = this.parseParams(verifyTextSchema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is running. Launch the app first.');
    }

    try {
      const browser = await context.getBrowser();

      // Search for text using XPath
      const xpath = exact
        ? `//*[text()="${text}"]`
        : `//*[contains(text(), "${text}")]`;

      const element = await browser.$(xpath);

      await element.waitForDisplayed({ timeout });

      const isDisplayed = await element.isDisplayed();

      if (isDisplayed) {
        const actualText = await element.getText();
        context.recordAction('verify_text_visible', { text, exact });
        return this.success(`✓ Text "${text}" is visible (found: "${actualText.substring(0, 100)}")`);
      } else {
        return this.error(`✗ Text "${text}" is not visible`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`✗ Text verification failed: ${message}`);
    }
  }
}

// Verify Value
const verifyValueSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., e1, e2)'),
  expectedValue: z.string().describe('Expected value of the input element'),
  timeout: z.number().optional().default(5000).describe('Timeout in milliseconds')
});

export class ElectronVerifyValueTool extends BaseTool {
  readonly name = 'electron_verify_value';
  readonly description = 'Verify that an input element has the expected value.';
  readonly inputSchema = verifyValueSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { ref, expectedValue, timeout } = this.parseParams(verifyValueSchema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is running. Launch the app first.');
    }

    try {
      const element = await context.getElementByRef(ref);

      await element.waitForDisplayed({ timeout });

      const actualValue = await element.getValue();

      if (actualValue === expectedValue) {
        context.recordAction('verify_value', { ref, expectedValue }, { ref, tagName: 'input' });
        return this.success(`✓ Element ${ref} has expected value "${expectedValue}"`);
      } else {
        return this.error(`✗ Element ${ref} value mismatch. Expected: "${expectedValue}", Actual: "${actualValue}"`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`✗ Value verification failed for ${ref}: ${message}`);
    }
  }
}

// Generate Locator
const generateLocatorSchema = z.object({
  description: z.string().describe('Description of the element to find (e.g., "login button", "email input")')
});

export class ElectronGenerateLocatorTool extends BaseTool {
  readonly name = 'electron_generate_locator';
  readonly description = 'Generate a robust locator strategy for an element based on description.';
  readonly inputSchema = generateLocatorSchema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { description } = this.parseParams(generateLocatorSchema, params);

    if (!context.isConnected()) {
      return this.error('No Electron app is running. Launch the app first.');
    }

    try {
      const snapshot = await context.captureSnapshot();

      // Search for matching elements
      const matches: Array<{ ref: string; score: number; locators: string[] }> = [];
      const descLower = description.toLowerCase();
      const keywords = descLower.split(/\s+/);

      for (const [ref, info] of snapshot.elements) {
        let score = 0;
        const locators: string[] = [];

        // Check text match
        if (info.text && info.text.toLowerCase().includes(descLower)) {
          score += 10;
        }
        for (const keyword of keywords) {
          if (info.text?.toLowerCase().includes(keyword)) score += 2;
          if (info.ariaLabel?.toLowerCase().includes(keyword)) score += 3;
          if (info.role?.toLowerCase().includes(keyword)) score += 2;
          if (info.attributes['id']?.toLowerCase().includes(keyword)) score += 2;
          if (info.attributes['name']?.toLowerCase().includes(keyword)) score += 2;
        }

        // Generate locators for matching elements
        if (score > 0) {
          // Prefer data-testid
          if (info.attributes['data-testid']) {
            locators.push(`[data-testid="${info.attributes['data-testid']}"]`);
          }
          // Then aria-label
          if (info.ariaLabel) {
            locators.push(`[aria-label="${info.ariaLabel}"]`);
          }
          // Then ID
          if (info.attributes['id']) {
            locators.push(`#${info.attributes['id']}`);
          }
          // Then name
          if (info.attributes['name']) {
            locators.push(`[name="${info.attributes['name']}"]`);
          }
          // Then role
          if (info.role) {
            locators.push(`[role="${info.role}"]`);
          }
          // Then text-based XPath
          if (info.text) {
            locators.push(`//${info.tagName}[contains(text(), "${info.text.substring(0, 30)}")]`);
          }
          // Fallback to tag + class
          if (info.attributes['class']) {
            const firstClass = info.attributes['class'].split(' ')[0];
            locators.push(`${info.tagName}.${firstClass}`);
          }

          matches.push({ ref, score, locators });
        }
      }

      // Sort by score
      matches.sort((a, b) => b.score - a.score);

      if (matches.length === 0) {
        return this.error(`No elements found matching "${description}". Use electron_snapshot to see available elements.`);
      }

      const lines: string[] = [
        `Locator Suggestions for "${description}"`,
        `========================================`,
        ``
      ];

      for (const match of matches.slice(0, 5)) {
        const info = snapshot.elements.get(match.ref)!;
        lines.push(`Element: ${match.ref} (${info.tagName})`);
        lines.push(`  Text: ${info.text?.substring(0, 50) || 'N/A'}`);
        lines.push(`  Match Score: ${match.score}`);
        lines.push(`  Recommended Locators (in order of preference):`);
        for (let i = 0; i < Math.min(3, match.locators.length); i++) {
          lines.push(`    ${i + 1}. ${match.locators[i]}`);
        }
        lines.push('');
      }

      lines.push(`Best Locator: ${matches[0].locators[0]}`);

      return this.success(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to generate locator: ${message}`);
    }
  }
}
