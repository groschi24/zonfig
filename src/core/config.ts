import type { z } from 'zod';
import type {
  ConfigOptions,
  Source,
  LoaderContext,
  PathsOf,
  ValueAt,
  ValueProvenance,
} from './types.js';
import { deepMerge, getByPath, deepFreeze } from '../utils/deep-merge.js';
import { ConfigValidationError } from '../errors/validation.js';
import { EnvLoader } from '../loaders/env.js';
import { FileLoader } from '../loaders/file.js';
import { getPlugin } from '../plugins/registry.js';
import { PluginNotFoundError } from '../errors/validation.js';

/**
 * Type-safe configuration container
 */
export class Config<TSchema extends z.ZodType, TData = z.infer<TSchema>> {
  private readonly data: TData;
  private readonly provenance: Map<string, ValueProvenance>;

  private constructor(data: TData, provenance: Map<string, ValueProvenance>) {
    this.data = deepFreeze(data as object) as TData;
    this.provenance = provenance;
  }

  /**
   * Get a configuration value by dot-notation path
   */
  get<P extends PathsOf<TData>>(path: P): ValueAt<TData, P> {
    return getByPath(this.data as Record<string, unknown>, path) as ValueAt<TData, P>;
  }

  /**
   * Get the entire configuration object
   */
  getAll(): Readonly<TData> {
    return this.data;
  }

  /**
   * Check if a path exists in the configuration
   */
  has(path: string): boolean {
    return getByPath(this.data as Record<string, unknown>, path) !== undefined;
  }

  /**
   * Get the source of a configuration value
   */
  getSource(path: string): string | undefined {
    return this.provenance.get(path)?.source;
  }

  /**
   * Create a new Config instance from options
   */
  static async create<TSchema extends z.ZodType>(
    options: ConfigOptions<TSchema>
  ): Promise<Config<TSchema>> {
    const {
      schema,
      sources = [],
      profile = 'default',
      profiles,
      cwd = process.cwd(),
    } = options;

    // Determine which sources to use
    let activeSources = sources;
    let defaults: Record<string, unknown> = {};

    if (profiles && profile in profiles) {
      const profileConfig = profiles[profile];
      if (profileConfig?.sources) {
        activeSources = profileConfig.sources;
      }
      if (profileConfig?.defaults) {
        defaults = profileConfig.defaults;
      }
    }

    // Create loader context
    const context: LoaderContext = {
      profile,
      cwd,
      env: process.env,
    };

    // Load all sources
    const loadedConfigs: Array<{ data: Record<string, unknown>; source: string }> = [];

    // Add defaults first
    if (Object.keys(defaults).length > 0) {
      loadedConfigs.push({ data: defaults, source: 'profile defaults' });
    }

    // Load each source
    for (const source of activeSources) {
      const data = await loadSource(source, context);
      if (data && Object.keys(data).length > 0) {
        loadedConfigs.push({ data, source: formatSourceName(source) });
      }
    }

    // Merge all configs (later sources override earlier)
    const merged = deepMerge<Record<string, unknown>>(
      ...loadedConfigs.map((c) => c.data)
    );

    // Track provenance
    const provenance = trackProvenance(loadedConfigs);

    // Validate with schema
    const result = schema.safeParse(merged);

    if (!result.success) {
      throw new ConfigValidationError(result.error, provenance);
    }

    return new Config<TSchema>(result.data as z.infer<TSchema>, provenance);
  }
}

/**
 * Load configuration from a source
 */
async function loadSource(
  source: Source,
  context: LoaderContext
): Promise<Record<string, unknown>> {
  switch (source.type) {
    case 'env': {
      const loader = new EnvLoader();
      const options: { prefix?: string; separator?: string } = {};
      if (source.prefix !== undefined) options.prefix = source.prefix;
      if (source.separator !== undefined) options.separator = source.separator;
      return loader.load(options, context);
    }

    case 'file': {
      const loader = new FileLoader();
      const options: {
        path: string;
        format?: 'json' | 'yaml' | 'dotenv' | 'auto';
        optional?: boolean;
      } = { path: source.path };
      if (source.format !== undefined) options.format = source.format;
      if (source.optional !== undefined) options.optional = source.optional;
      return loader.load(options, context);
    }

    case 'object': {
      return source.data;
    }

    case 'plugin': {
      const plugin = getPlugin(source.name);
      if (!plugin) {
        throw new PluginNotFoundError(source.name);
      }
      return plugin.load(source.options ?? {}, context);
    }

    default:
      return {};
  }
}

/**
 * Format source name for error messages
 */
function formatSourceName(source: Source): string {
  switch (source.type) {
    case 'env':
      return source.prefix
        ? `environment variables (${source.prefix}*)`
        : 'environment variables';
    case 'file':
      return `file: ${source.path}`;
    case 'object':
      return 'object';
    case 'plugin':
      return `plugin: ${source.name}`;
    default:
      return 'unknown';
  }
}

/**
 * Track which source each value came from
 */
function trackProvenance(
  configs: Array<{ data: Record<string, unknown>; source: string }>
): Map<string, ValueProvenance> {
  const provenance = new Map<string, ValueProvenance>();

  function traverse(
    obj: Record<string, unknown>,
    source: string,
    prefix: string = ''
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        traverse(value as Record<string, unknown>, source, path);
      } else {
        provenance.set(path, {
          path,
          value,
          source,
          loader: source.split(':')[0] ?? source,
        });
      }
    }
  }

  // Process in order (later sources override earlier)
  for (const config of configs) {
    traverse(config.data, config.source);
  }

  return provenance;
}

/**
 * Main entry point for creating typed configuration
 */
export async function defineConfig<TSchema extends z.ZodType>(
  options: ConfigOptions<TSchema>
): Promise<Config<TSchema>> {
  return Config.create(options);
}
