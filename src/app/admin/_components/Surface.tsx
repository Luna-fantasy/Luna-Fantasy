import type { ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './nav-config';

interface SurfaceProps {
  title?: string;
  icon?: IconName;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}

export default function Surface({ title, icon, meta, actions, flush, children }: SurfaceProps) {
  return (
    <section className="av-surface">
      {(title || actions) && (
        <header className="av-surface-head">
          {title && (
            <h2 className="av-surface-title">
              {icon && <Icon name={icon} />}
              {title}
            </h2>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {meta && <span className="av-surface-meta">{meta}</span>}
            {actions}
          </div>
        </header>
      )}
      <div className={`av-surface-body${flush ? ' av-surface-body--flush' : ''}`}>
        {children}
      </div>
    </section>
  );
}
