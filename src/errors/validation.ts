import type { ZodError, ZodIssue } from 'zod';
import type { ValidationErrorDetail, ValueProvenance } from '../core/types.js';

/**
 * Configuration validation error with detailed formatting
 */
export class ConfigValidationError extends Error {
  public readonly errors: ValidationErrorDetail[];

  constructor(
    zodError: ZodError,
    provenance?: Map<string, ValueProvenance>
  ) {
    const errors = ConfigValidationError.parseZodError(zodError, provenance);
    const message = ConfigValidationError.formatMessage(errors);

    super(message);
    this.name = 'ConfigValidationError';
    this.errors = errors;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigValidationError);
    }
  }

  /**
   * Parse Zod error into structured error details
   */
  private static parseZodError(
    zodError: ZodError,
    provenance?: Map<string, ValueProvenance>
  ): ValidationErrorDetail[] {
    return zodError.issues.map((issue: ZodIssue) => {
      const path = issue.path.join('.');
      const prov = provenance?.get(path);

      const detail: ValidationErrorDetail = {
        path,
        message: issue.message,
      };

      const expected = this.getExpectedType(issue);
      if (expected !== undefined) detail.expected = expected;

      if ('received' in issue) detail.received = issue.received;

      if (prov?.source !== undefined) detail.source = prov.source;

      return detail;
    });
  }

  /**
   * Extract expected type from Zod issue
   */
  private static getExpectedType(issue: ZodIssue): string | undefined {
    if ('expected' in issue && typeof issue.expected === 'string') {
      return issue.expected;
    }
    return undefined;
  }

  /**
   * Format errors into a readable message
   */
  private static formatMessage(errors: ValidationErrorDetail[]): string {
    const lines = ['Configuration validation failed:', ''];

    for (const error of errors) {
      lines.push(`✗ ${error.path || '(root)'}`);
      lines.push(`  ${error.message}`);

      if (error.expected !== undefined) {
        lines.push(`  Expected: ${error.expected}`);
      }

      if (error.received !== undefined) {
        lines.push(`  Received: ${JSON.stringify(error.received)}`);
      }

      if (error.source) {
        lines.push(`  Source: ${error.source}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format errors as a structured string (alias for toString)
   */
  formatErrors(): string {
    return this.message;
  }

  /**
   * Get errors as JSON-serializable array
   */
  toJSON(): ValidationErrorDetail[] {
    return this.errors;
  }
}

/**
 * Error thrown when a required config file is not found
 */
export class ConfigFileNotFoundError extends Error {
  public readonly filePath: string;

  constructor(filePath: string) {
    super(`Configuration file not found: ${filePath}`);
    this.name = 'ConfigFileNotFoundError';
    this.filePath = filePath;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigFileNotFoundError);
    }
  }
}

/**
 * Error thrown when a config file has invalid syntax
 */
export class ConfigParseError extends Error {
  public readonly filePath: string;
  public readonly originalError: Error;

  constructor(filePath: string, originalError: Error) {
    super(`Failed to parse configuration file: ${filePath}\n${originalError.message}`);
    this.name = 'ConfigParseError';
    this.filePath = filePath;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigParseError);
    }
  }
}

/**
 * Error thrown when a plugin is not found
 */
export class PluginNotFoundError extends Error {
  public readonly pluginName: string;

  constructor(pluginName: string) {
    super(`Plugin not found: ${pluginName}. Make sure to register the plugin before using it.`);
    this.name = 'PluginNotFoundError';
    this.pluginName = pluginName;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginNotFoundError);
    }
  }
}
