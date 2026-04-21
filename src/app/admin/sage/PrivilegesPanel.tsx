'use client';

import ToggleCard from '../games/fields/ToggleCard';
import RolePicker from '../_components/RolePicker';
import type { PrivilegedRole, SagePrivileges, SettingsSection } from './types';

interface Props {
  data: SagePrivileges;
  onChange: (section: SettingsSection, value: any) => void;
}

export default function PrivilegesPanel({ data, onChange }: Props) {
  const privileged = Array.isArray(data.privilegedRoles) ? data.privilegedRoles : [];

  const patchPrivileged = (i: number, next: Partial<PrivilegedRole>) => {
    const list = privileged.map((r, idx) => idx === i ? { ...r, ...next } : r);
    onChange('privileged_roles', list);
  };
  const addPrivileged = () => {
    onChange('privileged_roles', [...privileged, { id: '', title: '', name: '' }]);
  };
  const removePrivileged = (i: number) => {
    onChange('privileged_roles', privileged.filter((_, idx) => idx !== i));
  };

  return (
    <section className="av-sage-panel">
      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Lunarian tier</h4>
        </header>
        <div className="av-commands-row-grid">
          <div className="av-sage-toggle-row">
            <div>
              <strong>Allow Lunarian access</strong>
              <span>When off, only privileged roles can invoke Sage.</span>
            </div>
            <ToggleCard value={Boolean(data.lunarianAccess)} onChange={(v) => onChange('lunarian_access', v)} onLabel="Open" offLabel="Locked" />
          </div>
          <label className="av-shopf-field">
            <span>Lunarian role</span>
            <RolePicker
              value={data.lunarianRoleId ?? ''}
              onChange={(id) => onChange('lunarian_role_id', id)}
              placeholder="Pick the Lunarian role"
              hideFallback
            />
          </label>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Privileged roles</h4>
          <button type="button" className="av-commands-add" onClick={addPrivileged}>+ Add role</button>
        </header>
        {privileged.length === 0 && (
          <div className="av-commands-empty">No privileged roles — all citizens speak as equals until you grant favor.</div>
        )}
        <div className="av-sage-priv-list">
          {privileged.map((r, i) => (
            <div key={i} className="av-sage-priv-row">
              <label className="av-shopf-field">
                <span>Role</span>
                <RolePicker
                  value={r.id ?? ''}
                  onChange={(id) => patchPrivileged(i, { id })}
                  placeholder="Pick a role"
                  hideFallback
                />
              </label>
              <label className="av-shopf-field">
                <span>Role name</span>
                <input className="av-shopf-input" value={r.name ?? ''} onChange={(e) => patchPrivileged(i, { name: e.target.value })} placeholder="e.g. العقل المدبر" dir="auto" />
              </label>
              <label className="av-shopf-field">
                <span>Address-as title</span>
                <input className="av-shopf-input" value={r.title ?? ''} onChange={(e) => patchPrivileged(i, { title: e.target.value })} placeholder="e.g. سيدي العقل المدبر" dir="auto" />
              </label>
              <button type="button" className="av-commands-delete" onClick={() => removePrivileged(i)} title="Remove role">🗑</button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
