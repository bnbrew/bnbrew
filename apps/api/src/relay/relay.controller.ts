import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { RelayService } from './relay.service';

export interface RelayRequest {
  appId: string;
  data: string;
  metadata: Record<string, string>;
  timestamp: number;
}

export interface RelayResponse {
  success: boolean;
  objectId?: string;
  txHash?: string;
  error?: string;
}

@Controller('api/v1/relay')
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post()
  async relay(
    @Body() body: RelayRequest,
    @Headers('x-bnbrew-hmac') hmac: string,
    @Headers('x-bnbrew-app') appId: string,
    @Headers('x-forwarded-for') forwardedFor: string,
  ): Promise<RelayResponse> {
    if (!hmac || !appId) {
      throw new HttpException('Missing authentication headers', HttpStatus.UNAUTHORIZED);
    }

    if (!body.appId || !body.data) {
      throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
    }

    if (body.appId !== appId) {
      throw new HttpException('App ID mismatch', HttpStatus.BAD_REQUEST);
    }

    const clientIp = forwardedFor?.split(',')[0]?.trim() || 'unknown';

    return this.relayService.processRelay(body, hmac, clientIp);
  }
}
