import { Controller, Post, Body, Sse, Param, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { deployApp, type DeployPayload, type DeployedContractInfo } from './orchestrator';
import { PrismaService } from '../prisma/prisma.service';
import type { PipelineStatus } from '@bnbrew/shared';

interface DeployRequest {
  appSpec: any;
  ownerAddress: string;
  contractSources: Array<{ name: string; source: string }>;
  previewFiles: Record<string, string>;
}

interface StatusEvent {
  data: {
    status: PipelineStatus;
    message: string;
    elapsed: number;
  };
}

// Track active deployments for SSE streaming (ReplaySubject buffers events for late subscribers)
const activeDeployments = new Map<string, ReplaySubject<StatusEvent>>();

@Controller('api/v1/pipeline')
export class PipelineController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('deploy')
  async deploy(@Body() body: DeployRequest): Promise<{ appId: string; streamUrl: string }> {
    if (!body.appSpec || !body.ownerAddress) {
      throw new HttpException('Missing appSpec or ownerAddress', HttpStatus.BAD_REQUEST);
    }

    if (!body.contractSources?.length) {
      throw new HttpException('Missing contractSources', HttpStatus.BAD_REQUEST);
    }

    if (!body.previewFiles || Object.keys(body.previewFiles).length === 0) {
      throw new HttpException('Missing previewFiles', HttpStatus.BAD_REQUEST);
    }

    if (!process.env.DEPLOY_PRIVATE_KEY) {
      throw new HttpException('Deploy service not configured (missing DEPLOY_PRIVATE_KEY)', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const appId = body.appSpec.id;
    const statusSubject = new ReplaySubject<StatusEvent>(20);
    activeDeployments.set(appId, statusSubject);

    // Mark as deploying in DB
    await this.prisma.generatedApp.updateMany({
      where: { appSpec: { path: ['id'], equals: appId } },
      data: { status: 'deploying' },
    }).catch(() => {});

    const payload: DeployPayload = {
      appSpec: body.appSpec,
      ownerAddress: body.ownerAddress,
      contractSources: body.contractSources,
      previewFiles: body.previewFiles,
    };

    // Start deployment in background
    deployApp(payload, {
      onStatusChange: (status, message) => {
        // Skip LIVE here — the .then() block emits it with the full DeployedApp JSON
        if (status === 'LIVE') return;
        statusSubject.next({
          data: { status, message, elapsed: 0 },
        });
      },
      onContractsDeployed: (contracts: DeployedContractInfo[]) => {
        statusSubject.next({
          data: { status: 'CONTRACTS_DEPLOYED' as any, message: JSON.stringify(contracts), elapsed: 0 },
        });
      },
      onError: (error) => {
        statusSubject.next({
          data: { status: 'FAILED', message: error.message, elapsed: 0 },
        });
        statusSubject.complete();
        activeDeployments.delete(appId);

        this.prisma.generatedApp.updateMany({
          where: { appSpec: { path: ['id'], equals: appId } },
          data: { status: 'failed' },
        }).catch(() => {});
      },
    }).then(async (result) => {
      if (result.success && result.deployedApp) {
        statusSubject.next({
          data: {
            status: 'LIVE',
            message: JSON.stringify(result.deployedApp),
            elapsed: result.state.elapsed(),
          },
        });

        await this.prisma.generatedApp.updateMany({
          where: { appSpec: { path: ['id'], equals: appId } },
          data: {
            status: 'live',
            deployedUrl: result.deployedApp.frontendUrl,
          },
        }).catch(() => {});
      }
      statusSubject.complete();
      activeDeployments.delete(appId);
    }).catch((err) => {
      statusSubject.next({
        data: { status: 'FAILED', message: err.message || 'Deploy failed', elapsed: 0 },
      });
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
