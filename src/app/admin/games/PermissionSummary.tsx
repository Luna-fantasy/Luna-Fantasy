'use client';

import { useGuild } from '../_components/GuildDataProvider';

interface Props {
  allowedRoles: string[];
  allowedChannels: string[];
}

export default function PermissionSummary({ allowedRoles, allowedChannels }: Props) {
  const { roles, channels } = useGuild();
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  const hasRoles = Array.isArray(allowedRoles) && allowedRoles.length > 0;
  const hasChannels = Array.isArray(allowedChannels) && allowedChannels.length > 0;

  return (
    <div className="av-games-permsum">
      {hasRoles ? (
        allowedRoles.slice(0, 6).map((id) => {
          const r = roleMap.get(id);
          const color = r?.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#6b7280';
          return (
            <span key={`r-${id}`} className="av-games-permsum-chip av-games-permsum-chip--role">
              <span className="av-games-permsum-dot" style={{ background: color }} />
              {r?.name ?? id.slice(0, 8)}
            </span>
          );
        })
      ) : (
        <span className="av-games-permsum-chip av-games-permsum-chip--open">Everyone</span>
      )}
      {hasChannels ? (
        allowedChannels.slice(0, 6).map((id) => {
          const c = channelMap.get(id);
          return (
            <span key={`c-${id}`} className="av-games-permsum-chip av-games-permsum-chip--channel">
              <span className="av-games-permsum-hash">#</span>
              {c?.name ?? id.slice(0, 8)}
            </span>
          );
        })
      ) : (
        <span className="av-games-permsum-chip av-games-permsum-chip--open">Any channel</span>
      )}
    </div>
  );
}
