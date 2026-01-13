import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { defineConfig, ConfigValidationError } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testDir = join(process.cwd(), 'tests', 'fixtures');

describe('defineConfig', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('validates and returns typed config from object source', async () => {
    const schema = z.object({
      server: z.object({
        host: z.string().default('localhost'),
        port: z.number().default(3000),
      }),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'object', data: { server: { port: 8080 } } },
      ],
    });

    expect(config.get('server.host')).toBe('localhost');
    expect(config.get('server.port')).toBe(8080);
  });

  it('loads config from JSON file', async () => {
    const configFile = join(testDir, 'config.json');
    writeFileSync(configFile, JSON.stringify({
      database: { url: 'postgres://localhost/test' },
    }));

    const schema = z.object({
      database: z.object({
        url: z.string(),
      }),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'file', path: configFile },
      ],
    });

    expect(config.get('database.url')).toBe('postgres://localhost/test');
  });

  it('loads config from environment variables', async () => {
    vi.stubEnv('APP_SERVER__PORT', '9000');
    vi.stubEnv('APP_DEBUG', 'true');

    const schema = z.object({
      server: z.object({
        port: z.number().default(3000),
      }),
      debug: z.boolean().default(false),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'env', prefix: 'APP_' },
      ],
    });

    expect(config.get('server.port')).toBe(9000);
    expect(config.get('debug')).toBe(true);
  });

  it('merges multiple sources with later taking precedence', async () => {
    const configFile = join(testDir, 'base.json');
    writeFileSync(configFile, JSON.stringify({
      server: { host: 'file-host', port: 3000 },
    }));

    vi.stubEnv('APP_SERVER__PORT', '8080');

    const schema = z.object({
      server: z.object({
        host: z.string(),
        port: z.number(),
      }),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'file', path: configFile },
        { type: 'env', prefix: 'APP_' },
      ],
    });

    expect(config.get('server.host')).toBe('file-host');
    expect(config.get('server.port')).toBe(8080);
  });

  it('throws ConfigValidationError on invalid config', async () => {
    const schema = z.object({
      port: z.number().min(1).max(65535),
    });

    await expect(
      defineConfig({
        schema,
        sources: [
          { type: 'object', data: { port: 'not-a-number' } },
        ],
      })
    ).rejects.toThrow(ConfigValidationError);
  });

  it('handles optional files gracefully', async () => {
    const schema = z.object({
      value: z.string().default('default'),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'file', path: './nonexistent.json', optional: true },
      ],
    });

    expect(config.get('value')).toBe('default');
  });

  it('supports profile-based configuration', async () => {
    const schema = z.object({
      debug: z.boolean().default(false),
      apiUrl: z.string(),
    });

    const config = await defineConfig({
      schema,
      profiles: {
        development: {
          defaults: { debug: true },
          sources: [
            { type: 'object', data: { apiUrl: 'http://localhost:3000' } },
          ],
        },
        production: {
          sources: [
            { type: 'object', data: { apiUrl: 'https://api.example.com' } },
          ],
        },
      },
      profile: 'development',
    });

    expect(config.get('debug')).toBe(true);
    expect(config.get('apiUrl')).toBe('http://localhost:3000');
  });

  it('getAll returns the full config object', async () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'object', data: { a: 'hello', b: 42 } },
      ],
    });

    const all = config.getAll();
    expect(all).toEqual({ a: 'hello', b: 42 });
  });

  it('config is frozen and immutable', async () => {
    const schema = z.object({
      value: z.string(),
    });

    const config = await defineConfig({
      schema,
      sources: [
        { type: 'object', data: { value: 'test' } },
      ],
    });

    const all = config.getAll();
    expect(() => {
      (all as Record<string, unknown>).value = 'modified';
    }).toThrow();
  });
});
