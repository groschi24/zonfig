import type { z } from 'zod';
import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ConfigOptions,
  Source,
  LoaderContext,
  PathsOf,
  ValueAt,
  ValueProvenance,
  ConfigEvent,
  ConfigEventListener,
  WatchOptions,
  DecryptionConfig,
} from './types.js';
import { deepMerge, getByPath, deepFreeze } from '../utils/deep-merge.js';
import { interpolate } from '../utils/interpolate.js';
import { maskObject, type MaskOptions } from '../utils/mask.js';
import { decryptObject, hasEncryptedValues } from '../utils/encrypt.js';
import { ConfigValidationError } from '../errors/validation.js';
import { EnvLoader } from '../loaders/env.js';
import { FileLoader } from '../loaders/file.js';
import { getPlugin } from '../plugins/registry.js';
import { PluginNotFoundError } from '../errors/validation.js';

/**
 * Type-safe configuration container with watch support
 */
export class Config<TSchema extends z.ZodType, TData = z.infer<TSchema>> {
  private data: TData;
  private provenance: Map<string, ValueProvenance>;
  private readonly options: ConfigOptions<TSchema>;
  private readonly context: LoaderContext;
  private watchers: FSWatcher[] = [];
  private listeners: Set<ConfigEventListener<TData>> = new Set();
  private isWatching = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceDelay = 100;

