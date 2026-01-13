import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Encryption algorithm and parameters
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Prefix for encrypted values
 */
export const ENCRYPTED_PREFIX = 'ENC[AES256_GCM,';
export const ENCRYPTED_SUFFIX = ']';

/**
 * Options for encryption
 */
export interface EncryptOptions {
  /**
   * Encryption key (or use ZONFIG_ENCRYPTION_KEY env var)
   */
  key?: string;

  /**
   * Paths to encrypt (if not specified, encrypts all sensitive keys)
   */
  paths?: string[];

  /**
   * Additional keys to encrypt (by key name)
   */
  additionalKeys?: string[];

  /**
   * Keys to exclude from encryption (by key name)
   */
  excludeKeys?: string[];

  /**
   * Paths to exclude from encryption (by full path)
   */
  excludePaths?: string[];

  /**
   * Use default sensitive key patterns (default: true)
   */
  useSensitivePatterns?: boolean;
}

/**
 * Options for decryption
 */
export interface DecryptOptions {
  /**
   * Decryption key (or use ZONFIG_ENCRYPTION_KEY env var)
   */
  key?: string;
}

/**
 * Error thrown for encryption/decryption failures
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError);
    }
  }
}

/**
 * Derive a key from a password using scrypt
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Encrypt a string value
 */
export function encryptValue(value: string, key: string): string {
  if (!key) {
    throw new EncryptionError('Encryption key is required');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(key, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:encrypted (all base64)
  const data = `${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;

  return `${ENCRYPTED_PREFIX}${data}${ENCRYPTED_SUFFIX}`;
}

/**
 * Decrypt an encrypted string value
 */
export function decryptValue(encryptedValue: string, key: string): string {
  if (!key) {
    throw new EncryptionError('Decryption key is required');
  }

  if (!isEncrypted(encryptedValue)) {
    throw new EncryptionError('Value is not encrypted');
  }

  // Extract the data between prefix and suffix
  const data = encryptedValue.slice(ENCRYPTED_PREFIX.length, -ENCRYPTED_SUFFIX.length);
  const parts = data.split(':');

  if (parts.length !== 4) {
    throw new EncryptionError('Invalid encrypted value format');
  }

  const saltB64 = parts[0] as string;
  const ivB64 = parts[1] as string;
  const tagB64 = parts[2] as string;
  const encrypted = parts[3] as string;

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const derivedKey = deriveKey(key, salt);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  try {
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new EncryptionError('Decryption failed - invalid key or corrupted data');
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.startsWith(ENCRYPTED_PREFIX) && value.endsWith(ENCRYPTED_SUFFIX);
}

/**
 * Default sensitive key patterns for auto-encryption
 */
const DEFAULT_SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /credential/i,
  /encryption[_-]?key/i,
  /signing[_-]?key/i,
  /client[_-]?secret/i,
  /connection[_-]?string/i,
];

/**
 * Check if a key matches sensitive patterns
 */
function isSensitiveKey(key: string, additionalKeys: string[] = []): boolean {
  if (additionalKeys.includes(key)) {
    return true;
  }
  return DEFAULT_SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Get the encryption key from options or environment
 */
export function getEncryptionKey(options?: { key?: string }): string {
  const key = options?.key ?? process.env.ZONFIG_ENCRYPTION_KEY;
  if (!key) {
    throw new EncryptionError(
      'Encryption key not provided. Set ZONFIG_ENCRYPTION_KEY environment variable or pass key option.'
    );
  }
  return key;
}

/**
 * Encrypt sensitive values in a config object
 */
export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  options: EncryptOptions = {}
): T {
  const key = getEncryptionKey(options);
  const {
    paths,
    additionalKeys = [],
    excludeKeys = [],
    excludePaths = [],
    useSensitivePatterns = true,
  } = options;

  return processEncryptObject(
    obj,
    key,
    '',
    paths,
    additionalKeys,
    excludeKeys,
    excludePaths,
    useSensitivePatterns
  ) as T;
}

function processEncryptObject(
  obj: unknown,
  key: string,
  currentPath: string,
  paths: string[] | undefined,
  additionalKeys: string[],
  excludeKeys: string[],
  excludePaths: string[],
  useSensitivePatterns: boolean
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      processEncryptObject(
        item,
        key,
        `${currentPath}[${index}]`,
        paths,
        additionalKeys,
        excludeKeys,
        excludePaths,
        useSensitivePatterns
      )
    );
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [k, value] of Object.entries(obj)) {
      const fullPath = currentPath ? `${currentPath}.${k}` : k;

      // Skip already encrypted values
      if (isEncrypted(value)) {
        result[k] = value;
        continue;
      }

      // Check if this key/path is excluded
      const isExcludedByKey = excludeKeys.includes(k);
      const isExcludedByPath = excludePaths.includes(fullPath);
      const isExcluded = isExcludedByKey || isExcludedByPath;

      // Check if this path/key should be encrypted
      const shouldEncryptByPath = paths?.includes(fullPath);
      const shouldEncryptByKey = useSensitivePatterns && isSensitiveKey(k, additionalKeys);
      const shouldEncrypt = paths ? shouldEncryptByPath : shouldEncryptByKey;

      if (shouldEncrypt && !isExcluded && typeof value === 'string') {
        result[k] = encryptValue(value, key);
      } else if (value !== null && typeof value === 'object') {
        result[k] = processEncryptObject(
          value,
          key,
          fullPath,
          paths,
          additionalKeys,
          excludeKeys,
          excludePaths,
          useSensitivePatterns
        );
      } else {
        result[k] = value;
      }
    }

    return result;
  }

  return obj;
}

/**
 * Decrypt all encrypted values in a config object
 */
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  options: DecryptOptions = {}
): T {
  const key = getEncryptionKey(options);
  return processDecryptObject(obj, key) as T;
}

function processDecryptObject(obj: unknown, key: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => processDecryptObject(item, key));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [k, value] of Object.entries(obj)) {
      if (isEncrypted(value)) {
        result[k] = decryptValue(value as string, key);
      } else if (value !== null && typeof value === 'object') {
        result[k] = processDecryptObject(value, key);
      } else {
        result[k] = value;
      }
    }

    return result;
  }

  return obj;
}

/**
 * Check if an object contains any encrypted values
 */
export function hasEncryptedValues(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (isEncrypted(obj)) {
    return true;
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => hasEncryptedValues(item));
  }

  if (typeof obj === 'object') {
    return Object.values(obj).some((value) => hasEncryptedValues(value));
  }

  return false;
}

/**
 * Count encrypted values in an object
 */
export function countEncryptedValues(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 0;
  }

  if (isEncrypted(obj)) {
    return 1;
  }

  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countEncryptedValues(item), 0);
  }

  if (typeof obj === 'object') {
    return Object.values(obj).reduce((sum: number, value) => sum + countEncryptedValues(value), 0);
  }

  return 0;
}
