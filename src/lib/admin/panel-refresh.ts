// Ask a bot to re-edit one of its persistent Discord panels right away
// (vendor shops, the Luna map) instead of waiting for its hourly refresh.
//
// Contract shared with LunaJesterMain/LunaButlerMain `util/panel_refresher.ts`:
// docs in `panel_refresh_requests`, claimed atomically by the bots via
// findOneAndUpdate({bot, status:'pending'} → 'processing'). TTL-indexed so
// stale requests self-delete. Fire-and-forget — a save response must never
// wait on (or fail because of) this.

import clientPromise from '@/lib/mongodb';

export type PanelBot = 'jester' | 'butler';

/** Panel keys the bots understand; 'all' refreshes every registered panel. */
export type PanelTarget =
  | 'all'
  | 'shop_brimor'
  | 'shop_broker'
  | 'shop_tickets'
  | 'shop_luckbox'
  | 'shop_meluna'
  | 'luna_map'
  | 'shop_mells';

let ttlIndexEnsured = false;

export function requestPanelRefresh(bot: PanelBot, target: PanelTarget, requestedBy: string): void {
  void (async () => {
    try {
      const client = await clientPromise;
      const col = client.db('Database').collection('panel_refresh_requests');
      if (!ttlIndexEnsured) {
        ttlIndexEnsured = true;
        await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }).catch(() => {});
      }
      await col.insertOne({
        bot,
        target,
        status: 'pending',
        requestedBy,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('[panel-refresh] Failed to queue refresh request:', err);
    }
  })();
}
