export const RELAY_CLIENT_TEMPLATE = `/**
 * BNBrew Relay Client
 * Submits encrypted data to the relay service for walletless writes.
 * End users never need a wallet or gas.
 */

import config from '../config.json';

interface RelayResponse {
  success: boolean;
  objectId?: string;
  txHash?: string;
  error?: string;
}

// Submit encrypted data via relay (walletless)
export async function submitViaRelay(
  encryptedData: string,
  metadata?: Record<string, string>,
): Promise<RelayResponse> {
  const payload = {
    appId: config.appId,
    data: encryptedData,
    metadata: metadata || {},
    timestamp: Date.now(),
  };

  // Generate HMAC for anti-spam
  const hmac = await generateHMAC(JSON.stringify(payload));

  const response = await fetch(config.relayEndpoint + '/api/v1/relay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BNBrew-HMAC': hmac,
      'X-BNBrew-App': config.appId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  return response.json();
}

// Simple HMAC generation for anti-spam
async function generateHMAC(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(config.appId);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Check relay service health
export async function checkRelayHealth(): Promise<boolean> {
  try {
    const response = await fetch(config.relayEndpoint + '/health');
    return response.ok;
  } catch {
    return false;
  }
}
`;
