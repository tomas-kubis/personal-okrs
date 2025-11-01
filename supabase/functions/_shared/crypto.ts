/**
 * Encryption utilities for API key storage
 * Uses Web Crypto API (AES-GCM) for secure encryption/decryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Get encryption key from environment variable
 * Should be a 32-byte (256-bit) base64-encoded key
 */
function getEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return key;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  const binaryString = String.fromCharCode(...bytes);
  return btoa(binaryString);
}

/**
 * Import the encryption key for use with Web Crypto API
 */
async function importKey(): Promise<CryptoKey> {
  const keyData = base64ToBytes(getEncryptionKey());
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    const key = await importKey();

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encode plaintext to bytes
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Encrypt
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      plaintextBytes
    );

    const ciphertext = new Uint8Array(ciphertextBuffer);

    // Prepend IV to ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    // Return as base64
    return bytesToBase64(combined);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a ciphertext string
 * Expects base64-encoded ciphertext with IV prepended
 */
export async function decrypt(ciphertext: string): Promise<string> {
  try {
    const key = await importKey();

    // Decode from base64
    const combined = base64ToBytes(ciphertext);

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertextBytes = combined.slice(IV_LENGTH);

    // Decrypt
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertextBytes
    );

    // Decode bytes to string
    return new TextDecoder().decode(plaintextBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a random encryption key (for setup)
 * Returns a base64-encoded 256-bit key
 */
export function generateEncryptionKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH / 8));
  return bytesToBase64(keyBytes);
}
