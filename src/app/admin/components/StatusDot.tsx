'use client';

interface StatusDotProps {
  color: 'green' | 'red' | 'yellow';
  pulse?: boolean;
  title?: string;
}

export default function StatusDot({ color, pulse = false, title }: StatusDotProps) {
  return (
    <span
      className={`admin-status-dot admin-status-dot-${color} ${pulse ? 'admin-status-dot-pulse' : ''}`}
      title={title}
    />
  );
}
