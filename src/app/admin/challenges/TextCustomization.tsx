'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useUndo } from '../_components/UndoProvider';
import { TEXT_CATEGORIES, TEXT_DEFAULTS, TEMPLATE_VARS } from './text-defaults';

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveTexts(updates: Record<string, string | null>): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges/texts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function TextCustomization() {
  const toast = useToast();
  const pending = usePendingAction();
  const undo = useUndo();

  const [loading, setLoading] = useState(true);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Announcements']));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/admin/challenges/texts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setTexts(d.texts || {}))
      .catch(() => toast.show({ tone: 'error', title: 'Failed to load', message: 'Could not fetch saved text overrides' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const categoryHasEdits = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [cat, keys] of Object.entries(TEXT_CATEGORIES)) {
      out[cat] = keys.some((k) => edits[k] !== undefined && edits[k] !== (texts[k] ?? TEXT_DEFAULTS[k] ?? ''));
    }
    return out;
  }, [edits, texts]);

  const dirtyCount = useMemo(
    () => Object.keys(edits).filter((k) => edits[k] !== (texts[k] ?? TEXT_DEFAULTS[k] ?? '')).length,
    [edits, texts],
  );

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSaveCategory = async (category: string) => {
    const keys = TEXT_CATEGORIES[category] || [];
    const updates: Record<string, string | null> = {};
    for (const key of keys) {
      if (edits[key] === undefined) continue;
      const val = edits[key];
      // Empty OR matches built-in default → reset the override to null
      updates[key] = !val || val === TEXT_DEFAULTS[key] ? null : val;
    }
    if (Object.keys(updates).length === 0) {
      toast.show({ tone: 'info', title: 'Nothing to save', message: `No changes in ${category}` });
      return;
    }

    const prevSnapshot: Record<string, string | null> = {};
    for (const k of Object.keys(updates)) {
      prevSnapshot[k] = k in texts ? texts[k] : null;
    }

    await pending.queue({
      label: `Save ${category}`,
      detail: `${Object.keys(updates).length} text key${Object.keys(updates).length === 1 ? '' : 's'}`,
      delayMs: 4000,
      run: async () => {
        try {
          await saveTexts(updates);
          setTexts((prev) => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(updates)) {
              if (v === null) delete next[k];
              else next[k] = v;
            }
            return next;
          });
          setEdits((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(updates)) delete next[k];
            return next;
          });
          toast.show({ tone: 'success', title: 'Saved', message: `${category} — bot picks up within 60s` });
          undo.push({
            label: `Restore ${category}`,
            detail: 'Revert text keys to previous values',
            revert: async () => {
              try {
                await saveTexts(prevSnapshot);
                setTexts((prev) => {
                  const next = { ...prev };
                  for (const [k, v] of Object.entries(prevSnapshot)) {
                    if (v === null) delete next[k];
                    else next[k] = v;
                  }
                  return next;
                });
                toast.show({ tone: 'success', title: 'Reverted', message: category });
              } catch (e) {
                toast.show({ tone: 'error', title: 'Revert failed', message: (e as Error).message });
                throw e;
              }
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const handleResetKey = (key: string) => {
    setEdits((prev) => ({ ...prev, [key]: TEXT_DEFAULTS[key] ?? '' }));
  };

  const handleDiscardCategory = (category: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const k of TEXT_CATEGORIES[category] ?? []) delete next[k];
      return next;
    });
  };

  if (loading) {
    return <section className="av-surface av-chaltext av-chaltext--loading">Loading text library…</section>;
  }

  const filterTerm = filter.trim().toLowerCase();
  const categories = Object.entries(TEXT_CATEGORIES);

  return (
    <section className="av-surface av-chaltext">
      <header className="av-chaltext-head">
        <div>
          <h3 className="av-chaltext-title">Text library</h3>
          <p className="av-chaltext-subtitle">
            Every string the bot renders for the challenge flow. {Object.keys(texts).length} overridden ·{' '}
            {Object.keys(TEXT_DEFAULTS).length - Object.keys(texts).length} on default.
          </p>
        </div>
        <div className="av-chaltext-head-actions">
          <input
            className="av-audit-input av-audit-input--sm"
            placeholder="Filter key or text…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {dirtyCount > 0 && (
            <span className="av-chaltext-dirty" title="Unsaved changes">
              ● {dirtyCount} pending
            </span>
          )}
        </div>
      </header>

      <details className="av-chaltext-vars">
        <summary className="av-chaltext-vars-summary">Template variables (click to copy)</summary>
        <div className="av-chaltext-vars-grid">
          {TEMPLATE_VARS.map((v) => (
            <button
              key={v}
              type="button"
              className="av-chaltext-var"
              onClick={() => {
                void navigator.clipboard?.writeText(v);
                toast.show({ tone: 'info', title: 'Copied', message: v });
              }}
              title="Click to copy"
            >
              <code>{v}</code>
            </button>
          ))}
        </div>
      </details>

      {categories.map(([category, keys]) => {
        const visibleKeys = filterTerm
          ? keys.filter(
              (k) =>
                k.toLowerCase().includes(filterTerm) ||
                (texts[k] ?? TEXT_DEFAULTS[k] ?? '').toLowerCase().includes(filterTerm),
            )
          : keys;
        if (filterTerm && visibleKeys.length === 0) return null;

        const isOpen = expanded.has(category) || Boolean(filterTerm);
        const dirty = categoryHasEdits[category];

        return (
          <div key={category} className={`av-chaltext-cat${isOpen ? ' av-chaltext-cat--open' : ''}`}>
            <button
              type="button"
              className="av-chaltext-cat-head"
              onClick={() => toggleCategory(category)}
              aria-expanded={isOpen}
            >
              <span className="av-chaltext-cat-chevron" aria-hidden="true">
                {isOpen ? '▾' : '▸'}
              </span>
              <span className="av-chaltext-cat-name">{category}</span>
              <span className="av-chaltext-cat-count">{visibleKeys.length} key{visibleKeys.length === 1 ? '' : 's'}</span>
              {dirty && <span className="av-chaltext-cat-dirty">unsaved</span>}
            </button>

            {isOpen && (
              <div className="av-chaltext-cat-body">
                {visibleKeys.map((key) => {
                  const saved = texts[key];
                  const def = TEXT_DEFAULTS[key] ?? '';
                  const current = edits[key] ?? saved ?? def;
                  const isCustom = saved !== undefined && saved !== def;
                  const isDirty = edits[key] !== undefined && edits[key] !== (saved ?? def);

                  return (
                    <div key={key} className={`av-chaltext-row${isDirty ? ' av-chaltext-row--dirty' : ''}`}>
                      <div className="av-chaltext-row-head">
                        <code className="av-chaltext-key">{key}</code>
                        {isCustom && !isDirty && <span className="av-chaltext-tag av-chaltext-tag--custom">custom</span>}
                        {isDirty && <span className="av-chaltext-tag av-chaltext-tag--dirty">edited</span>}
                        {!isCustom && !isDirty && <span className="av-chaltext-tag av-chaltext-tag--default">default</span>}
                        <button
                          type="button"
                          className="av-chaltext-reset"
                          onClick={() => handleResetKey(key)}
                          title={`Reset ${key} to default`}
                          disabled={current === def}
                        >
                          ↺ reset
                        </button>
                      </div>
                      <textarea
                        className="av-chaltext-textarea"
                        value={current}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={def}
                        rows={current.split('\n').length > 2 ? 4 : 2}
                        dir="auto"
                      />
                      {current !== def && (
                        <p className="av-chaltext-default-preview">
                          Default: <span dir="auto">{def}</span>
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="av-chaltext-cat-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => handleDiscardCategory(category)}
                    disabled={!dirty}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => void handleSaveCategory(category)}
                    disabled={!dirty}
                  >
                    Save {category}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
