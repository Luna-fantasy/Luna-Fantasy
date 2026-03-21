'use client';

interface StringArrayInputProps {
  label: string;
  description?: string;
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

export default function StringArrayInput({
  label, description, value, onChange, placeholder, addLabel = 'Add', dir,
}: StringArrayInputProps) {
  function updateItem(index: number, text: string) {
    const updated = [...value];
    updated[index] = text;
    onChange(updated);
  }

  function removeItem(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...value, '']);
  }

  return (
    <div className="admin-number-input-wrap">
      {label && <label className="admin-number-input-label">{label}</label>}
      {description && <span className="admin-number-input-desc" style={{ marginBottom: '8px', display: 'block' }}>{description}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {value.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '20px', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
            <input
              type="text"
              className="admin-form-input"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={placeholder}
              dir={dir}
              style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
            />
            <button
              type="button"
              className="admin-btn admin-btn-danger admin-btn-sm"
              onClick={() => removeItem(i)}
              style={{ padding: '4px 10px' }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={addItem}
        style={{ marginTop: '6px' }}
      >
        + {addLabel}
      </button>
    </div>
  );
}
