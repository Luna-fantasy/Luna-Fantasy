import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';

type Section = 'daily_reward' | 'salary' | 'investor_reward' | 'steal_system';

const SECTION_TO_DOC: Record<Section, string> = {
  daily_reward:    'butler_economy',
  salary:          'butler_economy',
  investor_reward: 'butler_economy',
  steal_system:    'butler_games',
};

// Canonical defaults — mirror of LunaButlerMain/util/helpers/live_config.ts
// and config.ts. Shape: daily/salary/investor use {amount, cooldown}. Butler
// reads these as the new canonical shape; legacy {min, max} docs auto-upgrade
// on first save because the PUT only emits the new shape.
const ECONOMY_DEFAULTS = {
  daily_reward:    { amount: 3_000,   cooldown: 86_400_000 },           // 24h
  salary:          { amount: 80_000,  cooldown: 2_592_000_000 },        // 30d
  investor_reward: { amount: 2_000,   cooldown: 86_400_000 },           // 24h
  // Real shape per LunaButlerMain/commands/steal_commands.ts. Keys match
  // exactly what the bot reads — min_percentage/max_percentage are % of the
  // target's balance (NOT fixed Lunari), required_roles gates who can run
  // the command, and the title/image/description fields control the embed
  // copy. Every optional field falls back to a hardcoded bot default.
  steal_system: {
    enabled: false,
    cooldown: 86_400_000,           // 24h
    min_percentage: 1,
    max_percentage: 5,
    required_roles: [] as string[],
    success_title: '',
    success_footer: '',
    success_image: '',
    fail_title: '',
    fail_description: '',
    fail_image: '',
  },
};

interface DailyRewardDoc { amount: number; cooldown: number }
interface SalaryDoc { amount: number; cooldown: number }
interface InvestorRewardDoc { amount: number; cooldown: number }
interface StealSystemDoc {
  enabled: boolean;
  cooldown: number;
  min_percentage: number;
  max_percentage: number;
  required_roles: string[];
  success_title?: string;
  success_footer?: string;
  success_image?: string;
  fail_title?: string;
  fail_description?: string;
  fail_image?: string;
}

function normalizeDaily(stored: any): DailyRewardDoc {
  const s = stored && typeof stored === 'object' ? stored : {};
  // Legacy shape was {min, max, cooldown}. Prefer amount, fall back to max then min.
  const amount = typeof s.amount === 'number'
    ? s.amount
    : (typeof s.max === 'number' ? s.max : (typeof s.min === 'number' ? s.min : ECONOMY_DEFAULTS.daily_reward.amount));
  const cooldown = typeof s.cooldown === 'number' ? s.cooldown : ECONOMY_DEFAULTS.daily_reward.cooldown;
  return { amount, cooldown };
}

function normalizeFixedReward(stored: any, fallback: SalaryDoc): SalaryDoc {
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    amount: typeof s.amount === 'number' ? s.amount : fallback.amount,
    cooldown: typeof s.cooldown === 'number' ? s.cooldown : fallback.cooldown,
  };
}

function normalizeStealSystem(stored: any): StealSystemDoc {
  const s = stored && typeof stored === 'object' ? stored : {};
  const d = ECONOMY_DEFAULTS.steal_system;
  return {
    enabled:         typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
    cooldown:        typeof s.cooldown === 'number' ? s.cooldown : d.cooldown,
    min_percentage:  typeof s.min_percentage === 'number' ? s.min_percentage : d.min_percentage,
    max_percentage:  typeof s.max_percentage === 'number' ? s.max_percentage : d.max_percentage,
    required_roles:  Array.isArray(s.required_roles) ? s.required_roles.filter((x: any) => typeof x === 'string') : [],
    success_title:       typeof s.success_title === 'string' ? s.success_title : '',
    success_footer:      typeof s.success_footer === 'string' ? s.success_footer : '',
    success_image:       typeof s.success_image === 'string' ? s.success_image : '',
    fail_title:          typeof s.fail_title === 'string' ? s.fail_title : '',
    fail_description:    typeof s.fail_description === 'string' ? s.fail_description : '',
    fail_image:          typeof s.fail_image === 'string' ? s.fail_image : '',
  };
}

// ── Validators ──

function validateFixedReward(label: string, v: unknown): string | null {
  if (!v || typeof v !== 'object') return `${label} must be an object`;
  const x = v as any;
  if (typeof x.amount !== 'number' || x.amount < 0 || x.amount > 1_000_000_000) return `${label}.amount must be 0-1,000,000,000`;
  if (typeof x.cooldown !== 'number' || x.cooldown < 60_000 || x.cooldown > 31_536_000_000) return `${label}.cooldown must be 1min-1yr in ms`;
  return null;
}

function validateStealSystem(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'steal_system must be an object';
  const x = v as any;
  if (typeof x.enabled !== 'boolean') return 'steal_system.enabled must be boolean';
  if (typeof x.cooldown !== 'number' || x.cooldown < 60_000 || x.cooldown > 31_536_000_000) return 'steal_system.cooldown must be 1min-1yr in ms';
  if (typeof x.min_percentage !== 'number' || x.min_percentage < 0 || x.min_percentage > 100) return 'steal_system.min_percentage must be 0-100';
  if (typeof x.max_percentage !== 'number' || x.max_percentage < 0 || x.max_percentage > 100) return 'steal_system.max_percentage must be 0-100';
  if (x.max_percentage < x.min_percentage) return 'steal_system.max_percentage must be >= min_percentage';
  if (!Array.isArray(x.required_roles) || x.required_roles.some((r: any) => typeof r !== 'string')) return 'steal_system.required_roles must be string[]';
  if (x.required_roles.length > 30) return 'steal_system.required_roles max 30 entries';
  for (const f of ['success_title', 'success_footer', 'success_image', 'fail_title', 'fail_description', 'fail_image']) {
    if (x[f] !== undefined && (typeof x[f] !== 'string' || x[f].length > 500)) return `steal_system.${f} must be string ≤ 500 chars`;
  }
  return null;
}

