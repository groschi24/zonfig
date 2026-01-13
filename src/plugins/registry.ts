import type { Plugin, DefinePluginOptions } from './types.js';

/**
 * Global plugin registry
 */
const plugins = new Map<string, Plugin>();

/**
 * Register a plugin for use in configuration loading
 */
export function registerPlugin<TOptions = Record<string, unknown>>(
  plugin: Plugin<TOptions>
): void {
  if (plugins.has(plugin.name)) {
    console.warn(`Plugin "${plugin.name}" is being re-registered. Previous registration will be overwritten.`);
  }
  plugins.set(plugin.name, plugin as Plugin);
}

/**
 * Get a registered plugin by name
 */
export function getPlugin(name: string): Plugin | undefined {
  return plugins.get(name);
}

/**
 * Check if a plugin is registered
 */
export function hasPlugin(name: string): boolean {
  return plugins.has(name);
}

/**
 * Unregister a plugin
 */
export function unregisterPlugin(name: string): boolean {
  return plugins.delete(name);
}

/**
 * Get all registered plugin names
 */
export function getRegisteredPlugins(): string[] {
  return Array.from(plugins.keys());
}

/**
 * Clear all registered plugins (useful for testing)
 */
export function clearPlugins(): void {
  plugins.clear();
}

/**
 * Helper to define a plugin with type safety
 */
export function definePlugin<TOptions = Record<string, unknown>>(
  options: DefinePluginOptions<TOptions>
): Plugin<TOptions> {
  return {
    name: options.name,
    load: options.load,
  };
}
