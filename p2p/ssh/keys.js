import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Ghost Chat SSH Key Management
 * Generates and loads local RSA/Ed25519 host and client keys, computes fingerprints.
 */

export function ensureDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getFingerprint(publicKeyPem) {
  try {
    const pubKey = crypto.createPublicKey(publicKeyPem);
    const der = pubKey.export({ type: 'spki', format: 'der' });
    const hash = crypto.createHash('sha256').update(der).digest('base64').replace(/=+$/, '');
    return `SHA256:${hash}`;
  } catch (err) {
    return 'SHA256:unknown';
  }
}

export function loadOrCreateKeypair(keysDir = path.join(process.cwd(), 'data', 'keys')) {
  ensureDirectories(keysDir);
  const privKeyPath = path.join(keysDir, 'ghost_id_rsa');
  const pubKeyPath = path.join(keysDir, 'ghost_id_rsa.pub');

  if (fs.existsSync(privKeyPath) && fs.existsSync(pubKeyPath)) {
    const privateKey = fs.readFileSync(privKeyPath, 'utf8');
    const publicKey = fs.readFileSync(pubKeyPath, 'utf8');
    const fingerprint = getFingerprint(publicKey);
    return {
      privateKey,
      publicKey,
      fingerprint,
      privKeyPath,
      pubKeyPath,
    };
  }

  // Generate fresh RSA 2048 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  // Write with strict local permissions
  fs.writeFileSync(privKeyPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(pubKeyPath, publicKey, { mode: 0o644 });

  const fingerprint = getFingerprint(publicKey);

  return {
    privateKey,
    publicKey,
    fingerprint,
    privKeyPath,
    pubKeyPath,
  };
}
