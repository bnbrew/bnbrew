import { Module } from '@nestjs/common';
import { RelayController } from './relay.controller';
import { RelayService } from './relay.service';
import { RateLimiter } from './rate-limiter';
import { HmacGuard } from './hmac.guard';

@Module({
  controllers: [RelayController],
  providers: [RelayService, RateLimiter, HmacGuard],
  exports: [RelayService, RateLimiter],
})
export class RelayModule {}
