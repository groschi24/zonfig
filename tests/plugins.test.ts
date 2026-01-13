import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  defineConfig,
  definePlugin,
  registerPlugin,
  getPlugin,
  hasPlugin,
  unregisterPlugin,
  clearPlugins,
  PluginNotFoundError,
} from '../src/index.js';

describe('Plugin System', () => {
  beforeEach(() => {
    clearPlugins();
  });

  describe('definePlugin', () => {
    it('creates a plugin with name and load function', () => {
      const plugin = definePlugin({
        name: 'test-plugin',
        load: async () => ({ value: 'from-plugin' }),
      });

      expect(plugin.name).toBe('test-plugin');
      expect(typeof plugin.load).toBe('function');
    });
  });

  describe('registerPlugin', () => {
    it('registers a plugin that can be retrieved', () => {
      const plugin = definePlugin({
        name: 'my-plugin',
        load: async () => ({}),
      });

      registerPlugin(plugin);

      expect(hasPlugin('my-plugin')).toBe(true);
      expect(getPlugin('my-plugin')).toBe(plugin);
    });

    it('allows re-registration (with warning)', () => {
      const plugin1 = definePlugin({
        name: 'duplicate',
        load: async () => ({ version: 1 }),
      });

      const plugin2 = definePlugin({
        name: 'duplicate',
        load: async () => ({ version: 2 }),
      });

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      expect(getPlugin('duplicate')).toBe(plugin2);
    });
  });

  describe('unregisterPlugin', () => {
    it('removes a registered plugin', () => {
      const plugin = definePlugin({
        name: 'removable',
        load: async () => ({}),
      });

      registerPlugin(plugin);
      expect(hasPlugin('removable')).toBe(true);

      const removed = unregisterPlugin('removable');
      expect(removed).toBe(true);
      expect(hasPlugin('removable')).toBe(false);
    });

    it('returns false for non-existent plugin', () => {
      const removed = unregisterPlugin('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('using plugins with defineConfig', () => {
    it('loads config from a registered plugin', async () => {
      const secretsPlugin = definePlugin({
        name: 'mock-secrets',
        load: async (options: { secretId: string }) => ({
          apiKey: `secret-${options.secretId}`,
          dbPassword: 'super-secret',
        }),
      });

      registerPlugin(secretsPlugin);

      const schema = z.object({
        apiKey: z.string(),
        dbPassword: z.string(),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'plugin', name: 'mock-secrets', options: { secretId: '123' } },
        ],
      });

      expect(config.get('apiKey')).toBe('secret-123');
      expect(config.get('dbPassword')).toBe('super-secret');
    });

    it('throws PluginNotFoundError for unregistered plugin', async () => {
      const schema = z.object({
        value: z.string(),
      });

      await expect(
        defineConfig({
          schema,
          sources: [
            { type: 'plugin', name: 'nonexistent-plugin' },
          ],
        })
      ).rejects.toThrow(PluginNotFoundError);
    });

    it('merges plugin config with other sources', async () => {
      const plugin = definePlugin({
        name: 'partial-config',
        load: async () => ({
          server: { host: 'plugin-host' },
        }),
      });

      registerPlugin(plugin);

      const schema = z.object({
        server: z.object({
          host: z.string(),
          port: z.number(),
        }),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: { server: { port: 3000 } } },
          { type: 'plugin', name: 'partial-config' },
        ],
      });

      expect(config.get('server.host')).toBe('plugin-host');
      expect(config.get('server.port')).toBe(3000);
    });
  });
});
