import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { defineConfig, ConfigValidationError, encryptValue } from '../src/index.js';
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

  describe('auto-decryption', () => {
    const TEST_KEY = 'test-auto-decrypt-key-32chars-x';

    it('auto-decrypts values when decrypt option is true', async () => {
      const encryptedPassword = encryptValue('my-secret-password', TEST_KEY);

      vi.stubEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        database: z.object({
          host: z.string(),
          password: z.string(),
        }),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: { database: { host: 'localhost', password: encryptedPassword } } },
        ],
        decrypt: true,
      });

      expect(config.get('database.password')).toBe('my-secret-password');
      expect(config.get('database.host')).toBe('localhost');
    });

    it('auto-decrypts when decrypt config provides key', async () => {
      const encryptedPassword = encryptValue('secret123', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
        decrypt: { key: TEST_KEY },
      });

      expect(config.get('password')).toBe('secret123');
    });

    it('auto-decrypts from env key when decrypt is undefined and ZONFIG_ENCRYPTION_KEY is set', async () => {
      const encryptedPassword = encryptValue('auto-secret', TEST_KEY);

      vi.stubEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
      });

      expect(config.get('password')).toBe('auto-secret');
    });

    it('does not decrypt when decrypt is false', async () => {
      const encryptedPassword = encryptValue('should-stay-encrypted', TEST_KEY);

      vi.stubEnv('ZONFIG_ENCRYPTION_KEY', TEST_KEY);

      const schema = z.object({
        password: z.string(),
      });

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: { password: encryptedPassword } },
        ],
        decrypt: false,
      });

      // Password should still be encrypted
      expect(config.get('password')).toMatch(/^ENC\[AES256_GCM,/);
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

      const config = await defineConfig({
        schema,
        sources: [
          { type: 'object', data: {
            api: { token: encryptedToken },
            oauth: { clientSecret: encryptedSecret },
          } },
        ],
        decrypt: { key: TEST_KEY },
      });

      expect(config.get('api.token')).toBe('api-token-123');
      expect(config.get('oauth.clientSecret')).toBe('client-secret-456');
    });
  });
});
