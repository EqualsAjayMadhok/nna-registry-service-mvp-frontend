/**
 * Enhanced Logger Utility
 *
 * A utility for consistent logging with additional features like
 * log levels, persistence, and categorization.
 */

import { isProduction, isDebuggingAllowed } from './environment';

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Log category for filtering
export enum LogCategory {
  GENERAL = 'GENERAL',
  TAXONOMY = 'TAXONOMY',
  UI = 'UI',
  API = 'API',
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogSize: number = 1000; // Maximum number of logs to keep in memory
  private isEnabled: boolean = !isProduction();
  private isConsoleEnabled: boolean = !isProduction();
  private isPersistenceEnabled: boolean = false;

  private constructor() {
    // Use our centralized environment detection
    const isProd = isProduction();
    
    // Force disable all debugging in production unless explicitly enabled
    if (isProd) {
      this.isEnabled = false;
      this.isConsoleEnabled = false;
      this.isPersistenceEnabled = false;
      
      // In production, we don't even try to load settings unless forced
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('logger_force_enabled') === 'true') {
          this.loadSettings();
        }
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    } else {
      // Only load settings in development
      try {
        this.loadSettings();
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    }
    
    // Double-check production setting after loadSettings (in case it somehow enabled logging)
    if (isProd) {
      try {
        if (!localStorage.getItem('logger_force_enabled')) {
          this.isEnabled = false;
          this.isConsoleEnabled = false;
          this.isPersistenceEnabled = false;
        }
      } catch (e) {
        // Silently fail if localStorage is not available
        this.isEnabled = false;
        this.isConsoleEnabled = false;
        this.isPersistenceEnabled = false;
      }
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Load logger settings from localStorage
   */
  private loadSettings(): void {
    try {
      const settings = localStorage.getItem('logger_settings');

      if (settings) {
        const parsedSettings = JSON.parse(settings);

        this.logLevel = parsedSettings.logLevel ?? LogLevel.INFO;
        this.isEnabled = parsedSettings.isEnabled ?? true;
        this.isConsoleEnabled = parsedSettings.isConsoleEnabled ?? true;
        this.isPersistenceEnabled =
          parsedSettings.isPersistenceEnabled ?? false;
      }

      // Load persisted logs
      if (this.isPersistenceEnabled) {
        const persistedLogs = localStorage.getItem('logger_logs');

        if (persistedLogs) {
          this.logs = JSON.parse(persistedLogs);
        }
      }
    } catch (error) {
      console.error('Error loading logger settings:', error);

      // Reset to defaults
      this.logLevel = LogLevel.INFO;
      this.isEnabled = true;
      this.isConsoleEnabled = true;
      this.isPersistenceEnabled = false;
    }
  }

  /**
   * Save logger settings to localStorage
   */
  private saveSettings(): void {
    try {
      const settings = {
        logLevel: this.logLevel,
        isEnabled: this.isEnabled,
        isConsoleEnabled: this.isConsoleEnabled,
        isPersistenceEnabled: this.isPersistenceEnabled,
      };

      localStorage.setItem('logger_settings', JSON.stringify(settings));

      // Save logs if persistence is enabled
      if (this.isPersistenceEnabled) {
        localStorage.setItem('logger_logs', JSON.stringify(this.logs));
      }
    } catch (error) {
      console.error('Error saving logger settings:', error);
    }
  }

  /**
   * Set the minimum log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.saveSettings();
  }

  /**
   * Enable or disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Enable or disable console output
   */
  public setConsoleEnabled(enabled: boolean): void {
    this.isConsoleEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Enable or disable log persistence
   */
  public setPersistenceEnabled(enabled: boolean): void {
    this.isPersistenceEnabled = enabled;
    this.saveSettings();

    // Clear persisted logs if disabled
    if (!enabled) {
      localStorage.removeItem('logger_logs');
    }
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];

    if (this.isPersistenceEnabled) {
      localStorage.removeItem('logger_logs');
    }
  }

  /**
   * Get all logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level and/or category
   */
  public getFilteredLogs(level?: LogLevel, category?: LogCategory): LogEntry[] {
    return this.logs.filter(log => {
      if (level !== undefined && log.level < level) {
        return false;
      }

      if (category !== undefined && log.category !== category) {
        return false;
      }

      return true;
    });
  }

  /**
   * Add a log entry
   */
  private addLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    ...data: any[]
  ): void {
    if (!this.isEnabled || level < this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();

    const entry: LogEntry = {
      timestamp,
      level,
      category,
      message,
      data: data.length > 0 ? data : undefined,
    };

    // Add to memory logs
    this.logs.push(entry);

    // Trim logs if exceeding max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Output to console if enabled
    if (this.isConsoleEnabled) {
      const categoryPrefix = `[${category}]`;

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(categoryPrefix, message, ...data);
          break;
        case LogLevel.INFO:
          console.info(categoryPrefix, message, ...data);
          break;
        case LogLevel.WARN:
          console.warn(categoryPrefix, message, ...data);
          break;
        case LogLevel.ERROR:
          console.error(categoryPrefix, message, ...data);
          break;
      }
    }

    // Save logs if persistence is enabled
    if (this.isPersistenceEnabled) {
      try {
        localStorage.setItem('logger_logs', JSON.stringify(this.logs));
      } catch (error) {
        // If localStorage fails, disable persistence
        this.isPersistenceEnabled = false;
        this.saveSettings();
      }
    }
  }

  /**
   * Log a debug message
   */
  public debug(message: string, ...data: any[]): void {
    this.addLogEntry(LogLevel.DEBUG, LogCategory.GENERAL, message, ...data);
  }

  /**
   * Log an info message
   */
  public info(message: string, ...data: any[]): void {
    this.addLogEntry(LogLevel.INFO, LogCategory.GENERAL, message, ...data);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, ...data: any[]): void {
    this.addLogEntry(LogLevel.WARN, LogCategory.GENERAL, message, ...data);
  }

  /**
   * Log an error message
   */
  public error(message: string, ...data: any[]): void {
    this.addLogEntry(LogLevel.ERROR, LogCategory.GENERAL, message, ...data);
  }

  /**
   * Log a taxonomy-related message
   */
  public taxonomy(level: LogLevel, message: string, ...data: any[]): void {
    this.addLogEntry(level, LogCategory.TAXONOMY, message, ...data);
  }

  /**
   * Log a UI-related message
   */
  public ui(level: LogLevel, message: string, ...data: any[]): void {
    this.addLogEntry(level, LogCategory.UI, message, ...data);
  }

  /**
   * Log an API-related message
   */
  public api(level: LogLevel, message: string, ...data: any[]): void {
    this.addLogEntry(level, LogCategory.API, message, ...data);
  }
}

export const logger = Logger.getInstance();

/**
 * Utility to quickly check if we're in debug mode (development environment)
 * Use this to conditionally execute code only in development.
 */
export const isDebugMode = (): boolean => {
  // Use our centralized environment detection
  return !isProduction();
};

/**
 * Check if we're definitely in production mode
 */
export const isProductionMode = (): boolean => {
  // Use our centralized environment detection
  return isProduction();
};

/**
 * Safe console logging helper that only logs in development mode
 * Use this for temporary debugging that should be automatically disabled in production.
 */
export const debugLog = (message: string, ...args: any[]): void => {
  // Use isDebuggingAllowed to respect the global setting
  if (isDebuggingAllowed()) {
    console.log(message, ...args);
  }
};

/**
 * Verbose logging helper that only logs in development mode and when verbose_taxonomy_logging flag is set
 * Use this for detailed taxonomy operation tracking that should be suppressed by default.
 */
export const verboseLog = (message: string, ...args: any[]): void => {
  // First check if we're in production - if so, never log regardless of localStorage
  if (isProduction()) {
    return;
  }
  
  // In development, check the verbose flag
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('verbose_taxonomy_logging') === 'true') {
      console.log(message, ...args);
    }
  } catch (e) {
    // Silently fail if localStorage is not available
  }
};

