import type { ReactNode } from 'react';

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="av-page-header">
      <div>
        <h1 className="av-page-title">{title}</h1>
        {subtitle && <p className="av-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="av-page-actions">{actions}</div>}
    </header>
  );
}
