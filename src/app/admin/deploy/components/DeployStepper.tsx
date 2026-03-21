'use client';

interface Step {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

interface DeployStepperProps {
  steps: Step[];
}

export default function DeployStepper({ steps }: DeployStepperProps) {
  return (
    <div className="admin-stepper">
      {steps.map((step, i) => (
        <span key={step.name} style={{ display: 'contents' }}>
          <div className="admin-stepper-step">
            <div className={`admin-stepper-icon admin-stepper-icon-${step.status === 'running' ? 'active' : step.status}`}>
              {step.status === 'done' ? '\u2713' :
               step.status === 'error' ? '\u2717' :
               step.status === 'running' ? '\u25CF' :
               (i + 1)}
            </div>
            <div className="admin-stepper-label">
              {step.name}
              {step.error && (
                <div style={{ color: '#f43f5e', fontSize: '10px', marginTop: '4px', maxWidth: '120px' }}>
                  {step.error.slice(0, 80)}
                </div>
              )}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`admin-stepper-connector ${
              step.status === 'done' ? 'admin-stepper-connector-done' :
              step.status === 'running' ? 'admin-stepper-connector-active' : ''
            }`} />
          )}
        </span>
      ))}
    </div>
  );
}
