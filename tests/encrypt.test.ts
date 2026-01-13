import { describe, it, expect } from 'vitest';
import {
  encryptValue,
  decryptValue,
  encryptObject,
  decryptObject,
  isEncrypted,
  hasEncryptedValues,
  countEncryptedValues,
  getEncryptionKey,
  EncryptionError,
  ENCRYPTED_PREFIX,
  ENCRYPTED_SUFFIX,
} from '../src/utils/encrypt.js';

const TEST_KEY = 'test-encryption-key-32chars-long';

describe('Encryption Utils', () => {
  describe('encryptValue', () => {
    it('encrypts a string value', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptValue(plaintext, TEST_KEY);

      expect(encrypted).toMatch(/^ENC\[AES256_GCM,/);
      expect(encrypted).toMatch(/\]$/);
      expect(encrypted).not.toContain(plaintext);
    });

    it('throws error when key is missing', () => {
      expect(() => encryptValue('test', '')).toThrow(EncryptionError);
      expect(() => encryptValue('test', '')).toThrow('Encryption key is required');
    });

    it('produces different ciphertext each time (random salt/iv)', () => {
      const plaintext = 'same-password';
      const encrypted1 = encryptValue(plaintext, TEST_KEY);
      const encrypted2 = encryptValue(plaintext, TEST_KEY);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decryptValue', () => {
    it('decrypts an encrypted value', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptValue(plaintext, TEST_KEY);
      const decrypted = decryptValue(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it('throws error when key is missing', () => {
      const encrypted = encryptValue('test', TEST_KEY);
      expect(() => decryptValue(encrypted, '')).toThrow(EncryptionError);
      expect(() => decryptValue(encrypted, '')).toThrow('Decryption key is required');
    });

    it('throws error when value is not encrypted', () => {
      expect(() => decryptValue('plain-text', TEST_KEY)).toThrow(EncryptionError);
      expect(() => decryptValue('plain-text', TEST_KEY)).toThrow('Value is not encrypted');
    });

    it('throws error when decryption key is wrong', () => {
      const encrypted = encryptValue('secret', TEST_KEY);
      expect(() => decryptValue(encrypted, 'wrong-key')).toThrow(EncryptionError);
      expect(() => decryptValue(encrypted, 'wrong-key')).toThrow('Decryption failed');
    });

    it('throws error for corrupted encrypted value', () => {
      const malformed = `${ENCRYPTED_PREFIX}invalid:data${ENCRYPTED_SUFFIX}`;
      expect(() => decryptValue(malformed, TEST_KEY)).toThrow(EncryptionError);
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted values', () => {
      const encrypted = encryptValue('test', TEST_KEY);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plain strings', () => {
      expect(isEncrypted('plain-text')).toBe(false);
      expect(isEncrypted('ENC[')).toBe(false);
      expect(isEncrypted(']')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted({})).toBe(false);
      expect(isEncrypted([])).toBe(false);
    });
  });

  describe('encryptObject', () => {
    it('encrypts sensitive keys automatically', () => {
      const config = {
        database: {
          host: 'localhost',
          password: 'secret123',
          connectionString: 'postgres://user:pass@localhost/db',
        },
        api: {
          token: 'my-api-token',
          endpoint: 'https://api.example.com',
        },
      };

      const encrypted = encryptObject(config, { key: TEST_KEY });

      expect(isEncrypted(encrypted.database.password)).toBe(true);
      expect(isEncrypted(encrypted.database.connectionString)).toBe(true);
      expect(isEncrypted(encrypted.api.token)).toBe(true);
      expect(encrypted.database.host).toBe('localhost');
      expect(encrypted.api.endpoint).toBe('https://api.example.com');
    });

    it('encrypts specific paths when provided', () => {
      const config = {
        database: {
          host: 'localhost',
          password: 'secret123',
        },
        custom: {
          value: 'should-encrypt',
        },
      };

      const encrypted = encryptObject(config, {
        key: TEST_KEY,
        paths: ['custom.value'],
      });

      expect(isEncrypted(encrypted.custom.value)).toBe(true);
      expect(encrypted.database.password).toBe('secret123'); // Not encrypted
    });

    it('skips already encrypted values', () => {
      const alreadyEncrypted = encryptValue('password', TEST_KEY);
      const config = {
        database: {
          password: alreadyEncrypted,
        },
      };

      const encrypted = encryptObject(config, { key: TEST_KEY });
      expect(encrypted.database.password).toBe(alreadyEncrypted);
    });

    it('handles nested objects and arrays', () => {
      const config = {
        services: [
          { name: 'api', secret: 'api-secret' },
          { name: 'web', secret: 'web-secret' },
        ],
        nested: {
          deep: {
            password: 'deep-password',
          },
        },
      };

      const encrypted = encryptObject(config, { key: TEST_KEY });

      expect(isEncrypted(encrypted.services[0].secret)).toBe(true);
      expect(isEncrypted(encrypted.services[1].secret)).toBe(true);
      expect(isEncrypted(encrypted.nested.deep.password)).toBe(true);
      expect(encrypted.services[0].name).toBe('api');
    });

    it('supports additional keys option', () => {
      const config = {
        myCustomField: 'should-encrypt',
        regularField: 'should-not-encrypt',
      };

      const encrypted = encryptObject(config, {
        key: TEST_KEY,
        additionalKeys: ['myCustomField'],
      });

      expect(isEncrypted(encrypted.myCustomField)).toBe(true);
      expect(encrypted.regularField).toBe('should-not-encrypt');
    });

    it('supports excludeKeys option', () => {
      const config = {
        database: {
          password: 'should-not-encrypt',
          secret: 'should-encrypt',
        },
        api: {
          token: 'should-encrypt',
          password: 'also-should-not-encrypt',
        },
      };

      const encrypted = encryptObject(config, {
        key: TEST_KEY,
        excludeKeys: ['password'],
      });

      // password keys should NOT be encrypted
      expect(encrypted.database.password).toBe('should-not-encrypt');
      expect(encrypted.api.password).toBe('also-should-not-encrypt');
      // other sensitive keys should still be encrypted
      expect(isEncrypted(encrypted.database.secret)).toBe(true);
      expect(isEncrypted(encrypted.api.token)).toBe(true);
    });

    it('supports excludePaths option', () => {
      const config = {
        database: {
          password: 'should-encrypt',
          connectionString: 'should-not-encrypt',
        },
        api: {
          token: 'should-encrypt',
        },
      };

      const encrypted = encryptObject(config, {
        key: TEST_KEY,
        excludePaths: ['database.connectionString'],
      });

      // excluded path should NOT be encrypted
      expect(encrypted.database.connectionString).toBe('should-not-encrypt');
      // other sensitive values should be encrypted
      expect(isEncrypted(encrypted.database.password)).toBe(true);
      expect(isEncrypted(encrypted.api.token)).toBe(true);
    });

    it('supports both excludeKeys and excludePaths together', () => {
      const config = {
        database: {
          password: 'exclude-by-key',
          secret: 'exclude-by-path',
          token: 'should-encrypt',
        },
      };

      const encrypted = encryptObject(config, {
        key: TEST_KEY,
        excludeKeys: ['password'],
        excludePaths: ['database.secret'],
      });

      expect(encrypted.database.password).toBe('exclude-by-key');
      expect(encrypted.database.secret).toBe('exclude-by-path');
      expect(isEncrypted(encrypted.database.token)).toBe(true);
    });
  });

  describe('decryptObject', () => {
    it('decrypts all encrypted values', () => {
      const original = {
        database: {
          host: 'localhost',
          password: 'secret123',
        },
        api: {
          token: 'my-api-token',
        },
      };

      const encrypted = encryptObject(original, { key: TEST_KEY });
      const decrypted = decryptObject(encrypted, { key: TEST_KEY });

      expect(decrypted.database.password).toBe('secret123');
      expect(decrypted.api.token).toBe('my-api-token');
      expect(decrypted.database.host).toBe('localhost');
    });

    it('handles nested objects and arrays', () => {
      const original = {
        services: [
          { name: 'api', secret: 'api-secret' },
        ],
        nested: {
          deep: {
            password: 'deep-password',
          },
        },
      };

      const encrypted = encryptObject(original, { key: TEST_KEY });
      const decrypted = decryptObject(encrypted, { key: TEST_KEY });

      expect(decrypted.services[0].secret).toBe('api-secret');
      expect(decrypted.nested.deep.password).toBe('deep-password');
    });
  });

  describe('hasEncryptedValues', () => {
    it('returns true if object contains encrypted values', () => {
      const config = {
        password: encryptValue('secret', TEST_KEY),
        host: 'localhost',
      };

      expect(hasEncryptedValues(config)).toBe(true);
    });

    it('returns false if object has no encrypted values', () => {
      const config = {
        password: 'plain',
        host: 'localhost',
      };

      expect(hasEncryptedValues(config)).toBe(false);
    });

    it('detects encrypted values in nested objects', () => {
      const config = {
        database: {
          nested: {
            password: encryptValue('secret', TEST_KEY),
          },
        },
      };

      expect(hasEncryptedValues(config)).toBe(true);
    });

    it('detects encrypted values in arrays', () => {
      const config = {
        secrets: [encryptValue('secret', TEST_KEY)],
      };

      expect(hasEncryptedValues(config)).toBe(true);
    });
  });

  describe('countEncryptedValues', () => {
    it('counts encrypted values correctly', () => {
      const config = {
        password: encryptValue('pass', TEST_KEY),
        token: encryptValue('token', TEST_KEY),
        host: 'localhost',
      };

      expect(countEncryptedValues(config)).toBe(2);
    });

    it('counts nested encrypted values', () => {
      const config = {
        database: {
          password: encryptValue('pass', TEST_KEY),
        },
        api: {
          token: encryptValue('token', TEST_KEY),
        },
        array: [encryptValue('secret', TEST_KEY)],
      };

      expect(countEncryptedValues(config)).toBe(3);
    });

    it('returns 0 for no encrypted values', () => {
      expect(countEncryptedValues({ host: 'localhost' })).toBe(0);
      expect(countEncryptedValues(null)).toBe(0);
      expect(countEncryptedValues(undefined)).toBe(0);
    });
  });

  describe('getEncryptionKey', () => {
    it('returns key from options', () => {
      const key = getEncryptionKey({ key: 'my-key' });
      expect(key).toBe('my-key');
    });

    it('throws error when no key available', () => {
      const originalEnv = process.env.ZONFIG_ENCRYPTION_KEY;
      delete process.env.ZONFIG_ENCRYPTION_KEY;

      expect(() => getEncryptionKey()).toThrow(EncryptionError);
      expect(() => getEncryptionKey()).toThrow('Encryption key not provided');

      process.env.ZONFIG_ENCRYPTION_KEY = originalEnv;
    });
  });

  describe('sensitive key patterns', () => {
    it('detects various sensitive key names', () => {
      const config = {
        password: 'p1',
        PASSWORD: 'p2',
        userPassword: 'p3',
        secret: 's1',
        clientSecret: 's2',
        token: 't1',
        accessToken: 't2',
        apiKey: 'k1',
        api_key: 'k2',
        privateKey: 'pk1',
        private_key: 'pk2',
        accessKey: 'ak1',
        credential: 'c1',
        encryptionKey: 'ek1',
        signingKey: 'sk1',
        connectionString: 'cs1',
      };

      const encrypted = encryptObject(config, { key: TEST_KEY });

      // All should be encrypted
      Object.keys(config).forEach((key) => {
        expect(isEncrypted((encrypted as Record<string, unknown>)[key])).toBe(true);
      });
    });

    it('does not encrypt non-sensitive keys', () => {
      const config = {
        host: 'localhost',
        port: 3000,
        name: 'app',
        debug: true,
        url: 'https://example.com',
      };

      const encrypted = encryptObject(config, { key: TEST_KEY });

      expect(encrypted.host).toBe('localhost');
      expect(encrypted.port).toBe(3000);
      expect(encrypted.name).toBe('app');
      expect(encrypted.debug).toBe(true);
      expect(encrypted.url).toBe('https://example.com');
    });
  });
});
