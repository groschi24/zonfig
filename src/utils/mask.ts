/**
 * Secrets masking utilities
 *
 * Auto-detects and masks sensitive values in configuration objects
 */

/**
 * Default patterns for detecting sensitive keys
 */
export const DEFAULT_SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /apikey/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /privatekey/i,
  /access[_-]?key/i,
  /accesskey/i,
  /bearer/i,
  /jwt/i,
  /session/i,
  /cookie/i,
  /encryption[_-]?key/i,
  /encryptionkey/i,
  /signing[_-]?key/i,
  /signingkey/i,
  /client[_-]?secret/i,
  /clientsecret/i,
  /connection[_-]?string/i,
  /connectionstring/i,
  /dsn/i,
];

/**
 * Default mask string
 */
export const DEFAULT_MASK = '********';

/**
 * Options for masking sensitive values
 */
export interface MaskOptions {
  /**
   * Custom patterns to match sensitive keys (in addition to defaults)
   */
  patterns?: RegExp[];

  /**
   * Replace default patterns instead of extending them
   */
  replacePatterns?: boolean;

  /**
   * Custom mask string (default: '********')
   */
  mask?: string;

  /**
   * Show partial value (e.g., first/last N characters)
   */
  showPartial?: {
    first?: number;
    last?: number;
  };

  /**
   * Additional keys to always mask (exact key name match)
   */
  additionalKeys?: string[];

  /**
   * Additional paths to always mask (dot-notation, e.g., "database.url")
   */
  additionalPaths?: string[];

  /**
   * Keys to exclude from masking (exact match)
   */
  excludeKeys?: string[];

  /**
   * Paths to exclude from masking (dot-notation)
   */
  excludePaths?: string[];
}

/**
 * Check if a key matches sensitive patterns
 */
export function isSensitiveKey(
  key: string,
  options: MaskOptions = {}
): boolean {
  const { patterns = [], replacePatterns = false, additionalKeys = [], excludeKeys = [] } = options;

  // Check exclusions first
  if (excludeKeys.includes(key)) {
    return false;
  }

  // Check additional keys
  if (additionalKeys.includes(key)) {
    return true;
  }

  // Get patterns to use
  const activePatterns = replacePatterns
    ? patterns
    : [...DEFAULT_SENSITIVE_PATTERNS, ...patterns];

  // Check if key matches any pattern
  return activePatterns.some((pattern) => pattern.test(key));
}

/**
 * Check if a path should be masked
 */
export function isSensitivePath(
  path: string,
  options: MaskOptions = {}
): boolean {
  const { additionalPaths = [], excludePaths = [] } = options;

  // Check exclusions first
  if (excludePaths.includes(path)) {
    return false;
  }

  // Check additional paths
  return additionalPaths.includes(path);
}

/**
 * Mask a single value
 */
export function maskValue(
  value: unknown,
  options: MaskOptions = {}
): unknown {
  const { mask = DEFAULT_MASK, showPartial } = options;

  if (value === null || value === undefined) {
    return value;
  }

  const strValue = String(value);

  if (showPartial) {
    const { first = 0, last = 0 } = showPartial;

    if (strValue.length <= first + last) {
      return mask;
    }

    const firstPart = first > 0 ? strValue.slice(0, first) : '';
    const lastPart = last > 0 ? strValue.slice(-last) : '';

    return `${firstPart}${mask}${lastPart}`;
  }

  return mask;
}

/**
 * Recursively mask sensitive values in an object
 */
export function maskObject<T extends Record<string, unknown>>(
  obj: T,
  options: MaskOptions = {}
): T {
  return processObject(obj, options, '') as T;
}

/**
 * Internal function to process objects recursively
 */
function processObject(
  obj: unknown,
  options: MaskOptions,
  currentPath: string
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      processObject(item, options, `${currentPath}[${index}]`)
    );
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    const { excludePaths = [] } = options;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;

      // Check if this specific path should be excluded from masking
      if (excludePaths.includes(fullPath)) {
        if (value !== null && typeof value === 'object') {
          result[key] = processObject(value, options, fullPath);
        } else {
          result[key] = value;
        }
      }
      // Check if this specific path should be masked
      else if (isSensitivePath(fullPath, options)) {
        if (value !== null && typeof value === 'object') {
          result[key] = processObject(value, options, fullPath);
        } else {
          result[key] = maskValue(value, options);
        }
      }
      // Check if the key name matches sensitive patterns
      else if (isSensitiveKey(key, options)) {
        // If the value is an object/array, recurse into it; otherwise mask it
        if (value !== null && typeof value === 'object') {
          result[key] = processObject(value, options, fullPath);
        } else {
          result[key] = maskValue(value, options);
        }
      } else if (value !== null && typeof value === 'object') {
        // Recurse into nested objects
        result[key] = processObject(value, options, fullPath);
      } else {
        // Keep as-is
        result[key] = value;
      }
    }

    return result;
  }

  return obj;
}

/**
 * Create a masked string representation of a value for logging
 */
export function maskForLog(
  key: string,
  value: unknown,
  options: MaskOptions = {}
): string {
  if (isSensitiveKey(key, options)) {
    return `${key}: ${maskValue(value, options)}`;
  }

  if (typeof value === 'object' && value !== null) {
    return `${key}: [Object]`;
  }

  return `${key}: ${value}`;
}

/**
 * Mask sensitive values in an error message
 */
export function maskErrorMessage(
  message: string,
  sensitiveValues: string[],
  mask: string = DEFAULT_MASK
): string {
  let masked = message;

  for (const value of sensitiveValues) {
    if (value && value.length > 0) {
      // Escape special regex characters
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      masked = masked.replace(new RegExp(escaped, 'g'), mask);
    }
  }

  return masked;
}

/**
 * Extract all sensitive values from a config object
 */
export function extractSensitiveValues(
  obj: Record<string, unknown>,
  options: MaskOptions = {}
): string[] {
  const values: string[] = [];

  function traverse(current: unknown, parentKey: string = ''): void {
    if (current === null || current === undefined) {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => traverse(item, parentKey));
      return;
    }

    if (typeof current === 'object') {
      for (const [k, v] of Object.entries(current)) {
        if (isSensitiveKey(k, options) && v !== null && v !== undefined) {
          // If value is a primitive, add it; if it's an object/array, recurse
          if (typeof v === 'object') {
            traverse(v, k);
          } else {
            values.push(String(v));
          }
        } else {
          traverse(v, k);
        }
      }
      return;
    }
  }

  traverse(obj);

  return values;
}
