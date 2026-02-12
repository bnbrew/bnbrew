/**
 * ECIES Encryption Module
 *
 * Server-side ECIES utilities for key management and
 * encrypted data handling in the BNBrew pipeline.
 *
 * Algorithm: secp256k1 ECDH → HKDF-SHA256 → AES-256-GCM
 */

import * as crypto from 'crypto';
import { ethers } from 'ethers';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_INFO = Buffer.from('bnbrew-ecies-v1');

export interface EncryptedPayload {
  ephemeralPublicKey: string; // hex
  iv: string; // hex
  ciphertext: string; // hex
  tag: string; // hex
}

/**
 * Derive a shared AES-256 key from ECDH shared secret using HKDF
 */
function deriveKey(sharedSecret: Buffer): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), HKDF_INFO, 32));
}

/**
 * Compute ECDH shared secret between a private key and a public key
 */
function computeSharedSecret(privateKey: string, publicKey: string): Buffer {
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(privateKey.replace('0x', ''), 'hex'));
  const pubKeyBuffer = Buffer.from(publicKey.replace('0x', ''), 'hex');
  return ecdh.computeSecret(pubKeyBuffer);
}

/**
 * Encrypt data using ECIES with the recipient's public key (server-side)
 */
export function encrypt(plaintext: Buffer, recipientPublicKey: string): EncryptedPayload {
  // Generate ephemeral keypair
  const ephemeral = crypto.createECDH('secp256k1');
  ephemeral.generateKeys();

  const ephemeralPublicKey = ephemeral.getPublicKey('hex', 'uncompressed');
  const recipientPubBuf = Buffer.from(recipientPublicKey.replace('0x', ''), 'hex');
  const sharedSecret = ephemeral.computeSecret(recipientPubBuf);

  // Derive AES key via HKDF
  const aesKey = deriveKey(sharedSecret);

  // Encrypt with AES-256-GCM
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(aesKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ephemeralPublicKey,
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt ECIES-encrypted data using the recipient's private key (server-side)
 */
export function decrypt(payload: EncryptedPayload, recipientPrivateKey: string): Buffer {
  const sharedSecret = computeSharedSecret(recipientPrivateKey, payload.ephemeralPublicKey);
  const aesKey = deriveKey(sharedSecret);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(aesKey),
    Buffer.from(payload.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return decrypted;
}

/**
 * Derive the public key from a private key
 */
export function getPublicKeyFromPrivate(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signingKey.publicKey;
}

/**
 * Serialize an encrypted payload to a single hex string for storage
 */
export function serializePayload(payload: EncryptedPayload): string {
  const ephPub = Buffer.from(payload.ephemeralPublicKey, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');

  // Format: [65 bytes ephemeral pubkey][12 bytes iv][16 bytes tag][... ciphertext]
  return Buffer.concat([ephPub, iv, tag, ciphertext]).toString('hex');
}

/**
 * Deserialize a hex string back to an encrypted payload
 */
export function deserializePayload(hex: string): EncryptedPayload {
  const buf = Buffer.from(hex, 'hex');

  const ephemeralPublicKey = buf.subarray(0, 65).toString('hex');
  const iv = buf.subarray(65, 65 + IV_LENGTH).toString('hex');
  const tag = buf.subarray(65 + IV_LENGTH, 65 + IV_LENGTH + TAG_LENGTH).toString('hex');
  const ciphertext = buf.subarray(65 + IV_LENGTH + TAG_LENGTH).toString('hex');

  return { ephemeralPublicKey, iv, ciphertext, tag };
}
