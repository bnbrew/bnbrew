import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { RateLimiter } from './rate-limiter';

@Injectable()
export class HmacGuard implements CanActivate {
  private readonly logger = new Logger(HmacGuard.name);

  constructor(private readonly rateLimiter: RateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const hmac = request.headers['x-bnbrew-hmac'];
    const appId = request.headers['x-bnbrew-app'];
    const clientIp =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown';

    // Check required headers
    if (!hmac || !appId) {
      throw new HttpException(
        'Missing authentication headers',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rate limit check
    if (!this.rateLimiter.check(clientIp, appId)) {
      const remaining = this.rateLimiter.remaining(clientIp, appId);
      throw new HttpException(
        {
          error: 'Rate limit exceeded',
          remaining,
          retryAfter: 3600,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Validate request body
    const body = request.body;
    if (!body || !body.appId || !body.data || !body.timestamp) {
      throw new HttpException('Invalid request body', HttpStatus.BAD_REQUEST);
    }

    // Verify HMAC signature
    const payload = JSON.stringify({
      appId: body.appId,
      data: body.data,
      metadata: body.metadata || {},
      timestamp: body.timestamp,
    });

    const expectedHmac = crypto
      .createHmac('sha256', body.appId)
      .update(payload)
      .digest('hex');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedHmac, 'hex'),
        Buffer.from(hmac, 'hex'),
      );

      if (!isValid) {
        this.logger.warn(`Invalid HMAC from ip=${clientIp} app=${appId}`);
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Invalid signature format', HttpStatus.UNAUTHORIZED);
    }

    // Timestamp validation (replay protection)
    const now = Date.now();
    const age = now - body.timestamp;
    if (age > 5 * 60 * 1000 || age < -30 * 1000) {
      throw new HttpException('Request expired', HttpStatus.BAD_REQUEST);
    }

    // Payload size check (1MB)
    const payloadSize = Buffer.byteLength(body.data, 'utf8');
    if (payloadSize > 1024 * 1024) {
      throw new HttpException('Payload too large (max 1MB)', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    return true;
  }
}
