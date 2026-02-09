/**
 * Simple logger utility for electron-mcp-server
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLevel: LogLevel = 'info';

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (args.length > 0) {
    return `${prefix} ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.error(formatMessage('debug', message, ...args));
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.error(formatMessage('info', message, ...args));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.error(formatMessage('warn', message, ...args));
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, ...args));
    }
  }
};
