/**
 * Parse .env file content into a flat key-value object
 */
export function parseDotenv(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Find the first = sign
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle escape sequences in double-quoted values
    if (trimmed.slice(eqIndex + 1).trim().startsWith('"')) {
      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Convert flat dotenv keys to nested object structure
 * Uses double underscore (__) as nesting separator
 */
export function dotenvToNested(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('__');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!.toLowerCase();
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1]!.toLowerCase();
    current[lastPart] = value;
  }

  return result;
}
