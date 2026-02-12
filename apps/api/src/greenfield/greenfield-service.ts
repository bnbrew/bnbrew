/**
 * Greenfield service — runs SDK operations in an isolated child process
 * so browser polyfills don't contaminate the main NestJS process.
 */
import { fork, type ChildProcess } from 'child_process';
import * as path from 'path';
import type { UploadResult } from './client';

let worker: ChildProcess | null = null;
let workerReady = false;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function getWorker(): ChildProcess {
  if (worker && !worker.killed) return worker;

  const workerPath = path.resolve(__dirname, 'worker.js');
  worker = fork(workerPath, [], { stdio: ['pipe', 'inherit', 'inherit', 'ipc'] });
  workerReady = false;

  worker.on('message', (msg: any) => {
    if (msg.id === '__ready') {
      workerReady = true;
      return;
    }
    const handler = pending.get(msg.id);
    if (!handler) return;
    pending.delete(msg.id);
    if (msg.success) {
      handler.resolve(msg.result);
    } else {
      handler.reject(new Error(msg.error || 'Worker error'));
    }
  });

  worker.on('exit', (code) => {
    worker = null;
    workerReady = false;
    // Reject all pending requests
    for (const [id, handler] of pending) {
      handler.reject(new Error(`Greenfield worker exited with code ${code}`));
      pending.delete(id);
    }
  });

  return worker;
}

function sendCommand(command: string, args: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const w = getWorker();
    pending.set(id, { resolve, reject });
    w.send({ id, command, ...args }, (err) => {
      if (err) {
        pending.delete(id);
        reject(err);
      }
    });
  });
}

export async function createPublicBucket(appId: string, privateKey: string): Promise<string> {
  return sendCommand('createPublicBucket', { appId, privateKey });
}

export async function uploadDistToBucket(
  appId: string,
  distDir: string,
  privateKey: string,
): Promise<UploadResult[]> {
  return sendCommand('uploadDistToBucket', { appId, distDir, privateKey });
}

export async function createPrivateBucket(appId: string, privateKey: string): Promise<string> {
  return sendCommand('createPrivateBucket', { appId, privateKey });
}

export async function grantBucketAccess(
  appId: string,
  granteeAddress: string,
  permissions: ('read' | 'write')[],
  privateKey: string,
): Promise<string> {
  return sendCommand('grantBucketAccess', { appId, granteeAddress, permissions, privateKey });
}

export function shutdownWorker(): void {
  if (worker && !worker.killed) {
    worker.send({ id: '__shutdown', command: 'exit' });
    setTimeout(() => {
      if (worker && !worker.killed) worker.kill();
    }, 3000);
  }
}