/**
 * Debug error logging helper that only logs errors in development mode
 * Always use this for error logging in development-only code.
 */
export const debugError = (message: string, ...args: any[]): void => {
  // Use isDebuggingAllowed to respect the global setting
  if (isDebuggingAllowed()) {
    console.error(message, ...args);
  }
};

/**
 * Standardized layer name mapping to ensure consistency across the application
 * Use this whenever displaying layer names to ensure consistent naming
 */
export const STANDARD_LAYER_NAMES: Record<string, string> = {
  'G': 'Song',
  'S': 'Star',
  'L': 'Look',
  'M': 'Move',
  'W': 'World',
  'B': 'Beat',
  'P': 'Prop',
  'T': 'Training',
  'C': 'Character',
  'R': 'Rights'
};

/**
 * Standardized layer descriptions
 */
export const STANDARD_LAYER_DESCRIPTIONS: Record<string, string> = {
  'G': 'Music tracks and audio',
  'S': 'Performance avatars',
  'L': 'Costumes & styling',
  'M': 'Choreography',
  'W': 'Environments',
  'B': 'Virtual beats and rhythms',
  'P': 'Props and accessories',
  'T': 'Training data and datasets',
  'C': 'Character composites',
  'R': 'Rights and ownership'
};

/**
 * Get a standardized layer name with fallback to the code
 */
export const getStandardLayerName = (layer: string): string => {
  return STANDARD_LAYER_NAMES[layer] || layer;
};
