import { describe, it, expect } from 'vitest';
import {
  maskObject,
  maskValue,
  maskForLog,
  maskErrorMessage,
  isSensitiveKey,
  isSensitivePath,
  extractSensitiveValues,
  DEFAULT_MASK,
  DEFAULT_SENSITIVE_PATTERNS,
} from '../src/utils/mask';

describe('isSensitiveKey', () => {
  it('should detect common sensitive keys', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('PASSWORD')).toBe(true);
    expect(isSensitiveKey('userPassword')).toBe(true);
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('API_SECRET')).toBe(true);
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('accessToken')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('API_KEY')).toBe(true);
    expect(isSensitiveKey('auth')).toBe(true);
    expect(isSensitiveKey('authToken')).toBe(true);
    expect(isSensitiveKey('credential')).toBe(true);
    expect(isSensitiveKey('privateKey')).toBe(true);
    expect(isSensitiveKey('private_key')).toBe(true);
    expect(isSensitiveKey('bearer')).toBe(true);
    expect(isSensitiveKey('jwt')).toBe(true);
    expect(isSensitiveKey('jwtSecret')).toBe(true);
    expect(isSensitiveKey('session')).toBe(true);
    expect(isSensitiveKey('sessionId')).toBe(true);
    expect(isSensitiveKey('cookie')).toBe(true);
    expect(isSensitiveKey('encryptionKey')).toBe(true);
    expect(isSensitiveKey('signingKey')).toBe(true);
    expect(isSensitiveKey('clientSecret')).toBe(true);
    expect(isSensitiveKey('client_secret')).toBe(true);
    expect(isSensitiveKey('connectionString')).toBe(true);
    expect(isSensitiveKey('dsn')).toBe(true);
  });

  it('should not detect non-sensitive keys', () => {
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('email')).toBe(false);
    expect(isSensitiveKey('host')).toBe(false);
    expect(isSensitiveKey('port')).toBe(false);
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('url')).toBe(false);
    expect(isSensitiveKey('endpoint')).toBe(false);
    expect(isSensitiveKey('timeout')).toBe(false);
  });

  it('should respect custom patterns', () => {
    expect(isSensitiveKey('myCustomSecret', { patterns: [/custom/i] })).toBe(true);
    expect(isSensitiveKey('internalKey', { patterns: [/internal/i] })).toBe(true);
  });

  it('should replace default patterns when specified', () => {
    expect(isSensitiveKey('password', { patterns: [/custom/i], replacePatterns: true })).toBe(false);
    expect(isSensitiveKey('custom', { patterns: [/custom/i], replacePatterns: true })).toBe(true);
  });

  it('should respect additional keys', () => {
    expect(isSensitiveKey('mySpecialKey', { additionalKeys: ['mySpecialKey'] })).toBe(true);
    expect(isSensitiveKey('debugToken', { additionalKeys: ['debugToken'] })).toBe(true);
  });

  it('should respect exclude keys', () => {
    expect(isSensitiveKey('password', { excludeKeys: ['password'] })).toBe(false);
    expect(isSensitiveKey('sessionTimeout', { excludeKeys: ['sessionTimeout'] })).toBe(false);
  });
});

describe('maskValue', () => {
  it('should mask value with default mask', () => {
    expect(maskValue('secret123')).toBe(DEFAULT_MASK);
    expect(maskValue('password')).toBe(DEFAULT_MASK);
  });

  it('should mask with custom mask string', () => {
    expect(maskValue('secret', { mask: '[REDACTED]' })).toBe('[REDACTED]');
    expect(maskValue('secret', { mask: '***' })).toBe('***');
  });

  it('should show partial values', () => {
    expect(maskValue('secret123', { showPartial: { first: 2 } })).toBe('se********');
    expect(maskValue('secret123', { showPartial: { last: 2 } })).toBe('********23');
    expect(maskValue('secret123', { showPartial: { first: 2, last: 2 } })).toBe('se********23');
  });

  it('should handle short values with partial display', () => {
    expect(maskValue('ab', { showPartial: { first: 2, last: 2 } })).toBe(DEFAULT_MASK);
    expect(maskValue('abc', { showPartial: { first: 2, last: 2 } })).toBe(DEFAULT_MASK);
  });

  it('should handle null and undefined', () => {
    expect(maskValue(null)).toBe(null);
    expect(maskValue(undefined)).toBe(undefined);
  });

  it('should convert non-string values', () => {
    expect(maskValue(12345)).toBe(DEFAULT_MASK);
    expect(maskValue(true)).toBe(DEFAULT_MASK);
  });
});

