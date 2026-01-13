import type { LoaderContext } from '../core/types.js';
import { setByPath } from '../utils/deep-merge.js';
import { BaseLoader } from './base.js';

/**
 * Options for environment variable loading
 */
export interface EnvLoaderOptions {
  prefix?: string;
  separator?: string;
}

/**
 * Convert environment variable key to nested object path
 * APP_SERVER__HOST -> server.host
 * Double underscore (__) = nesting
 * Single underscore after prefix = camelCase conversion
 */
function envKeyToPath(key: string, prefix: string): string {
  const withoutPrefix = key.slice(prefix.length);

  return withoutPrefix
    .toLowerCase()
    .split('__')
    .map((part) =>
      part.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
    )
    .join('.');
}

/**
 * Attempt to coerce string values to their likely types
 */
function coerceValue(value: string): unknown {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number
  if (/^-?\d+$/.test(value)) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num.toString() === value) return num;
  }
  if (/^-?\d*\.\d+$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }

  // JSON array or object
  if ((value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      // Keep as string
    }
  }

  return value;
}

/**
 * Loader for environment variables
 */
export class EnvLoader extends BaseLoader<EnvLoaderOptions> {
  readonly name = 'env';

  async load(
    options: EnvLoaderOptions,
    context: LoaderContext
  ): Promise<Record<string, unknown>> {
    const { prefix = '' } = options;
    const result: Record<string, unknown> = {};
    const upperPrefix = prefix.toUpperCase();

    for (const [key, value] of Object.entries(context.env)) {
      if (value === undefined) continue;

      // Check if key starts with prefix
      if (upperPrefix && !key.toUpperCase().startsWith(upperPrefix)) {
        continue;
      }

      const path = envKeyToPath(key, upperPrefix);
      if (path) {
        setByPath(result, path, coerceValue(value));
      }
    }

    return result;
  }
}

/**
 * Create source metadata string for env vars
 */
export function formatEnvSource(key: string): string {
  return `environment variable ${key}`;
}
