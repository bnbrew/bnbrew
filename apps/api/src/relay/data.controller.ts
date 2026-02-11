import { Controller, Get, Param, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { downloadEncryptedData } from '../greenfield/private-bucket';

@Controller('api/v1')
export class DataController {
  @Get('submissions/:appId')
  async listSubmissions(
    @Param('appId') appId: string,
    @Headers('x-bnbrew-app') headerAppId: string,
  ) {
    if (headerAppId !== appId) {
      throw new HttpException('App ID mismatch', HttpStatus.BAD_REQUEST);
    }

    // List objects from the private bucket
    // In production, this would query the DataRouter contract events
    // for DataStored events filtered by appId
    return {
      submissions: [],
      total: 0,
    };
  }

  @Get('data/:appId/:objectName(*)')
  async getEncryptedData(
    @Param('appId') appId: string,
    @Param('objectName') objectName: string,
    @Headers('x-bnbrew-app') headerAppId: string,
  ) {
    if (headerAppId !== appId) {
      throw new HttpException('App ID mismatch', HttpStatus.BAD_REQUEST);
    }

    try {
      const privateKey = process.env.RELAY_PRIVATE_KEY;
      if (!privateKey) {
        throw new HttpException('Relay not configured', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const data = await downloadEncryptedData(appId, objectName, privateKey);
      return data.toString('hex');
    } catch (error) {
      throw new HttpException('Failed to retrieve data', HttpStatus.NOT_FOUND);
    }
  }
}
