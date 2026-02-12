/**
 * Greenfield worker process — runs in isolation with browser polyfills.
 * Spawned by greenfield-service.ts via child_process.fork().
 * Communicates via IPC messages.
 */
import './polyfills'; // Must be first — sets up window/document before SDK loads

import { createPublicBucket, uploadDistToBucket } from './public-bucket';
import { createPrivateBucket, grantBucketAccess } from './private-bucket';

interface WorkerMessage {
  id: string;
  command: string;
  [key: string]: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

process.on('message', async (msg: WorkerMessage) => {
  const respond = (data: Omit<WorkerResponse, 'id'>) => {
    process.send!({ id: msg.id, ...data });
  };

  try {
    switch (msg.command) {
      case 'createPublicBucket': {
        const bucketName = await createPublicBucket(msg.appId, msg.privateKey);
        respond({ success: true, result: bucketName });
        break;
      }
      case 'uploadDistToBucket': {
        const uploads = await uploadDistToBucket(msg.appId, msg.distDir, msg.privateKey);
        respond({ success: true, result: uploads });
        break;
      }
      case 'createPrivateBucket': {
        const bucketName = await createPrivateBucket(msg.appId, msg.privateKey);
        respond({ success: true, result: bucketName });
        break;
      }
      case 'grantBucketAccess': {
        const txHash = await grantBucketAccess(
          msg.appId, msg.granteeAddress, msg.permissions, msg.privateKey,
        );
        respond({ success: true, result: txHash });
        break;
      }
      case 'exit': {
        respond({ success: true });
        process.exit(0);
        break;
      }
      default:
        respond({ success: false, error: `Unknown command: ${msg.command}` });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    respond({ success: false, error: err.message });
  }
});

// Signal ready
process.send!({ id: '__ready', success: true });