describe('maskObject', () => {
  it('should mask sensitive keys in flat object', () => {
    const obj = {
      username: 'admin',
      password: 'secret123',
      host: 'localhost',
    };
    const masked = maskObject(obj);
    expect(masked.username).toBe('admin');
    expect(masked.password).toBe(DEFAULT_MASK);
    expect(masked.host).toBe('localhost');
  });

  it('should mask sensitive keys in nested objects', () => {
    const obj = {
      database: {
        host: 'localhost',
        password: 'dbpass',
      },
      api: {
        endpoint: 'https://api.example.com',
        apiKey: 'key123',
      },
    };
    const masked = maskObject(obj);
    expect(masked.database.host).toBe('localhost');
    expect(masked.database.password).toBe(DEFAULT_MASK);
    expect(masked.api.endpoint).toBe('https://api.example.com');
    expect(masked.api.apiKey).toBe(DEFAULT_MASK);
  });

  it('should mask sensitive keys in arrays', () => {
    const obj = {
      users: [
        { name: 'Alice', password: 'pass1' },
        { name: 'Bob', password: 'pass2' },
      ],
    };
    const masked = maskObject(obj);
    expect(masked.users[0].name).toBe('Alice');
    expect(masked.users[0].password).toBe(DEFAULT_MASK);
    expect(masked.users[1].name).toBe('Bob');
    expect(masked.users[1].password).toBe(DEFAULT_MASK);
  });

  it('should handle deeply nested objects', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            secret: 'deep-secret',
            value: 'normal',
          },
        },
      },
    };
    const masked = maskObject(obj);
    expect(masked.level1.level2.level3.secret).toBe(DEFAULT_MASK);
    expect(masked.level1.level2.level3.value).toBe('normal');
  });

  it('should apply custom options', () => {
    const obj = {
      password: 'secret123',
      myKey: 'value',
    };
    const masked = maskObject(obj, {
      mask: '[HIDDEN]',
      additionalKeys: ['myKey'],
    });
    expect(masked.password).toBe('[HIDDEN]');
    expect(masked.myKey).toBe('[HIDDEN]');
  });

  it('should handle null and undefined values', () => {
    const obj = {
      password: null,
      secret: undefined,
      name: 'test',
    };
    const masked = maskObject(obj);
    expect(masked.password).toBe(null);
    expect(masked.secret).toBe(undefined);
    expect(masked.name).toBe('test');
  });

  it('should handle empty objects and arrays', () => {
    expect(maskObject({})).toEqual({});
    expect(maskObject({ items: [] })).toEqual({ items: [] });
  });
});

describe('maskForLog', () => {
  it('should format sensitive keys with mask', () => {
    expect(maskForLog('password', 'secret123')).toBe('password: ********');
    expect(maskForLog('apiKey', 'key_abc')).toBe('apiKey: ********');
  });

  it('should format non-sensitive keys with value', () => {
    expect(maskForLog('username', 'admin')).toBe('username: admin');
    expect(maskForLog('host', 'localhost')).toBe('host: localhost');
  });

  it('should handle objects', () => {
    expect(maskForLog('config', { foo: 'bar' })).toBe('config: [Object]');
  });

  it('should use custom mask options', () => {
    expect(maskForLog('password', 'secret123', { mask: '[HIDDEN]' })).toBe('password: [HIDDEN]');
    expect(maskForLog('password', 'secret123', { showPartial: { last: 3 } })).toBe('password: ********123');
  });
});

describe('maskErrorMessage', () => {
  it('should mask sensitive values in error message', () => {
    const message = 'Connection failed with password: secret123';
    const masked = maskErrorMessage(message, ['secret123']);
    expect(masked).toBe('Connection failed with password: ********');
  });

  it('should mask multiple values', () => {
    const message = 'Auth failed: user=admin, pass=secret123, token=tok_abc';
    const masked = maskErrorMessage(message, ['secret123', 'tok_abc']);
    expect(masked).toBe('Auth failed: user=admin, pass=********, token=********');
  });

  it('should use custom mask', () => {
    const message = 'Password: secret123';
    const masked = maskErrorMessage(message, ['secret123'], '[REDACTED]');
    expect(masked).toBe('Password: [REDACTED]');
  });

  it('should handle empty sensitive values', () => {
    const message = 'Some error message';
    expect(maskErrorMessage(message, [])).toBe('Some error message');
    expect(maskErrorMessage(message, [''])).toBe('Some error message');
  });

  it('should handle special regex characters in values', () => {
    const message = 'Token: tok.abc+123';
    const masked = maskErrorMessage(message, ['tok.abc+123']);
    expect(masked).toBe('Token: ********');
  });
});

