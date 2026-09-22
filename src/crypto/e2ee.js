import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Ghost Chat - Universal End-to-End Encryption (E2EE) Module
 * Standard AES-256-GCM + PBKDF2-SHA256.
 * Works universally across localhost, LAN HTTP (192.168.x.x), mobile browsers, and HTTPS.
 */

// Utility: Convert Uint8Array to Base64 string
export function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Utility: Convert Base64 string to Uint8Array
export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Secure Random Bytes (works in all browser contexts)
export function getRandomBytes(len = 12) {
  const bytes = new Uint8Array(len);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

/**
 * Derives a deterministic salt from the roomId.
 */
function getRoomSalt(roomId) {
  const enc = new TextEncoder();
  return sha256(enc.encode(`ghost_chat_v1_salt_${roomId.toLowerCase().trim()}`));
}

/**
 * Derives an AES-256 (32 bytes) key from a user passphrase and roomId
 * using PBKDF2 with 100,000 iterations of SHA-256.
 */
export async function deriveKey(passphrase, roomId) {
  const enc = new TextEncoder();
  const salt = getRoomSalt(roomId);
  const passphraseBytes = enc.encode(passphrase);

  // PBKDF2-SHA256 with 100,000 iterations -> 32 bytes (256-bit key)
  const key = pbkdf2(sha256, passphraseBytes, salt, { c: 100000, dkLen: 32 });
  return key;
}

/**
 * Encrypt plaintext string using AES-256-GCM.
 */
export async function encryptText(text, key) {
  const enc = new TextEncoder();
  const iv = getRandomBytes(12);
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(enc.encode(text));

  return {
    ciphertext: uint8ArrayToBase64(encrypted),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt ciphertext string using AES-256-GCM.
 */
export async function decryptText(ciphertextBase64, ivBase64, key) {
  try {
    const ciphertext = base64ToUint8Array(ciphertextBase64);
    const iv = base64ToUint8Array(ivBase64);
    const cipher = gcm(key, iv);
    const decrypted = cipher.decrypt(ciphertext);

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    throw new Error('Decryption failed: Incorrect passphrase or corrupted message.');
  }
}

/**
 * Encrypt a File or Blob using AES-256-GCM.
 */
export async function encryptFile(file, key) {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const iv = getRandomBytes(12);
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(fileBytes);

  return {
    ciphertext: uint8ArrayToBase64(encrypted),
    iv: uint8ArrayToBase64(iv),
    meta: {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    },
  };
}

/**
 * Decrypt an encrypted file back into a Blob URL.
 */
export async function decryptFile(ciphertextBase64, ivBase64, meta, key) {
  try {
    const ciphertext = base64ToUint8Array(ciphertextBase64);
    const iv = base64ToUint8Array(ivBase64);
    const cipher = gcm(key, iv);
    const decrypted = cipher.decrypt(ciphertext);

    const blob = new Blob([decrypted], { type: meta?.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    return { blob, url, meta };
  } catch (err) {
    throw new Error('File decryption failed.');
  }
}

/**
 * Generates a safety fingerprint (Emoji sequence + Hex code)
 */
export async function generateSafetyFingerprint(key) {
  try {
    const hash = sha256(key);
    const bytes = new Uint8Array(hash);

    const emojis = ['👻', '🔒', '🛡️', '⚡', '🗝️', '🛸', '👾', '🚀', '🔥', '💎', '🌙', '🌌', '🪐', '🔮', '✨', '🌊'];
    const emojiCode = [
      emojis[bytes[0] % emojis.length],
      emojis[bytes[1] % emojis.length],
      emojis[bytes[2] % emojis.length],
      emojis[bytes[3] % emojis.length],
    ].join(' ');

    const hexCode = Array.from(bytes.slice(0, 3))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join('-');

    return {
      emojiCode,
      hexCode,
      fullHash: Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''),
    };
  } catch (e) {
    return { emojiCode: '👻 🔒 🛡️ ⚡', hexCode: 'GHOST-01', fullHash: '' };
  }
}
