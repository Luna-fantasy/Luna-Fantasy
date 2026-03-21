'use client';

interface DeployReminderProps {
  show: boolean;
  projectName: string;
}

export default function DeployReminder({ show, projectName }: DeployReminderProps) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(234, 179, 8, 0.15)',
      border: '1px solid rgba(234, 179, 8, 0.4)',
      borderRadius: '12px',
      padding: '10px 20px',
      fontSize: '13px',
      color: '#facc15',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{ fontSize: '16px' }}>&#9888;&#65039;</span>
      Changes saved to {projectName} config but not yet deployed.
      {' '}Go to <a href="/admin/deploy" style={{ color: '#facc15', textDecoration: 'underline' }}>Deploy</a> to push changes live.
    </div>
  );
}
