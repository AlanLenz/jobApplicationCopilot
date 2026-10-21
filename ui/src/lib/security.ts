import crypto from 'crypto';

// Master secret from environment or deterministic fallback derived from DATABASE_URL + GEMINI_API_KEY
function getMasterSecret(): Buffer {
  const envSecret =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_SECRET ||
    `${process.env.DATABASE_URL || 'job-copilot-local-secret'}:${process.env.GEMINI_API_KEY || 'default-key'}`;

  return crypto.createHash('sha256').update(envSecret).digest();
}

/**
 * Derives a unique 256-bit AES key bound to a specific userId using HKDF-SHA256.
 * Even if two users upload the exact same text, keys and IVs are completely distinct.
 */
function deriveUserKey(userId: string): Buffer {
  const masterKey = getMasterSecret();
  const derived = crypto.hkdfSync(
    'sha256',
    masterKey,
    Buffer.from(userId, 'utf-8'),
    Buffer.from('job-application-copilot-aes-256-gcm-v1', 'utf-8'),
    32
  );
  return Buffer.from(derived);
}

/**
 * Encrypts sensitive user data at rest using AES-256-GCM (Authenticated Encryption).
 * Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptUserData(plainText: string, userId: string): string {
  if (!plainText) return '';
  const key = deriveUserKey(userId);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts AES-256-GCM encrypted user data, verifying authenticity tag and userId binding.
 */
export function decryptUserData(payload: string | null | undefined, userId: string): string | null {
  if (!payload) return null;
  try {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      return null;
    }

    const [, ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveUserKey(userId);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (err) {
    console.error('Failed to decrypt user data (integrity check or key mismatch):', err);
    return null;
  }
}

/**
 * Hashes a password using scrypt with a 16-byte random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored scrypt hash using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const [, salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates a high-entropy 256-bit session token and its SHA-256 database hash.
 */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  return { token, tokenHash };
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
