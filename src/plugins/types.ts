import type { LoaderContext } from '../core/types.js';

/**
 * Plugin definition interface
 */
export interface Plugin<TOptions = Record<string, unknown>> {
  /**
   * Unique name for the plugin
   */
  name: string;

  /**
   * Load configuration from the plugin source
   */
  load(options: TOptions, context: LoaderContext): Promise<Record<string, unknown>>;
}

/**
 * Options for defining a plugin
 */
export interface DefinePluginOptions<TOptions = Record<string, unknown>> {
  name: string;
  load(options: TOptions, context: LoaderContext): Promise<Record<string, unknown>>;
}
