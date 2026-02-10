import type { PipelineStatus, DeployedApp, UploadResult } from '@bnbrew/shared';

export interface DeployedContract {
  name: string;
  proxyAddress: string;
  implAddress: string;
  txHash: string;
}

export interface PipelineArtifact {
  type: 'solidity' | 'abi' | 'bytecode' | 'frontend';
  name: string;
  content: string;
  createdAt: number;
}

/**
 * Valid state transitions for the pipeline.
 * Each status maps to the set of statuses it can transition to.
 */
const VALID_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  PENDING: ['COMPILING', 'FAILED'],
  COMPILING: ['DEPLOYING_CONTRACTS', 'FAILED'],
  DEPLOYING_CONTRACTS: ['GENERATING_FRONTEND', 'FAILED'],
  GENERATING_FRONTEND: ['UPLOADING_FRONTEND', 'FAILED'],
  UPLOADING_FRONTEND: ['CONFIGURING_ACL', 'FAILED'],
  CONFIGURING_ACL: ['REGISTERING', 'FAILED'],
  REGISTERING: ['VERIFYING', 'FAILED'],
  VERIFYING: ['LIVE', 'FAILED'],
  LIVE: [],
  FAILED: ['COMPILING', 'DEPLOYING_CONTRACTS', 'GENERATING_FRONTEND'], // retry from checkpoints
};

export class PipelineState {
  readonly appId: string;
  currentStatus: PipelineStatus = 'PENDING';
  message = '';
  startedAt: number;
  completedAt?: number;
  error?: Error;

  private artifacts: PipelineArtifact[] = [];
  private contracts: DeployedContract[] = [];
  private uploads: UploadResult[] = [];
  private statusHistory: Array<{ status: PipelineStatus; message: string; timestamp: number }> = [];
  private deployedApp?: DeployedApp;

  constructor(appId: string) {
    this.appId = appId;
    this.startedAt = Date.now();
  }

  setStatus(status: PipelineStatus, message: string): void {
    const validTargets = VALID_TRANSITIONS[this.currentStatus];
    if (!validTargets?.includes(status)) {
      throw new Error(
        `Invalid state transition: ${this.currentStatus} → ${status}`,
      );
    }

    this.statusHistory.push({
      status: this.currentStatus,
      message: this.message,
      timestamp: Date.now(),
    });

    this.currentStatus = status;
    this.message = message;
  }

  addArtifact(type: PipelineArtifact['type'], name: string, content: string): void {
    this.artifacts.push({ type, name, content, createdAt: Date.now() });
  }

  getArtifacts(type?: PipelineArtifact['type']): PipelineArtifact[] {
    if (type) {
      return this.artifacts.filter((a) => a.type === type);
    }
    return [...this.artifacts];
  }

  setContracts(contracts: DeployedContract[]): void {
    this.contracts = contracts;
  }

  getContracts(): DeployedContract[] {
    return [...this.contracts];
  }

  setUploads(uploads: UploadResult[]): void {
    this.uploads = uploads;
  }

  getUploads(): UploadResult[] {
    return [...this.uploads];
  }

  complete(deployedApp: DeployedApp): void {
    this.deployedApp = deployedApp;
    this.completedAt = Date.now();
  }

  fail(error: Error): void {
    this.error = error;
    if (this.currentStatus !== 'FAILED') {
      this.statusHistory.push({
        status: this.currentStatus,
        message: this.message,
        timestamp: Date.now(),
      });
      this.currentStatus = 'FAILED';
      this.message = error.message;
    }
    this.completedAt = Date.now();
  }

  /**
   * Get the last successful status for retry purposes
   */
  getLastCheckpoint(): PipelineStatus | null {
    for (let i = this.statusHistory.length - 1; i >= 0; i--) {
      const entry = this.statusHistory[i];
      if (entry.status !== 'FAILED' && entry.status !== 'PENDING') {
        return entry.status;
      }
    }
    return null;
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return (this.completedAt || Date.now()) - this.startedAt;
  }

  /**
   * Serialize state for API responses / SSE events
   */
  toJSON() {
    return {
      appId: this.appId,
      status: this.currentStatus,
      message: this.message,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      elapsed: this.elapsed(),
      contracts: this.contracts.map((c) => ({
        name: c.name,
        address: c.proxyAddress,
      })),
      uploadCount: this.uploads.length,
      history: this.statusHistory,
      deployedApp: this.deployedApp,
      error: this.error?.message,
    };
  }
}