describe('extractSensitiveValues', () => {
  it('should extract sensitive values from flat object', () => {
    const obj = {
      username: 'admin',
      password: 'secret123',
      apiKey: 'key_abc',
    };
    const values = extractSensitiveValues(obj);
    expect(values).toContain('secret123');
    expect(values).toContain('key_abc');
    expect(values).not.toContain('admin');
  });

  it('should extract sensitive values from nested object', () => {
    const obj = {
      database: {
        host: 'localhost',
        password: 'dbpass',
      },
      api: {
        token: 'tok_xyz',
      },
    };
    const values = extractSensitiveValues(obj);
    expect(values).toContain('dbpass');
    expect(values).toContain('tok_xyz');
    expect(values).not.toContain('localhost');
  });

  it('should extract sensitive values from arrays', () => {
    const obj = {
      credentials: [
        { type: 'db', password: 'pass1' },
        { type: 'api', password: 'pass2' },
      ],
    };
    const values = extractSensitiveValues(obj);
    expect(values).toContain('pass1');
    expect(values).toContain('pass2');
    expect(values).not.toContain('db');
  });

  it('should skip null and undefined values', () => {
    const obj = {
      password: null,
      secret: undefined,
      token: 'valid',
    };
    const values = extractSensitiveValues(obj);
    expect(values).toEqual(['valid']);
  });
});

describe('DEFAULT_SENSITIVE_PATTERNS', () => {
  it('should have expected patterns', () => {
    expect(DEFAULT_SENSITIVE_PATTERNS.length).toBeGreaterThan(15);
  });
});

describe('DEFAULT_MASK', () => {
  it('should be 8 asterisks', () => {
    expect(DEFAULT_MASK).toBe('********');
  });
});

describe('isSensitivePath', () => {
  it('should detect paths in additionalPaths', () => {
    expect(isSensitivePath('database.url', { additionalPaths: ['database.url'] })).toBe(true);
    expect(isSensitivePath('config.internal.id', { additionalPaths: ['config.internal.id'] })).toBe(true);
  });

  it('should not detect paths not in additionalPaths', () => {
    expect(isSensitivePath('database.url', { additionalPaths: [] })).toBe(false);
    expect(isSensitivePath('database.url', {})).toBe(false);
  });

  it('should respect excludePaths', () => {
    expect(isSensitivePath('database.url', {
      additionalPaths: ['database.url'],
      excludePaths: ['database.url']
    })).toBe(false);
  });
});

describe('maskObject with paths', () => {
  it('should mask specific paths via additionalPaths', () => {
    const obj = {
      database: {
        host: 'localhost',
        url: 'postgres://user:pass@localhost/db',
      },
      app: {
        name: 'myapp',
        internalId: 'id_12345',
      },
    };

    const masked = maskObject(obj, {
      additionalPaths: ['database.url', 'app.internalId'],
    });

    expect(masked.database.host).toBe('localhost');
    expect(masked.database.url).toBe(DEFAULT_MASK);
    expect(masked.app.name).toBe('myapp');
    expect(masked.app.internalId).toBe(DEFAULT_MASK);
  });

  it('should exclude specific paths via excludePaths', () => {
    const obj = {
      auth: {
        token: 'secret_token',
        sessionTimeout: 3600,
      },
    };

    // 'token' matches sensitive pattern, but we exclude auth.token
    const masked = maskObject(obj, {
      excludePaths: ['auth.token'],
    });

    expect(masked.auth.token).toBe('secret_token'); // not masked due to excludePaths
  });

  it('should combine key patterns and path patterns', () => {
    const obj = {
      database: {
        connectionString: 'postgres://localhost/db', // matches 'connectionString' pattern
        customUrl: 'http://example.com', // doesn't match pattern
      },
      internal: {
        debugValue: 'debug123', // doesn't match pattern
      },
    };

    const masked = maskObject(obj, {
      additionalPaths: ['internal.debugValue'],
    });

    expect(masked.database.connectionString).toBe(DEFAULT_MASK); // masked by key pattern
    expect(masked.database.customUrl).toBe('http://example.com'); // not masked
    expect(masked.internal.debugValue).toBe(DEFAULT_MASK); // masked by path
  });

  it('should handle nested paths', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            sensitiveData: 'secret',
          },
        },
      },
    };

    const masked = maskObject(obj, {
      additionalPaths: ['level1.level2.level3.sensitiveData'],
    });

    expect(masked.level1.level2.level3.sensitiveData).toBe(DEFAULT_MASK);
  });
});