// ── GET: returns all four sections merged with defaults ──

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');
    const [economyDoc, gamesDoc] = await Promise.all([
      col.findOne({ _id: 'butler_economy' as any }),
      col.findOne({ _id: 'butler_games' as any }),
    ]);

    const economyData = (economyDoc?.data as any) ?? {};
    const gamesData = (gamesDoc?.data as any) ?? {};

    // Investor reward: read new key first, fall back to legacy vip_reward.
    const investorSource = economyData.investor_reward ?? economyData.vip_reward;

    return NextResponse.json({
      daily_reward:    normalizeDaily(economyData.daily_reward),
      salary:          normalizeFixedReward(economyData.salary, ECONOMY_DEFAULTS.salary),
      investor_reward: normalizeFixedReward(investorSource, ECONOMY_DEFAULTS.investor_reward),
      steal_system:    normalizeStealSystem(gamesData.steal_system),
      updatedAt: {
        economy: economyDoc?.updatedAt ?? null,
        games:   gamesDoc?.updatedAt ?? null,
      },
      updatedBy: {
        economy: economyDoc?.updatedBy ?? null,
        games:   gamesDoc?.updatedBy ?? null,
      },
    });
  } catch (err) {
    console.error('Economy config GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── PUT: sectioned writes ──

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { section: Section; value: any };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { section, value } = body;
  if (!section) return NextResponse.json({ error: 'section required' }, { status: 400 });
  if (!(section in SECTION_TO_DOC)) return NextResponse.json({ error: `unknown section: ${section}` }, { status: 400 });

  let err: string | null = null;
  let update: Record<string, any> = {};

  if (section === 'daily_reward') {
    err = validateFixedReward('daily_reward', value);
    if (!err) {
      const v = value as DailyRewardDoc;
      update['data.daily_reward'] = {
        amount: Math.floor(v.amount),
        cooldown: Math.floor(v.cooldown),
      };
    }
  } else if (section === 'salary') {
    err = validateFixedReward('salary', value);
    if (!err) {
      const v = value as SalaryDoc;
      update['data.salary'] = {
        amount: Math.floor(v.amount),
        cooldown: Math.floor(v.cooldown),
      };
    }
  } else if (section === 'investor_reward') {
    err = validateFixedReward('investor_reward', value);
    if (!err) {
      const v = value as InvestorRewardDoc;
      update['data.investor_reward'] = {
        amount: Math.floor(v.amount),
        cooldown: Math.floor(v.cooldown),
      };
    }
  } else if (section === 'steal_system') {
    err = validateStealSystem(value);
    if (!err) {
      const v = value as StealSystemDoc;
      const doc: Record<string, any> = {
        enabled: v.enabled,
        cooldown: Math.floor(v.cooldown),
        min_percentage: Number(v.min_percentage.toFixed(2)),
        max_percentage: Number(v.max_percentage.toFixed(2)),
        required_roles: v.required_roles.map((r) => String(r).trim().slice(0, 40)),
      };
      // Only persist the copy/image fields when they're non-empty so the bot
      // keeps falling back to its hardcoded defaults for anything the admin
      // didn't explicitly customize.
      for (const f of ['success_title', 'success_footer', 'success_image', 'fail_title', 'fail_description', 'fail_image'] as const) {
        if (typeof v[f] === 'string' && v[f]!.trim().length > 0) doc[f] = v[f]!.trim().slice(0, 500);
      }
      update['data.steal_system'] = doc;
    }
  }

  // Bump asset_versions for any R2 image URL the admin saved so Butler's
  // bustAssetUrl appends ?v=<ts>, forcing Discord's proxy to re-fetch.
  // Without this, a swapped image URL only refreshes once Discord's cache expires.
  const imageKeysToVersion: string[] = [];
  if (section === 'steal_system' && !err) {
    const v = value as StealSystemDoc;
    const R2_BASE = 'https://assets.lunarian.app/';
    for (const url of [v.success_image, v.fail_image]) {
      if (typeof url === 'string' && url.startsWith(R2_BASE)) {
        const key = url.slice(R2_BASE.length).split('?')[0];
        if (key) imageKeysToVersion.push(key);
      }
    }
  }

  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const docId = SECTION_TO_DOC[section];

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');
    const before = await col.findOne({ _id: docId as any });
    await col.updateOne(
      { _id: docId as any },
      { $set: { ...update, updatedAt: new Date(), updatedBy: adminId } },
      { upsert: true },
    );

    if (imageKeysToVersion.length > 0) {
      const now = Date.now();
      const versionSet: Record<string, number> = {};
      for (const key of imageKeysToVersion) versionSet[`data.${key}`] = now;
      await col.updateOne(
        { _id: 'asset_versions' as any },
        { $set: { ...versionSet, updatedAt: new Date() } },
        { upsert: true },
      );
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: `economy_${section}_update`,
      before: { [section]: (before?.data as any)?.[section] ?? null },
      after: update,
      metadata: { section, doc: docId },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Economy config PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
