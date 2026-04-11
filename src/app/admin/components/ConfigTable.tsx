'use client';

import { formatDuration } from './DurationInput';
import RolePicker from './RolePicker';

interface Column {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'duration' | 'role' | 'percent' | 'boolean';
  width?: string;
}

interface ConfigTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  onChange: (rows: Record<string, any>[]) => void;
  addLabel?: string;
  disabled?: boolean;
}

export default function ConfigTable({ columns, rows, onChange, addLabel = 'Add Row', disabled }: ConfigTableProps) {
  function updateCell(rowIndex: number, key: string, value: any) {
    const updated = rows.map((row, i) =>
      i === rowIndex ? { ...row, [key]: value } : row
    );
    onChange(updated);
  }

  function addRow() {
    const empty: Record<string, any> = {};
    for (const col of columns) {
      if (col.type === 'number' || col.type === 'duration' || col.type === 'percent') empty[col.key] = 0;
      else if (col.type === 'role') empty[col.key] = '';
      else if (col.type === 'boolean') empty[col.key] = false;
      else empty[col.key] = '';
    }
    onChange([...rows, empty]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined}>{col.label}</th>
              ))}
              <th style={{ width: '60px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td>{ri + 1}</td>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.type === 'boolean' ? (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!row[col.key]}
                          onChange={(e) => updateCell(ri, col.key, e.target.checked)}
                          disabled={disabled}
                          style={{ width: 18, height: 18, cursor: disabled ? 'default' : 'pointer', accentColor: 'var(--accent-primary)' }}
                        />
                      </label>
                    ) : col.type === 'role' ? (
                      <RolePicker
                        label=""
                        value={row[col.key] ?? ''}
                        onChange={(v) => updateCell(ri, col.key, v)}
                        compact
                      />
                    ) : col.type === 'percent' ? (
                      <>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                          <input
                            className="admin-form-input"
                            type="number"
                            value={parseFloat(((row[col.key] ?? 0) * 100).toFixed(10))}
                            onChange={(e) => updateCell(ri, col.key, Number(e.target.value) / 100)}
                            disabled={disabled}
                            min={0}
                            max={100}
                            step={1}
                            style={{ padding: '6px 10px', fontSize: '13px', paddingRight: '28px' }}
                          />
                          <span className="admin-percent-suffix">%</span>
                        </div>
                      </>
                    ) : col.type === 'duration' ? (
                      <>
                        <input
                          className="admin-form-input"
                          type="number"
                          value={row[col.key] ?? ''}
                          onChange={(e) => updateCell(ri, col.key, Math.max(0, Number(e.target.value)))}
                          disabled={disabled}
                          min={0}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                        />
                        {row[col.key] > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {formatDuration(row[col.key])}
                          </div>
                        )}
                      </>
                    ) : (
                      <input
                        className="admin-form-input"
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={row[col.key] ?? ''}
                        onChange={(e) => updateCell(ri, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                        disabled={disabled}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => removeRow(ri)}
                    disabled={disabled}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={addRow}
        disabled={disabled}
        style={{ marginTop: '8px' }}
      >
        + {addLabel}
      </button>
    </div>
  );
}
