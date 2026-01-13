import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { LoaderContext } from '../core/types.js';
import { ConfigFileNotFoundError, ConfigParseError } from '../errors/validation.js';
import { BaseLoader } from './base.js';
import { parseDotenv } from './dotenv.js';

/**
 * Options for file loading
 */
export interface FileLoaderOptions {
  path: string;
  format?: 'json' | 'yaml' | 'dotenv' | 'auto';
  optional?: boolean;
}

/**
 * Detect file format from extension
 */
function detectFormat(filePath: string): 'json' | 'yaml' | 'dotenv' {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.env':
      return 'dotenv';
    default:
      // Default to JSON for unknown extensions
      return 'json';
  }
}

/**
 * Interpolate profile variable in file path
 */
function interpolatePath(path: string, profile: string): string {
  return path.replace(/\$\{PROFILE\}/gi, profile);
}

/**
 * Loader for JSON, YAML, and .env files
 */
export class FileLoader extends BaseLoader<FileLoaderOptions> {
  readonly name = 'file';

  async load(
    options: FileLoaderOptions,
    context: LoaderContext
  ): Promise<Record<string, unknown>> {
    const { format = 'auto', optional = false } = options;

    // Interpolate profile in path
    const interpolatedPath = interpolatePath(options.path, context.profile);

    // Resolve to absolute path
    const absolutePath = resolve(context.cwd, interpolatedPath);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      if (optional) {
        return {};
      }
      throw new ConfigFileNotFoundError(absolutePath);
    }

    // Read file content
    const content = await readFile(absolutePath, 'utf-8');

    // Determine format
    const fileFormat = format === 'auto' ? detectFormat(absolutePath) : format;

    // Parse based on format
    try {
      switch (fileFormat) {
        case 'json':
          return JSON.parse(content) as Record<string, unknown>;

        case 'yaml':
          return parseYaml(content) as Record<string, unknown>;

        case 'dotenv':
          return parseDotenv(content);

        default:
          throw new Error(`Unknown file format: ${fileFormat}`);
      }
    } catch (error) {
      if (error instanceof ConfigFileNotFoundError) {
        throw error;
      }
      throw new ConfigParseError(
        absolutePath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

/**
 * Create source metadata string for files
 */
export function formatFileSource(filePath: string): string {
  return `file: ${filePath}`;
}
