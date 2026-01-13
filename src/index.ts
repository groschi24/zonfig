// Re-export zod for convenience
export { z } from 'zod';

// Core
export { Config, defineConfig } from './core/config.js';
export type {
  ConfigOptions,
  Source,
  EnvSource,
  FileSource,
  ObjectSource,
  PluginSource,
  ProfileConfig,
  LoaderContext,
  PathsOf,
  ValueAt,
  DocFormat,
  DocOptions,
  // Watch mode types
  ConfigEvent,
  ConfigChangeEvent,
  ConfigErrorEvent,
  ConfigReloadEvent,
  ConfigEventListener,
  WatchOptions,
} from './core/types.js';

// Errors
export {
  ConfigValidationError,
  ConfigFileNotFoundError,
  ConfigParseError,
  PluginNotFoundError,
} from './errors/validation.js';

// Plugins
export {
  registerPlugin,
  definePlugin,
  getPlugin,
  hasPlugin,
  unregisterPlugin,
  getRegisteredPlugins,
  clearPlugins,
} from './plugins/index.js';
export type { Plugin, DefinePluginOptions } from './plugins/index.js';

// Documentation
export {
  generateDocs,
  generateMarkdown,
  generateEnvExample,
  toJsonSchema,
} from './documentation/index.js';

// Loaders (for advanced usage)
export { EnvLoader, FileLoader, BaseLoader } from './loaders/index.js';

// Utilities (for advanced usage)
export { deepMerge, getByPath, setByPath, deepFreeze } from './utils/deep-merge.js';
export { interpolate, hasInterpolation, CircularReferenceError } from './utils/interpolate.js';
export type { InterpolateOptions } from './utils/interpolate.js';
