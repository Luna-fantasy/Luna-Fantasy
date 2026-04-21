'use client';

interface Step {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export default function DeployStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="av-deploy-stepper">
      {steps.map((step, i) => (
        <span key={step.name} style={{ display: 'contents' }}>
          <div className="av-deploy-step" data-status={step.status}>
            <div className="av-deploy-step-icon">
              {step.status === 'done' ? '\u2713'
                : step.status === 'error' ? '\u2717'
                : step.status === 'running' ? '\u25CF'
                : i + 1}
            </div>
            <div className="av-deploy-step-label">
              {step.name}
              {step.error && (
                <div className="av-deploy-step-error">{step.error.slice(0, 80)}</div>
              )}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="av-deploy-step-connector" data-status={step.status} />
          )}
        </span>
      ))}
    </div>
  );
}
