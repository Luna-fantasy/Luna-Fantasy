'use client';

const BOT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  butler: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
  jester: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', text: '#c084fc' },
  oracle: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: '#facc15' },
  sage: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ade80' },
};

interface BotBadgeProps {
  bot: 'butler' | 'jester' | 'oracle' | 'sage';
}

export default function BotBadge({ bot }: BotBadgeProps) {
  const colors = BOT_COLORS[bot] || BOT_COLORS.butler;
  const name = bot.charAt(0).toUpperCase() + bot.slice(1);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.03em',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      color: colors.text,
      marginLeft: '8px',
      verticalAlign: 'middle',
    }}>
      {name}
    </span>
  );
}
