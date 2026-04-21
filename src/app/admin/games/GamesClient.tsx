'use client';

import { useMemo, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import GameHero from './GameHero';
import GameEditor from './GameEditor';
import PointsTiersEditor from './fields/PointsTiersEditor';
import CrossGameSettings from './CrossGameSettings';
import StopGameCard from './StopGameCard';
import { BOTS, GAMES, getAtPath, setAtPath, type GameSpec } from './game-schema';

const STOP_DEFAULT = { triggers: ['stop', 'stopgame'], enabled: true, allowedRoles: [] as string[] };

export interface DocSnapshot {
  id: string;
  data: any;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Props {
  docs: DocSnapshot[];
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveBotConfig(id: string, data: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/v2/bot-config/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function GamesClient({ docs }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  // Committed = last known saved state. We keep it in a ref so the save closure
  // always captures the freshest committed snapshot after prior saves.
  const committedRef = useRef<Record<string, any>>(
    Object.fromEntries(docs.map((d) => [d.id, d.data ?? {}])),
  );

  // Draft = what the user is editing. setDraft = re-render on every keystroke.
  const [draft, setDraft] = useState<Record<string, any>>(
    Object.fromEntries(docs.map((d) => [d.id, d.data ?? {}])),
  );

  const [activeBot, setActiveBot] = useState<'butler' | 'jester'>('jester');
  const [activeGameId, setActiveGameId] = useState<string>('roulette');

  // Map of bot → its games, stable
  const gamesByBot = useMemo(() => ({
    butler: GAMES.filter((g) => g.bot === 'butler'),
    jester: GAMES.filter((g) => g.bot === 'jester'),
  }), []);

  const currentGames = gamesByBot[activeBot];
  // Resolve the effective game WITHOUT calling setState during render.
  // The tab-click handlers keep activeGameId in sync; this just defends
  // against the case where the id doesn't match the active bot.
  const game = currentGames.find((g) => g.id === activeGameId) ?? currentGames[0];

  const gameDocData = draft[game.docId] ?? {};
  const gameValue = game.docPath.length > 0 ? getAtPath(gameDocData, game.docPath) ?? {} : gameDocData;

  const pointsDocData = game.points ? (draft[game.points.docId] ?? {}) : null;

  const isEnabled = game.enabledKey ? Boolean(gameValue?.[game.enabledKey]) : null;

  const queueSave = () => {
    pending.queue({
      label: `Save ${game.label}`,
      detail: game.bot === 'butler' ? 'Butler · ' + game.id : 'Jester · ' + game.id,
      delayMs: 4500,
      run: async () => {
        const snapshot = draftRef.current;
        const committed = committedRef.current;
        const changedDocIds = Object.keys(snapshot).filter((id) => {
          try { return JSON.stringify(snapshot[id]) !== JSON.stringify(committed[id]); }
          catch { return true; }
        });

        if (changedDocIds.length === 0) return;

        for (const id of changedDocIds) {
          const previous = committed[id];
          const next = snapshot[id];
          try {
            await saveBotConfig(id, next);
            committedRef.current = { ...committedRef.current, [id]: next };
            toast.show({ tone: 'success', title: 'Saved', message: id });
            undo.push({
              label: `Restore ${id}`,
              detail: `Rolled back to prior snapshot`,
              revert: async () => {
                try {
                  await saveBotConfig(id, previous);
                  committedRef.current = { ...committedRef.current, [id]: previous };
                  setDraft((d) => ({ ...d, [id]: previous }));
                  toast.show({ tone: 'success', title: 'Reverted', message: id });
                } catch (e) {
                  toast.show({ tone: 'error', title: 'Revert failed', message: (e as Error).message });
                  throw e;
                }
              },
            });
          } catch (e) {
            toast.show({ tone: 'error', title: `Save failed: ${id}`, message: (e as Error).message });
          }
        }
      },
    });
  };

  // Keep a live ref to draft so the pending save always reads the freshest value.
  // Updated BEFORE setDraft in the patch fn so queueSave's closure sees the latest.
  const draftRef = useRef(draft);

  const patchDraftDoc = (docId: string, nextDocData: any) => {
    const nextDraft = { ...draftRef.current, [docId]: nextDocData };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    queueSave();
  };

  const patchGameValue = (nextGameValue: any) => {
    const prevDoc = draft[game.docId] ?? {};
    const nextDoc = game.docPath.length > 0 ? setAtPath(prevDoc, game.docPath, nextGameValue) : nextGameValue;
    patchDraftDoc(game.docId, nextDoc);
  };

  const heroPatch = async (patch: { title?: string; description?: string; image?: string; enabled?: boolean; flavorPool?: string; flavorPinned?: string }) => {
    let next = gameValue;
    if (patch.title !== undefined && game.nameKey) next = { ...next, [game.nameKey]: patch.title };
    if (patch.description !== undefined && game.descKey) next = { ...next, [game.descKey]: patch.description };
    if (patch.image !== undefined && game.imageKey) next = { ...next, [game.imageKey]: patch.image };
    if (patch.enabled !== undefined && game.enabledKey) next = { ...next, [game.enabledKey]: patch.enabled };
    if (patch.flavorPool !== undefined && game.flavor?.poolKey) next = { ...next, [game.flavor.poolKey]: patch.flavorPool };
    if (patch.flavorPinned !== undefined && game.flavor?.pinnedKey) next = { ...next, [game.flavor.pinnedKey]: patch.flavorPinned };
    patchGameValue(next);
  };

  return (
    <div className="av-games">
      {/* Bot portrait tabs — reuses vendor-style tabs */}
      <nav className="av-shops-tabs" role="tablist" aria-label="Bot">
        {(Object.keys(BOTS) as Array<'butler' | 'jester'>).map((botId) => {
          const meta = BOTS[botId];
          const isActive = botId === activeBot;
          const botGames = gamesByBot[botId];
          return (
            <button
              key={botId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveBot(botId);
                setActiveGameId(botGames[0]?.id ?? '');
              }}
              className={`av-shops-tab${isActive ? ' av-shops-tab--active' : ''}`}
              style={{ ['--vendor-tone' as any]: meta.tone }}
            >
              <div className="av-shops-tab-portrait av-bot-portrait-large">
                <span>{meta.glyph}</span>
              </div>
              <div className="av-shops-tab-meta">
                <span className="av-shops-tab-name">{meta.label}</span>
                <span className="av-shops-tab-count">{botGames.length} games</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Game sub-tabs */}
      <nav className="av-games-list" role="tablist" aria-label="Games">
        {currentGames.map((g) => {
          const docData = draft[g.docId] ?? {};
          const v = g.docPath.length > 0 ? getAtPath(docData, g.docPath) ?? {} : docData;
          const gEnabled = g.enabledKey ? Boolean(v?.[g.enabledKey]) : null;
          const portrait = g.imageKey ? v?.[g.imageKey] : undefined;
          const isActive = g.id === activeGameId;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveGameId(g.id)}
              className={`av-games-list-item${isActive ? ' av-games-list-item--active' : ''}`}
              style={{ ['--vendor-tone' as any]: g.tone }}
              data-enabled={gEnabled === null ? 'na' : String(gEnabled)}
              title={g.description}
            >
              <div className="av-games-list-portrait">
                {portrait
                  ? <img src={portrait} alt="" loading="lazy" />
                  : <span>{g.glyph}</span>}
              </div>
              <div className="av-games-list-meta">
                <span className="av-games-list-name">{g.label}</span>
                {gEnabled !== null && (
                  <span className="av-games-list-status">
                    <span className={`av-games-list-dot${gEnabled ? ' av-games-list-dot--on' : ''}`} />
                    {gEnabled ? 'On' : 'Off'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Stop Game card — Jester emergency control */}
      {activeBot === 'jester' && (() => {
        const jcDraft: Record<string, any> = (draft['jester_commands'] as Record<string, any>) ?? {};
        const stopEntry = jcDraft.stop ?? STOP_DEFAULT;
        return (
          <StopGameCard
            entry={{
              triggers: Array.isArray(stopEntry.triggers) ? stopEntry.triggers : STOP_DEFAULT.triggers,
              enabled: Boolean(stopEntry.enabled),
              allowedRoles: Array.isArray(stopEntry.allowedRoles) ? stopEntry.allowedRoles : [],
            }}
            onChange={(next) => patchDraftDoc('jester_commands', { ...jcDraft, stop: next })}
          />
        );
      })()}

      {/* Hero + body for the active game */}
      <GameHero
        game={game}
        title={(game.nameKey ? gameValue?.[game.nameKey] : game.label) ?? game.label}
        description={(game.descKey ? gameValue?.[game.descKey] : '') ?? ''}
        image={(game.imageKey ? gameValue?.[game.imageKey] : '') ?? ''}
        enabled={isEnabled}
        flavorPool={game.flavor?.poolKey ? String(gameValue?.[game.flavor.poolKey] ?? '') : undefined}
        flavorPinned={game.flavor?.pinnedKey ? String(gameValue?.[game.flavor.pinnedKey] ?? '') : undefined}
        triggers={(() => {
          if (game.bot !== 'jester') return undefined;
          const jc: Record<string, any> = (draft['jester_commands'] as Record<string, any>) ?? {};
          const entry = jc[game.id];
          return Array.isArray(entry?.triggers) ? entry.triggers : [];
        })()}
        allowedRoles={Array.isArray(gameValue?.allowedRoles) ? gameValue.allowedRoles : []}
        allowedChannels={Array.isArray(gameValue?.allowedChannels) ? gameValue.allowedChannels : []}
        updatedAt={docs.find((d) => d.id === game.docId)?.updatedAt ?? null}
        onPatch={heroPatch}
      />

      <div className="av-games-body">
        <GameEditor
          game={game}
          gameValue={gameValue}
          onGamePatch={patchGameValue}
        />

        {game.points && pointsDocData && (
          <PointsTiersEditor
            mode={game.points.mode}
            pointsDoc={pointsDocData}
            keyBase={game.points.keyBase}
            title={game.points.title}
            help={game.points.help}
            onChange={(next) => patchDraftDoc(game.points!.docId, next)}
          />
        )}

        {(() => {
          const docDraft: Record<string, any> = (draft[game.docId] as Record<string, any>) ?? {};
          const hasAllGames = docDraft.all_of_games !== undefined;
          const hasVoteGame = docDraft.votegame !== undefined;
          if (!hasAllGames && !hasVoteGame) return null;

          const allowedChannels: string[] = Array.isArray(docDraft.all_of_games?.allowedChannels)
            ? docDraft.all_of_games.allowedChannels
            : [];
          const voteDuration: number = Number(docDraft.votegame?.vote_duration ?? 30);

          return (
            <CrossGameSettings
              botLabel={game.bot}
              allowedChannels={allowedChannels}
              voteDuration={voteDuration}
              onAllowedChannelsChange={(next) => patchDraftDoc(game.docId, {
                ...docDraft,
                all_of_games: { ...(docDraft.all_of_games ?? {}), allowedChannels: next },
              })}
              onVoteDurationChange={(next) => patchDraftDoc(game.docId, {
                ...docDraft,
                votegame: { ...(docDraft.votegame ?? {}), vote_duration: next },
              })}
            />
          );
        })()}
      </div>

      <p className="av-games-footnote">
        Changes save automatically with a 4.5 s cancel window. Press <kbd>Esc</kbd> on the pending pill to discard. Past saves are in the ⟲ drawer ({undo.items.length} available).
      </p>
    </div>
  );
}
