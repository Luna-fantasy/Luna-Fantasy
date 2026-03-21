export function SkeletonText({ lines = 3, width }: { lines?: number; width?: string }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="admin-skeleton admin-skeleton-text"
          style={i === lines - 1 ? { width: width ?? '60%' } : { width: width ?? '80%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 4 }: { count?: number }) {
  return (
    <div className="admin-stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-skeleton admin-skeleton-card" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-card">
      <div className="admin-skeleton admin-skeleton-title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-skeleton admin-skeleton-table-row" />
      ))}
    </div>
  );
}
