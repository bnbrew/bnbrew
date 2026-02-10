import { Controller, Post, Body, Sse, Param, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { deployApp, PipelineResult } from './orchestrator';
import { PipelineState } from './state';
import type { AppSpec, PipelineStatus } from '@bnbrew/shared';

interface DeployRequest {
  appSpec: AppSpec;
  privateKey: string;
}

interface StatusEvent {
  data: {
    status: PipelineStatus;
    message: string;
    elapsed: number;
  };
}

// Track active deployments for SSE streaming
const activeDeployments = new Map<string, Subject<StatusEvent>>();

@Controller('api/v1/pipeline')
export class PipelineController {
  @Post('deploy')
  async deploy(@Body() body: DeployRequest): Promise<{ appId: string; streamUrl: string }> {
    if (!body.appSpec || !body.privateKey) {
      throw new HttpException('Missing appSpec or privateKey', HttpStatus.BAD_REQUEST);
    }

    const appId = body.appSpec.id;
    const statusSubject = new Subject<StatusEvent>();
    activeDeployments.set(appId, statusSubject);

    // Start deployment in background
    deployApp(body.appSpec, body.privateKey, {
      onStatusChange: (status, message) => {
        statusSubject.next({
          data: { status, message, elapsed: 0 },
        });
      },
      onError: (error) => {
        statusSubject.next({
          data: { status: 'FAILED', message: error.message, elapsed: 0 },
        });
        statusSubject.complete();
        activeDeployments.delete(appId);
      },
    }).then((result) => {
      if (result.success) {
        statusSubject.next({
          data: { status: 'LIVE', message: 'Deployment complete', elapsed: result.state.elapsed() },
        });
      }
      statusSubject.complete();
      activeDeployments.delete(appId);
    });

    return {
      appId,
      streamUrl: `/api/v1/pipeline/status/${appId}`,
    };
  }

  @Sse('status/:appId')
  streamStatus(@Param('appId') appId: string): Observable<MessageEvent> {
    const subject = activeDeployments.get(appId);
    if (!subject) {
      throw new HttpException('No active deployment found', HttpStatus.NOT_FOUND);
    }

    return subject.pipe(
      map((event) => ({
        data: JSON.stringify(event.data),
      }) as MessageEvent),
    );
  }
}
