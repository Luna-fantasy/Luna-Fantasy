'use client';

import { useState } from 'react';
import CanvasEditorPanel from './CanvasEditorPanel';
import AssetsPanel from './AssetsPanel';
import type { BrowseResult, CanvasLayouts } from './types';

type Tab = 'canvas' | 'assets';

interface Props {
  butlerLayouts: CanvasLayouts;
  jesterLayouts: CanvasLayouts;
  initialAssets: BrowseResult;
  r2Ready: boolean;
}

export default function MediaClient({ butlerLayouts, jesterLayouts, initialAssets, r2Ready }: Props) {
  const [tab, setTab] = useState<Tab>('canvas');

  return (
    <div className="av-media av-media-root">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Media section">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'canvas'}
          className={`av-inbox-chip${tab === 'canvas' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('canvas')}
        >Canvas Editor</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'assets'}
          className={`av-inbox-chip${tab === 'assets' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('assets')}
        >R2 Assets</button>
      </nav>

      {tab === 'canvas' && (
        <CanvasEditorPanel butlerLayouts={butlerLayouts} jesterLayouts={jesterLayouts} />
      )}

      {tab === 'assets' && (
        r2Ready
          ? <AssetsPanel initial={initialAssets} />
          : <div className="av-commands-banner av-commands-banner--warn">
              <strong>R2 not configured</strong>
              <span>Cloudflare R2 environment variables are missing. Configure <code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>, <code>R2_SECRET_ACCESS_KEY</code>, <code>R2_BUCKET_NAME</code>, <code>R2_PUBLIC_URL</code> in Railway.</span>
            </div>
      )}
    </div>
  );
}
