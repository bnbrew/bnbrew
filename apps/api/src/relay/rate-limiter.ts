import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 100; // per IP per app per hour

@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private readonly limits = new Map<string, RateLimitEntry>();

  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Check if a request is within rate limits.
   * Returns true if allowed, false if rate limited.
   */
  check(clientIp: string, appId: string): boolean {
    const key = `${clientIp}:${appId}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.limits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= MAX_REQUESTS) {
      this.logger.warn(`Rate limit exceeded: ip=${clientIp} app=${appId} count=${entry.count}`);
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for this IP + app combination
   */
  remaining(clientIp: string, appId: string): number {
    const key = `${clientIp}:${appId}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      return MAX_REQUESTS;
    }

    return Math.max(0, MAX_REQUESTS - entry.count);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits) {
      if (now - entry.windowStart > WINDOW_MS) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
