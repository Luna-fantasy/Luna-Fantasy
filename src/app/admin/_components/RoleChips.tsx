'use client';

import { useMemo } from 'react';
import { useGuild } from './GuildDataProvider';
import RolePicker from './RolePicker';

function roleHex(color: number): string {
  if (!color) return '#99aab5';
  return `#${color.toString(16).padStart(6, '0')}`;
}

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  showManaged?: boolean;
}

export default function RoleChips({ value, onChange, showManaged }: Props) {
  const { roles } = useGuild();
  const list = Array.isArray(value) ? value : [];

  const roleMap = useMemo(() => {
    const m = new Map<string, (typeof roles)[0]>();
    for (const r of roles) m.set(r.id, r);
    return m;
  }, [roles]);

  const add = (id: string) => {
    if (!id || list.includes(id)) return;
    onChange([...list, id]);
  };
  const remove = (id: string) => onChange(list.filter((v) => v !== id));

  return (
    <div className="av-picker-chips-wrap">
      {list.length === 0 && (
        <div className="av-picker-chips-empty">Anyone can use this — add a role to restrict.</div>
      )}
      {list.length > 0 && (
        <div className="av-picker-chips">
          {list.map((id) => {
            const role = roleMap.get(id);
            return (
              <span key={id} className="av-picker-chip av-picker-chip--role" title={id}>
                <span className="av-picker-role-dot" style={{ background: role ? roleHex(role.color) : '#99aab5' }} />
                <span className="av-picker-chip-label">{role ? role.name : id}</span>
                <button
                  type="button"
                  className="av-picker-chip-remove"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${role?.name ?? id}`}
                >&times;</button>
              </span>
            );
          })}
        </div>
      )}
      <RolePicker value="" onChange={add} showManaged={showManaged} placeholder="+ Add role" hideFallback />
    </div>
  );
}
