/**
 * Browser-Compatible ECIES Module
 *
 * This module is injected into generated app frontends.
 * Uses Web Crypto API + @noble/secp256k1 — no Node.js dependencies.
 *
 * End users encrypt data without a wallet.
 * App owners decrypt data by signing an EIP-712 message.
 */

export const BROWSER_ECIES_TEMPLATE = `
import { secp256k1 } from '@noble/curves/secp256k1';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

const HKDF_INFO = new TextEncoder().encode('bnbrew-ecies-v1');

interface EncryptedPayload {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

/**
 * Encrypt data for the app owner — NO WALLET NEEDED
 * Called by end users in generated apps.
 */
export async function encryptForOwner(
  plaintext: string,
  ownerPublicKey: string,
): Promise<string> {
  const data = new TextEncoder().encode(plaintext);

  // Generate ephemeral keypair
  const ephemeralPrivate = secp256k1.utils.randomPrivateKey();
  const ephemeralPublic = secp256k1.getPublicKey(ephemeralPrivate, false);

  // ECDH shared secret
  const ownerPubBytes = hexToBytes(ownerPublicKey.replace('0x', ''));
  const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivate, ownerPubBytes);
  const sharedSecret = sharedPoint.slice(1, 33); // x-coordinate only

  // Derive AES key via HKDF
  const aesKey = hkdf(sha256, sharedSecret, new Uint8Array(0), HKDF_INFO, 32);

  // Encrypt with AES-256-GCM via Web Crypto
  const iv = randomBytes(12);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    data,
  );

  // Web Crypto appends tag to ciphertext
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);

  const payload: EncryptedPayload = {
    ephemeralPublicKey: bytesToHex(ephemeralPublic),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
    tag: bytesToHex(tag),
  };

  return serializePayload(payload);
}

/**
 * Decrypt data as the app owner — REQUIRES WALLET SIGNATURE
 * Owner signs an EIP-712 message to prove ownership.
 */
export async function decryptAsOwner(
  encryptedHex: string,
  signer: { signMessage: (message: string) => Promise<string> },
): Promise<string> {
  // Derive decryption key from wallet signature
  const signature = await signer.signMessage('BNBrew: Authorize data decryption');
  // Use first 32 bytes of signature hash as private key material
  const sigHash = sha256(new TextEncoder().encode(signature));
  const privateKey = sigHash.slice(0, 32);

  const payload = deserializePayload(encryptedHex);

  // ECDH shared secret
  const ephPubBytes = hexToBytes(payload.ephemeralPublicKey);
  const sharedPoint = secp256k1.getSharedSecret(privateKey, ephPubBytes);
  const sharedSecret = sharedPoint.slice(1, 33);

  // Derive same AES key
  const aesKey = hkdf(sha256, sharedSecret, new Uint8Array(0), HKDF_INFO, 32);

  // Decrypt with AES-256-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  // Re-combine ciphertext + tag for Web Crypto
  const ciphertextBytes = hexToBytes(payload.ciphertext);
  const tagBytes = hexToBytes(payload.tag);
  const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  combined.set(ciphertextBytes);
  combined.set(tagBytes, ciphertextBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(payload.iv), tagLength: 128 },
    cryptoKey,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}

// -- Serialization helpers --

function serializePayload(payload: EncryptedPayload): string {
  const ephPub = hexToBytes(payload.ephemeralPublicKey);
  const iv = hexToBytes(payload.iv);
  const tag = hexToBytes(payload.tag);
  const ciphertext = hexToBytes(payload.ciphertext);

  const result = new Uint8Array(ephPub.length + iv.length + tag.length + ciphertext.length);
  let offset = 0;
  result.set(ephPub, offset); offset += ephPub.length;
  result.set(iv, offset); offset += iv.length;
  result.set(tag, offset); offset += tag.length;
  result.set(ciphertext, offset);

  return bytesToHex(result);
}

function deserializePayload(hex: string): EncryptedPayload {
  const bytes = hexToBytes(hex);
  return {
    ephemeralPublicKey: bytesToHex(bytes.slice(0, 65)),
    iv: bytesToHex(bytes.slice(65, 77)),
    tag: bytesToHex(bytes.slice(77, 93)),
    ciphertext: bytesToHex(bytes.slice(93)),
  };
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace('0x', '');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
`;
