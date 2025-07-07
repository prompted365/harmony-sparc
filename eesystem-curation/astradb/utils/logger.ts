/**
 * Logger utility for EESystem AstraDB Integration
 */

export interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

export class Logger {
  private logLevel: keyof LogLevel;

  constructor(logLevel: keyof LogLevel = 'INFO') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: LogLevel = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('INFO')) {
      console.info(`[INFO] ${message}`, meta || '');
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }
}

export const logger = new Logger();