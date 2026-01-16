import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { defineConfig, ConfigValidationError, encryptValue } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testDir = join(process.cwd(), 'tests', 'fixtures');

// Track env vars we set so we can clean them up
const envVarsSet = new Set<string>();

function setEnv(key: string, value: string): void {
  envVarsSet.add(key);
  process.env[key] = value;
}

function clearEnvVars(): void {
  for (const key of envVarsSet) {
    delete process.env[key];
  }
  envVarsSet.clear();
}

describe('defineConfig', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    clearEnvVars();
  });

  it('does not load config until accessed', async () => {
    const schema = z.object({
      value: z.string().default('default'),
    });

    const config = defineConfig({
      schema,
      sources: [{ type: 'object', data: { value: 'loaded' } }],
    });

    // Config should not be loaded yet
    expect(config.isLoaded).toBe(false);

    // Now access it
    const value = await config.get('value');
    expect(value).toBe('loaded');
    expect(config.isLoaded).toBe(true);
  });

  it('validates and returns typed config from object source', async () => {
    const schema = z.object({
      server: z.object({
        host: z.string().default('localhost'),
        port: z.number().default(3000),
      }),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'object', data: { server: { port: 8080 } } },
      ],
    });

    expect(await config.get('server.host')).toBe('localhost');
    expect(await config.get('server.port')).toBe(8080);
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

    const config = defineConfig({
      schema,
      sources: [
        { type: 'file', path: configFile },
      ],
    });

    expect(await config.get('database.url')).toBe('postgres://localhost/test');
  });

  it('loads config from environment variables', async () => {
    setEnv('APP_SERVER__PORT', '9000');
    setEnv('APP_DEBUG', 'true');

    const schema = z.object({
      server: z.object({
        port: z.number().default(3000),
      }),
      debug: z.boolean().default(false),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'env', prefix: 'APP_' },
      ],
    });

    expect(await config.get('server.port')).toBe(9000);
    expect(await config.get('debug')).toBe(true);
  });

  it('merges multiple sources with later taking precedence', async () => {
    const configFile = join(testDir, 'base.json');
    writeFileSync(configFile, JSON.stringify({
      server: { host: 'file-host', port: 3000 },
    }));

    setEnv('APP_SERVER__PORT', '8080');

    const schema = z.object({
      server: z.object({
        host: z.string(),
        port: z.number(),
      }),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'file', path: configFile },
        { type: 'env', prefix: 'APP_' },
      ],
    });

    expect(await config.get('server.host')).toBe('file-host');
    expect(await config.get('server.port')).toBe(8080);
  });

  it('throws ConfigValidationError on invalid config', async () => {
    const schema = z.object({
      port: z.number().min(1).max(65535),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'object', data: { port: 'not-a-number' } },
      ],
    });

    await expect(config.load()).rejects.toThrow(ConfigValidationError);
  });

  it('handles optional files gracefully', async () => {
    const schema = z.object({
      value: z.string().default('default'),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'file', path: './nonexistent.json', optional: true },
      ],
    });

    expect(await config.get('value')).toBe('default');
  });

  it('supports profile-based configuration', async () => {
    const schema = z.object({
      debug: z.boolean().default(false),
      apiUrl: z.string(),
    });

    const config = defineConfig({
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

    expect(await config.get('debug')).toBe(true);
    expect(await config.get('apiUrl')).toBe('http://localhost:3000');
  });

  it('getAll returns the full config object', async () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'object', data: { a: 'hello', b: 42 } },
      ],
    });

    const all = await config.getAll();
    expect(all).toEqual({ a: 'hello', b: 42 });
  });

  it('config is frozen and immutable', async () => {
    const schema = z.object({
      value: z.string(),
    });

    const config = defineConfig({
      schema,
      sources: [
        { type: 'object', data: { value: 'test' } },
      ],
    });

    const all = await config.getAll();
    expect(() => {
      (all as Record<string, unknown>).value = 'modified';
    }).toThrow();
  });

  it('caches the config after first load', async () => {
    const schema = z.object({
      value: z.string(),
    });

    const config = defineConfig({
      schema,
      sources: [{ type: 'object', data: { value: 'cached' } }],
    });

    // Access multiple times
    await config.get('value');
    await config.get('value');
    const cfg1 = await config.load();
    const cfg2 = await config.load();

    // Should return the same instance
    expect(cfg1).toBe(cfg2);
  });

  it('handles concurrent access safely', async () => {
    const schema = z.object({
      value: z.string(),
    });

    const config = defineConfig({
      schema,
      sources: [{ type: 'object', data: { value: 'concurrent' } }],
    });

    // Access multiple times concurrently
    const [v1, v2, v3] = await Promise.all([
      config.get('value'),
      config.get('value'),
      config.get('value'),
    ]);

    expect(v1).toBe('concurrent');
    expect(v2).toBe('concurrent');
    expect(v3).toBe('concurrent');
  });

  it('reload() forces a fresh load', async () => {
    setEnv('LAZY_VALUE', 'initial');

    const schema = z.object({
      value: z.string().default('default'),
    });

    const config = defineConfig({
      schema,
      sources: [{ type: 'env', prefix: 'LAZY_' }],
    });

    expect(await config.get('value')).toBe('initial');

    // Change the env var
    setEnv('LAZY_VALUE', 'updated');

    // Reload should pick up the new value
    await config.reload();
    expect(await config.get('value')).toBe('updated');
  });

  it('reads environment variables at runtime, not at definition time', async () => {
    const schema = z.object({
      apiKey: z.string().default(''),
    });

    // Create config BEFORE setting env var
    const config = defineConfig({
      schema,
      sources: [{ type: 'env', prefix: 'RUNTIME_' }],
    });

    // Set env var AFTER creating config (simulates Coolify runtime injection)
    setEnv('RUNTIME_API_KEY', 'runtime-secret');

    // Now access - should pick up the env var
    expect(await config.get('apiKey')).toBe('runtime-secret');
  });

  describe('auto-decryption', () => {
    const TEST_KEY = 'test-auto-decrypt-key-32chars-x';

    it('auto-decrypts values when decrypt option is true', async () => {
      const encryptedPassword = encryptValue('my-secret-password', TEST_KEY);

      setEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        database: z.object({
          host: z.string(),
          password: z.string(),
        }),
      });

      const config = defineConfig({
        schema,
        sources: [
          { type: 'object', data: { database: { host: 'localhost', password: encryptedPassword } } },
        ],
        decrypt: true,
      });

      expect(await config.get('database.password')).toBe('my-secret-password');
      expect(await config.get('database.host')).toBe('localhost');
    });

    it('auto-decrypts when decrypt config provides key', async () => {
      const encryptedPassword = encryptValue('secret123', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
        decrypt: { key: TEST_KEY },
      });

      expect(await config.get('password')).toBe('secret123');
    });

    it('auto-decrypts from env key when decrypt is undefined and ZONFIG_ENCRYPTION_KEY is set', async () => {
      const encryptedPassword = encryptValue('auto-secret', TEST_KEY);

      setEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
      });

      expect(await config.get('password')).toBe('auto-secret');
    });

    it('does not decrypt when decrypt is false', async () => {
      const encryptedPassword = encryptValue('should-stay-encrypted', TEST_KEY);

      setEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
        decrypt: false,
      });

      // Password should still be encrypted
      expect(await config.get('password')).toMatch(/^ENC\[AES256_GCM,/);
    });

    it('handles nested encrypted values', async () => {
      const encryptedToken = encryptValue('api-token-123', TEST_KEY);
      const encryptedSecret = encryptValue('client-secret-456', TEST_KEY);

      const schema = z.object({
        api: z.object({
          token: z.string(),
        }),
        oauth: z.object({
          clientSecret: z.string(),
        }),
      });

      const config = defineConfig({
        schema,
        sources: [
          { type: 'object', data: {
            api: { token: encryptedToken },
            oauth: { clientSecret: encryptedSecret },
          } },
        ],
        decrypt: { key: TEST_KEY },
      });

      expect(await config.get('api.token')).toBe('api-token-123');
      expect(await config.get('oauth.clientSecret')).toBe('client-secret-456');
    });
  });
});