  private constructor(
    data: TData,
    provenance: Map<string, ValueProvenance>,
    options: ConfigOptions<TSchema>,
    context: LoaderContext
  ) {
    this.data = deepFreeze(data as object) as TData;
    this.provenance = provenance;
    this.options = options;
    this.context = context;
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
   * Get the configuration with sensitive values masked
   * Safe for logging and debugging
   */
  getMasked(options: MaskOptions = {}): TData {
    return maskObject(this.data as Record<string, unknown>, options) as TData;
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
   * Start watching config files for changes
   */
  watch(options: WatchOptions = {}): void {
    if (this.isWatching) return;

    this.debounceDelay = options.debounce ?? 100;
    this.isWatching = true;

    // Get file paths to watch
    const filePaths = this.getWatchablePaths();

    for (const filePath of filePaths) {
      try {
        const watcher = fsWatch(filePath, (eventType) => {
          if (eventType === 'change') {
            this.scheduleReload();
          }
        });

        watcher.on('error', (error) => {
          this.emit({
            type: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
            source: filePath,
          });
        });

        this.watchers.push(watcher);
      } catch {
        // File might not exist (optional sources), ignore
      }
    }

    if (options.immediate) {
      this.reload().catch((error) => {
        this.emit({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }
  }

  /**
   * Stop watching config files
   */
  unwatch(): void {
    if (!this.isWatching) return;

    this.isWatching = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  /**
   * Add event listener
   */
  on(listener: ConfigEventListener<TData>): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: ConfigEventListener<TData>): void {
    this.listeners.delete(listener);
  }

  /**
   * Manually reload configuration
   */
  async reload(): Promise<void> {
    const oldData = this.data;

    try {
      const { data, provenance } = await loadConfig(this.options, this.context);

      // Find changed paths
      const changedPaths = this.findChangedPaths(oldData, data as TData);

      if (changedPaths.length > 0) {
        this.data = deepFreeze(data as object) as TData;
        this.provenance = provenance;

        this.emit({
          type: 'change',
          newData: this.data,
          oldData,
          changedPaths,
        });
      }

      this.emit({
        type: 'reload',
        data: this.data,
      });
    } catch (error) {
      this.emit({
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Check if currently watching
   */
  get watching(): boolean {
    return this.isWatching;
  }

  /**
   * Get file paths that can be watched
   */
  private getWatchablePaths(): string[] {
    const paths: string[] = [];
    const sources = this.getActiveSources();

    for (const source of sources) {
      if (source.type === 'file') {
        const filePath = resolve(this.context.cwd, source.path);
        paths.push(filePath);
      }
    }

    return paths;
  }

  /**
   * Get active sources based on profile
   */
  private getActiveSources(): Source[] {
    const { sources = [], profile = 'default', profiles } = this.options;

    if (profiles && profile in profiles) {
      const profileConfig = profiles[profile];
      if (profileConfig?.sources) {
        return profileConfig.sources;
      }
    }

    return sources;
  }

  /**
   * Schedule a debounced reload
   */
  private scheduleReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.reload().catch((error) => {
        this.emit({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }, this.debounceDelay);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ConfigEvent<TData>): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Find paths that changed between old and new data
   */
  private findChangedPaths(oldData: TData, newData: TData): string[] {
    const changed: string[] = [];

    function compare(
      oldObj: Record<string, unknown>,
      newObj: Record<string, unknown>,
      prefix: string = ''
    ): void {
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const oldVal = oldObj[key];
        const newVal = newObj[key];

        if (oldVal === newVal) continue;

        if (
          oldVal !== null &&
          newVal !== null &&
          typeof oldVal === 'object' &&
          typeof newVal === 'object' &&
          !Array.isArray(oldVal) &&
          !Array.isArray(newVal)
        ) {
          compare(
            oldVal as Record<string, unknown>,
            newVal as Record<string, unknown>,
            path
          );
        } else {
          changed.push(path);
        }
      }
    }

    compare(
      oldData as Record<string, unknown>,
      newData as Record<string, unknown>
    );

    return changed;
  }

  /**
   * Create a new Config instance from options
   */
  static async create<TSchema extends z.ZodType>(
    options: ConfigOptions<TSchema>
  ): Promise<Config<TSchema>> {
    const cwd = options.cwd ?? process.cwd();
    const profile = options.profile ?? 'default';

    const context: LoaderContext = {
      profile,
      cwd,
      env: process.env,
    };

    const { data, provenance } = await loadConfig(options, context);

    return new Config<TSchema>(
      data as z.infer<TSchema>,
      provenance,
      options,
      context
    );
  }
}

/**
 * Load configuration from all sources
 */
async function loadConfig<TSchema extends z.ZodType>(
  options: ConfigOptions<TSchema>,
  context: LoaderContext
): Promise<{ data: z.infer<TSchema>; provenance: Map<string, ValueProvenance> }> {
  const { schema, sources = [], profile = 'default', profiles } = options;

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

  // Interpolate variables (${VAR} syntax)
  const interpolated = interpolate(merged, {
    env: context.env as Record<string, string | undefined>,
  });

  // Decrypt encrypted values if enabled
  const decrypted = decryptConfig(interpolated, options.decrypt, context);

  // Track provenance
  const provenance = trackProvenance(loadedConfigs);

  // Validate with schema
  const result = schema.safeParse(decrypted);

  if (!result.success) {
    throw new ConfigValidationError(result.error, provenance);
  }

  return { data: result.data, provenance };
}

/**
 * Decrypt encrypted values in config if decryption is enabled
 */
function decryptConfig(
  config: Record<string, unknown>,
  decrypt: boolean | DecryptionConfig | undefined,
  context: LoaderContext
): Record<string, unknown> {
  // Check if there are any encrypted values
  if (!hasEncryptedValues(config)) {
    return config;
  }

  // Determine if decryption should happen
  let key: string | undefined;

  if (decrypt === false) {
    // Explicitly disabled
    return config;
  } else if (decrypt === true) {
    // Use env var
    key = context.env.ZONFIG_ENCRYPTION_KEY;
  } else if (typeof decrypt === 'object') {
    // Check enabled flag
    if (decrypt.enabled === false) {
      return config;
    }
    key = decrypt.key ?? context.env.ZONFIG_ENCRYPTION_KEY;
  } else {
    // decrypt is undefined - auto-detect from env
    key = context.env.ZONFIG_ENCRYPTION_KEY;
  }

  // If no key available, return config as-is (encrypted values will fail validation)
  if (!key) {
    return config;
  }

  // Decrypt all encrypted values
  return decryptObject(config, { key });
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
