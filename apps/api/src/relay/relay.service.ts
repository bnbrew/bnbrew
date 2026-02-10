import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { uploadEncryptedData } from '../greenfield/private-bucket';
import type { RelayRequest, RelayResponse } from './relay.controller';

@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);

  async processRelay(
    request: RelayRequest,
    hmac: string,
    clientIp: string,
  ): Promise<RelayResponse> {
    try {
      // Validate HMAC
      if (!this.validateHMAC(request, hmac)) {
        return { success: false, error: 'Invalid HMAC signature' };
      }

      // Validate timestamp (replay protection: reject >5 min old)
      const now = Date.now();
      const age = now - request.timestamp;
      if (age > 5 * 60 * 1000 || age < -30 * 1000) {
        return { success: false, error: 'Request expired or timestamp invalid' };
      }

      // Validate payload size (1MB limit)
      const payloadSize = Buffer.byteLength(request.data, 'utf8');
      if (payloadSize > 1024 * 1024) {
        return { success: false, error: 'Payload too large (max 1MB)' };
      }

      // Generate object name with timestamp
      const objectName = this.generateObjectName(request);

      // Upload encrypted data to Greenfield private bucket
      const encryptedBuffer = Buffer.from(request.data, 'hex');
      const privateKey = process.env.RELAY_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('RELAY_PRIVATE_KEY not configured');
      }

      const result = await uploadEncryptedData(
        request.appId,
        objectName,
        encryptedBuffer,
        privateKey,
      );

      this.logger.log(
        `Relay write: app=${request.appId} object=${objectName} ip=${clientIp} tx=${result.txHash}`,
      );

      return {
        success: true,
        objectId: objectName,
        txHash: result.txHash,
      };
    } catch (error) {
      this.logger.error(`Relay error: ${error}`);
      return {
        success: false,
        error: 'Internal relay error',
      };
    }
  }

  private validateHMAC(request: RelayRequest, providedHmac: string): boolean {
    const payload = JSON.stringify({
      appId: request.appId,
      data: request.data,
      metadata: request.metadata,
      timestamp: request.timestamp,
    });

    const expectedHmac = crypto
      .createHmac('sha256', request.appId)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedHmac, 'hex'),
      Buffer.from(providedHmac, 'hex'),
    );
  }

  private generateObjectName(request: RelayRequest): string {
    const date = new Date().toISOString().split('T')[0];
    const hash = crypto
      .createHash('sha256')
      .update(`${request.timestamp}-${request.data.slice(0, 64)}`)
      .digest('hex')
      .slice(0, 12);

    return `submissions/${date}/${hash}`;
  }
}
