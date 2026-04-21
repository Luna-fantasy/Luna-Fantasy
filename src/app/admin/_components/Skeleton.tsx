/**
 * Skeleton — animated placeholder for streaming Suspense boundaries.
 * Use variant="row" for list rows, "card" for surface blocks, "text" for inline text.
 */
interface SkeletonProps {
  variant?: 'row' | 'card' | 'text' | 'chart';
  count?: number;
  height?: number | string;
}

export default function Skeleton({ variant = 'row', count = 1, height }: SkeletonProps) {
  const items = Array.from({ length: count });
  if (variant === 'card') {
    return (
      <>
        {items.map((_, i) => (
          <div key={i} className="av-skel av-skel-card" style={height ? { height } : undefined} />
        ))}
      </>
    );
  }
  if (variant === 'chart') {
    return <div className="av-skel av-skel-chart" style={height ? { height } : undefined} />;
  }
  if (variant === 'text') {
    return (
      <>
        {items.map((_, i) => <span key={i} className="av-skel av-skel-text" />)}
      </>
    );
  }
  // row
  return (
    <div className="av-skel-rows">
      {items.map((_, i) => <div key={i} className="av-skel av-skel-row" />)}
    </div>
  );
}
