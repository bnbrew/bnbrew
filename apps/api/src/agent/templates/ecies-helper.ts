export const ECIES_HELPER_TEMPLATE = `import { ethers } from 'ethers';

/**
 * ECIES encryption helper for BNBrew apps.
 * End users encrypt data with the app owner's public key.
 * Only the owner can decrypt using their wallet.
 */

// Encrypt data for the app owner (no wallet needed)
export async function encryptForOwner(
  data: string,
  ownerPublicKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  // Generate ephemeral keypair
  const ephemeralKey = ethers.randomBytes(32);
  const ephemeralWallet = new ethers.Wallet(ethers.hexlify(ephemeralKey));

  // Derive shared secret via ECDH
  const sharedSecret = ethers.keccak256(
    ethers.concat([
      ethers.getBytes(ephemeralWallet.publicKey),
      ethers.getBytes(ownerPublicKey),
    ]),
  );

  // AES-256-GCM encrypt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    ethers.getBytes(sharedSecret).slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes,
  );

  // Pack: ephemeralPubKey(65) + iv(12) + ciphertext(variable)
  const packed = ethers.concat([
    ethers.getBytes(ephemeralWallet.publicKey),
    iv,
    new Uint8Array(ciphertext),
  ]);

  return ethers.hexlify(packed);
}

// Decrypt data as the app owner (requires wallet signature)
export async function decryptAsOwner(
  encrypted: string,
  signer: ethers.Signer,
): Promise<string> {
  const data = ethers.getBytes(encrypted);

  // Unpack
  const ephemeralPubKey = ethers.hexlify(data.slice(0, 65));
  const iv = data.slice(65, 77);
  const ciphertext = data.slice(77);

  // Derive shared secret
  const signerAddress = await signer.getAddress();
  const signature = await signer.signMessage(
    'BNBrew: Decrypt data for ' + signerAddress,
  );

  const sharedSecret = ethers.keccak256(
    ethers.concat([
      ethers.getBytes(ephemeralPubKey),
      ethers.getBytes(signature).slice(0, 65),
    ]),
  );

  // AES-256-GCM decrypt
  const key = await crypto.subtle.importKey(
    'raw',
    ethers.getBytes(sharedSecret).slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
`;
