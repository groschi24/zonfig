import { describe, it, expect } from 'vitest';
import { interpolate, hasInterpolation, CircularReferenceError } from '../src/utils/interpolate.js';

describe('Variable Interpolation', () => {
  describe('interpolate', () => {
    it('interpolates environment variables', () => {
      const config = {
        database: {
          url: 'postgres://${DB_HOST}:${DB_PORT}/mydb',
        },
      };

      const result = interpolate(config, {
        env: { DB_HOST: 'localhost', DB_PORT: '5432' },
      });

      expect(result.database.url).toBe('postgres://localhost:5432/mydb');
    });

    it('interpolates config references', () => {
      const config = {
        server: {
          host: 'localhost',
          port: 3000,
        },
        api: {
          url: 'http://${server.host}:${server.port}/api',
        },
      };

      const result = interpolate(config);

      expect(result.api.url).toBe('http://localhost:3000/api');
    });

    it('interpolates mixed env vars and config refs', () => {
      const config = {
        app: {
          name: 'myapp',
        },
        database: {
          url: 'postgres://${DB_HOST}/${app.name}',
        },
      };

      const result = interpolate(config, {
        env: { DB_HOST: 'db.example.com' },
      });

      expect(result.database.url).toBe('postgres://db.example.com/myapp');
    });

    it('handles recursive interpolation', () => {
      const config = {
        base: '${API_HOST}',
        versioned: '${base}/v2',
        endpoint: '${versioned}/users',
      };

      const result = interpolate(config, {
        env: { API_HOST: 'api.example.com' },
      });

      expect(result.base).toBe('api.example.com');
      expect(result.versioned).toBe('api.example.com/v2');
      expect(result.endpoint).toBe('api.example.com/v2/users');
    });

    it('detects circular references', () => {
      const config = {
        a: '${b}',
        b: '${a}',
      };

      expect(() => interpolate(config)).toThrow(CircularReferenceError);
    });

    it('detects longer circular reference chains', () => {
      const config = {
        a: '${b}',
        b: '${c}',
        c: '${a}',
      };

      expect(() => interpolate(config)).toThrow(CircularReferenceError);
    });

    it('handles undefined variables as empty string', () => {
      const config = {
        value: 'prefix-${UNDEFINED_VAR}-suffix',
      };

      const result = interpolate(config, { env: {} });

      expect(result.value).toBe('prefix--suffix');
    });

    it('handles arrays with interpolation', () => {
      const config = {
        servers: [
          { host: '${PRIMARY_HOST}', port: 3000 },
          { host: '${SECONDARY_HOST}', port: 3001 },
        ],
        urls: ['https://${API_HOST}/v1', 'https://${API_HOST}/v2'],
      };

      const result = interpolate(config, {
        env: {
          PRIMARY_HOST: 'primary.example.com',
          SECONDARY_HOST: 'secondary.example.com',
          API_HOST: 'api.example.com',
        },
      });

      expect(result.servers[0].host).toBe('primary.example.com');
      expect(result.servers[1].host).toBe('secondary.example.com');
      expect(result.urls[0]).toBe('https://api.example.com/v1');
      expect(result.urls[1]).toBe('https://api.example.com/v2');
    });

    it('preserves non-string values', () => {
      const config = {
        port: 3000,
        debug: true,
        tags: ['web', 'api'],
        nested: {
          value: 42,
        },
      };

      const result = interpolate(config);

      expect(result.port).toBe(3000);
      expect(result.debug).toBe(true);
      expect(result.tags).toEqual(['web', 'api']);
      expect(result.nested.value).toBe(42);
    });

    it('handles strings without interpolation', () => {
      const config = {
        simple: 'no variables here',
        nested: {
          value: 'also plain text',
        },
      };

      const result = interpolate(config);

      expect(result.simple).toBe('no variables here');
      expect(result.nested.value).toBe('also plain text');
    });

    it('handles multiple variables in one string', () => {
      const config = {
        url: '${PROTOCOL}://${HOST}:${PORT}/${PATH}',
      };

      const result = interpolate(config, {
        env: {
          PROTOCOL: 'https',
          HOST: 'example.com',
          PORT: '443',
          PATH: 'api/v1',
        },
      });

      expect(result.url).toBe('https://example.com:443/api/v1');
    });

    it('handles deeply nested config references', () => {
      const config = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
        reference: '${level1.level2.level3.value}-suffix',
      };

      const result = interpolate(config);

      expect(result.reference).toBe('deep-suffix');
    });

    it('stringifies non-string config references', () => {
      const config = {
        port: 3000,
        display: 'Port: ${port}',
      };

      const result = interpolate(config);

      expect(result.display).toBe('Port: 3000');
    });

    it('handles null values in config', () => {
      const config = {
        nullable: null,
        reference: 'prefix-${nullable}',
      };

      const result = interpolate(config);

      expect(result.nullable).toBe(null);
    });

    it('respects maxDepth option', () => {
      const config = {
        a: '${b}',
        b: '${c}',
        c: '${d}',
        d: '${e}',
        e: '${f}',
        f: '${g}',
        g: '${h}',
        h: '${i}',
        i: '${j}',
        j: '${k}',
        k: '${l}',
        l: 'end',
      };

      // Should work with default maxDepth of 10
      const result = interpolate(config);
      expect(result.a).toBe('end');

      // Should fail with lower maxDepth
      expect(() => interpolate(config, { maxDepth: 5 })).toThrow(/Maximum interpolation depth/);
    });

    it('handles whitespace in variable names', () => {
      const config = {
        value: '${ HOST }',
      };

      const result = interpolate(config, {
        env: { HOST: 'example.com' },
      });

      expect(result.value).toBe('example.com');
    });
  });

  describe('hasInterpolation', () => {
    it('detects interpolation syntax', () => {
      expect(hasInterpolation('${VAR}')).toBe(true);
      expect(hasInterpolation('prefix-${VAR}-suffix')).toBe(true);
      expect(hasInterpolation('${a}${b}')).toBe(true);
    });

    it('returns false for plain strings', () => {
      expect(hasInterpolation('no variables')).toBe(false);
      expect(hasInterpolation('$VAR')).toBe(false);
      expect(hasInterpolation('{VAR}')).toBe(false);
    });
  });

  describe('CircularReferenceError', () => {
    it('includes the reference path', () => {
      const config = {
        a: '${b}',
        b: '${a}',
      };

      try {
        interpolate(config);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CircularReferenceError);
        expect((err as CircularReferenceError).path).toContain('a');
        expect((err as CircularReferenceError).path).toContain('b');
      }
    });
  });
});
