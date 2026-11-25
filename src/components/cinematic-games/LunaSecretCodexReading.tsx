import { ArchiveName } from '@/components/ArchiveName';
import React from 'react';
import { lunaSecretCodexLabels, type LunaSecretCodexSelection } from '@/lib/cinematic/luna-secret-codex';

type ReadingRows = LunaSecretCodexSelection['reading']['facts'];

function ReadingGroup({ title, rows }: { title: string; rows: ReadingRows }) {
  if (!rows.length) return null;
  return (
    <div data-codex-group>
      <h3>{title}</h3>
      <dl>
        {rows.map(({ label, text }, index) => (
          <div key={index}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LunaSecretCodexReading({ selection, className }: {
  selection: LunaSecretCodexSelection;
  className?: string;
}) {
  const { lang, name, lore, schema, value, facts, margin } = selection.reading;
  const ui = lunaSecretCodexLabels[lang];

  return (
    <details className={className}>
      <summary>{ui.open}</summary>
      <section lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <header>
          <p data-codex-eyebrow>{ui.label}</p>
          <h2><ArchiveName>{name}</ArchiveName></h2>
          <p data-codex-value>{ui.value}: {typeof value === 'number' ? new Intl.NumberFormat(lang).format(value) : value}</p>
        </header>
        {schema && <p data-codex-inscription>{ui.schema}: {schema}</p>}
        <p data-codex-lore>{lore}</p>
        <ReadingGroup title={ui.facts} rows={facts} />
        <ReadingGroup title={ui.margin} rows={margin} />
      </section>
    </details>
  );
}
