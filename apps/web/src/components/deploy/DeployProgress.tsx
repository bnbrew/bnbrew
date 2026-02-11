'use client';

type PipelineStep =
  | 'PENDING'
  | 'COMPILING'
  | 'DEPLOYING_CONTRACTS'
  | 'GENERATING_FRONTEND'
  | 'UPLOADING_FRONTEND'
  | 'CONFIGURING_ACL'
  | 'REGISTERING'
  | 'VERIFYING'
  | 'LIVE'
  | 'FAILED';

interface DeployProgressProps {
  currentStep: PipelineStep;
  message: string;
  isActive: boolean;
  deployedUrl?: string;
}

const STEPS: Array<{ key: PipelineStep; label: string }> = [
  { key: 'COMPILING', label: 'Compiling contracts' },
  { key: 'DEPLOYING_CONTRACTS', label: 'Deploying to opBNB' },
  { key: 'GENERATING_FRONTEND', label: 'Generating frontend' },
  { key: 'UPLOADING_FRONTEND', label: 'Uploading to Greenfield' },
  { key: 'CONFIGURING_ACL', label: 'Configuring storage' },
  { key: 'REGISTERING', label: 'Registering app' },
  { key: 'VERIFYING', label: 'Verifying' },
  { key: 'LIVE', label: 'Live' },
];

function getStepStatus(
  step: PipelineStep,
  current: PipelineStep,
): 'completed' | 'active' | 'pending' | 'failed' {
  if (current === 'FAILED') return 'failed';

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export default function DeployProgress({
  currentStep,
  message,
  isActive,
  deployedUrl,
}: DeployProgressProps) {
  if (!isActive && currentStep === 'PENDING') return null;

  return (
    <div className="bg-bnb-card border border-bnb-border rounded-xl p-6 mx-4 my-4">
      <h3 className="text-sm font-semibold text-bnb-light mb-4">Deployment Progress</h3>

      <div className="space-y-3">
        {STEPS.map((step) => {
          const status = getStepStatus(step.key, currentStep);

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                {status === 'completed' ? (
                  <div className="w-5 h-5 rounded-full bg-bnb-success flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : status === 'active' ? (
                  <div className="w-5 h-5 border-2 border-bnb-yellow border-t-transparent rounded-full animate-spin" />
                ) : status === 'failed' ? (
                  <div className="w-5 h-5 rounded-full bg-bnb-error flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-bnb-border" />
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-sm ${
                  status === 'completed'
                    ? 'text-bnb-success'
                    : status === 'active'
                      ? 'text-bnb-yellow font-medium'
                      : status === 'failed'
                        ? 'text-bnb-error'
                        : 'text-bnb-gray'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="mt-4 pt-4 border-t border-bnb-border">
        <p className="text-xs text-bnb-gray">{message}</p>
      </div>

      {/* Live URL */}
      {currentStep === 'LIVE' && deployedUrl && (
        <div className="mt-4 p-3 bg-bnb-success/10 border border-bnb-success/30 rounded-lg">
          <p className="text-sm text-bnb-success font-medium">Your app is live!</p>
          <a
            href={deployedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-bnb-yellow hover:underline break-all"
          >
            {deployedUrl}
          </a>
        </div>
      )}
    </div>
  );
}
