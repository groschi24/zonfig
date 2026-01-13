import type { z } from 'zod';

/**
 * Extract all possible dot-notation paths from a type
 */
export type PathsOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? PathsOf<T[K], `${Prefix}${Prefix extends '' ? '' : '.'}${K}`> | `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
        : `${Prefix}${Prefix extends '' ? '' : '.'}${K}`;
    }[keyof T & string]
  : never;

/**
 * Get the value type at a specific dot-notation path
 */
export type ValueAt<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? ValueAt<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Source types for configuration loading
 */
export type SourceType = 'env' | 'file' | 'object' | 'plugin';

/**
 * Base source configuration
 */
export interface BaseSource {
  type: SourceType;
  optional?: boolean;
}

/**
 * Environment variable source
 */
export interface EnvSource extends BaseSource {
  type: 'env';
  prefix?: string;
  separator?: string;
}

/**
 * File source (JSON, YAML, .env)
 */
export interface FileSource extends BaseSource {
  type: 'file';
  path: string;
  format?: 'json' | 'yaml' | 'dotenv' | 'auto';
}

/**
 * Plain object source
 */
export interface ObjectSource extends BaseSource {
  type: 'object';
  data: Record<string, unknown>;
}

/**
 * Plugin source
 */
export interface PluginSource extends BaseSource {
  type: 'plugin';
  name: string;
  options?: Record<string, unknown>;
}

/**
 * Union of all source types
 */
export type Source = EnvSource | FileSource | ObjectSource | PluginSource;

/**
 * Context passed to loaders
 */
export interface LoaderContext {
  profile: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Loader interface
 */
export interface Loader<TOptions = unknown> {
  name: string;
  load(options: TOptions, context: LoaderContext): Promise<Record<string, unknown>>;
}

/**
 * Track where each config value came from
 */
export interface ValueProvenance {
  path: string;
  value: unknown;
  source: string;
  loader: string;
}

/**
 * Profile-specific configuration
 */
export interface ProfileConfig {
  sources?: Source[];
  defaults?: Record<string, unknown>;
}

/**
 * Main configuration options
 */
export interface ConfigOptions<TSchema extends z.ZodType> {
  schema: TSchema;
  sources?: Source[];
  profile?: string;
  profiles?: Record<string, ProfileConfig>;
  cwd?: string;
}

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  expected?: string;
  received?: unknown;
  source?: string;
}

/**
 * Plugin definition
 */
export interface PluginDefinition<TOptions = Record<string, unknown>> {
  name: string;
  load(options: TOptions, context: LoaderContext): Promise<Record<string, unknown>>;
}

/**
 * Schema metadata for documentation
 */
export interface SchemaFieldMeta {
  env?: string;
  description?: string;
  examples?: unknown[];
  sensitive?: boolean;
  required?: boolean;
  default?: unknown;
}

/**
 * Documentation output format
 */
export type DocFormat = 'markdown' | 'json-schema' | 'env-example';

/**
 * Documentation generator options
 */
export interface DocOptions {
  format: DocFormat;
  includeDefaults?: boolean;
  includeSensitive?: boolean;
}
