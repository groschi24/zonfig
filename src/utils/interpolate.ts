import { getByPath } from './deep-merge.js';

/**
 * Pattern to match ${VAR} or ${path.to.value} syntax
 */
const INTERPOLATION_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Options for interpolation
 */
export interface InterpolateOptions {
  /** Environment variables */
  env?: Record<string, string | undefined>;
  /** Maximum recursion depth (default: 10) */
  maxDepth?: number;
}

/**
 * Error thrown when circular reference is detected
 */
export class CircularReferenceError extends Error {
  public readonly path: string[];

  constructor(path: string[]) {
    super(`Circular reference detected: ${path.join(' -> ')}`);
    this.name = 'CircularReferenceError';
    this.path = path;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircularReferenceError);
    }
  }
}

/**
 * Interpolate variables in a string value
 * Supports:
 * - ${ENV_VAR} - environment variable
 * - ${config.path} - reference to config value (if starts with lowercase and contains dot)
 * - ${path} - tries env first, then config
 */
function interpolateString(
  value: string,
  config: Record<string, unknown>,
  env: Record<string, string | undefined>,
  visiting: Set<string>,
  depth: number,
  maxDepth: number
): string {
  if (depth > maxDepth) {
    throw new Error(`Maximum interpolation depth (${maxDepth}) exceeded`);
  }

  return value.replace(INTERPOLATION_PATTERN, (_match, key: string) => {
    const trimmedKey = key.trim();

    // Check for circular reference
    if (visiting.has(trimmedKey)) {
      throw new CircularReferenceError([...visiting, trimmedKey]);
    }

    let resolved: unknown;

    // Try environment variable first (uppercase or has underscore)
    if (trimmedKey === trimmedKey.toUpperCase() || trimmedKey.includes('_')) {
      resolved = env[trimmedKey];
    }

    // If not found in env, try config path (contains dot or not all uppercase)
    if (resolved === undefined && trimmedKey.includes('.')) {
      resolved = getByPath(config, trimmedKey);
    }

    // Fallback: try both
    if (resolved === undefined) {
      // Try env first
      resolved = env[trimmedKey];
      // Then try config
      if (resolved === undefined) {
        resolved = getByPath(config, trimmedKey);
      }
    }

    // If still undefined, return empty string or keep the original
    if (resolved === undefined) {
      return '';
    }

    // Convert to string
    const stringValue = typeof resolved === 'string'
      ? resolved
      : JSON.stringify(resolved);

    // Recursively interpolate if the resolved value contains variables
    if (stringValue.includes('${')) {
      visiting.add(trimmedKey);
      const result = interpolateString(stringValue, config, env, visiting, depth + 1, maxDepth);
      visiting.delete(trimmedKey);
      return result;
    }

    return stringValue;
  });
}

/**
 * Recursively interpolate all string values in an object
 */
function interpolateObject(
  obj: Record<string, unknown>,
  rootConfig: Record<string, unknown>,
  env: Record<string, string | undefined>,
  visiting: Set<string>,
  depth: number,
  maxDepth: number,
  currentPath: string = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = currentPath ? `${currentPath}.${key}` : key;

    if (typeof value === 'string') {
      if (value.includes('${')) {
        visiting.add(path);
        result[key] = interpolateString(value, rootConfig, env, visiting, depth, maxDepth);
        visiting.delete(path);
      } else {
        result[key] = value;
      }
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = interpolateObject(
        value as Record<string, unknown>,
        rootConfig,
        env,
        visiting,
        depth,
        maxDepth,
        path
      );
    } else if (Array.isArray(value)) {
      result[key] = value.map((item, index) => {
        if (typeof item === 'string' && item.includes('${')) {
          const itemPath = `${path}[${index}]`;
          visiting.add(itemPath);
          const interpolated = interpolateString(item, rootConfig, env, visiting, depth, maxDepth);
          visiting.delete(itemPath);
          return interpolated;
        } else if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          return interpolateObject(
            item as Record<string, unknown>,
            rootConfig,
            env,
            visiting,
            depth,
            maxDepth,
            `${path}[${index}]`
          );
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Interpolate variables in a configuration object
 *
 * Supports:
 * - `${ENV_VAR}` - environment variable (uppercase)
 * - `${config.path}` - reference to another config value
 * - Recursive resolution with cycle detection
 *
 * @example
 * ```typescript
 * const config = {
 *   host: 'localhost',
 *   port: 5432,
 *   database: {
 *     url: 'postgres://${host}:${port}/mydb',
 *     password: '${DB_PASSWORD}'
 *   }
 * };
 *
 * const interpolated = interpolate(config, { env: process.env });
 * // database.url = 'postgres://localhost:5432/mydb'
 * ```
 */
export function interpolate(
  config: Record<string, unknown>,
  options: InterpolateOptions = {}
): Record<string, unknown> {
  const env = options.env ?? {};
  const maxDepth = options.maxDepth ?? 10;

  return interpolateObject(config, config, env, new Set(), 0, maxDepth);
}

/**
 * Check if a string contains interpolation syntax
 */
export function hasInterpolation(value: string): boolean {
  return /\$\{[^}]+\}/.test(value);
}
