import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: 'cyan' | 'gold' | 'purple' | 'green';
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  href?: string;
  tooltip?: string;
}

export default function StatCard({ label, value, icon, color = 'cyan', trend, trendType = 'neutral', href, tooltip }: StatCardProps) {
  const card = (
    <div className={`admin-stat-card${href ? ' admin-stat-card-link' : ''}`} data-tooltip={tooltip || undefined}>
      <div className="admin-stat-header">
        <span className="admin-stat-label">{label}</span>
        <div className={`admin-stat-icon ${color}`}>{icon}</div>
      </div>
      <div className="admin-stat-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {trend && (
        <div className={`admin-stat-trend ${trendType}`}>{trend}</div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        {card}
      </Link>
    );
  }

  return card;
}
