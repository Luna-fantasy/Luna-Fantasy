import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';
const DOC_ID = 'butler_banking';

// Canonical defaults — mirror of LunaButlerMain/config.ts:406-435 banker_system
// + a new `persona` block for Avelle Adar that the bot currently hardcodes in
// commands/banker_commands.ts. The bot will be updated in a follow-up to read
// the persona from DB; until then the dashboard is the single source of truth
// for admin edits while the bot keeps showing its hardcoded copy.
const AVELLE_DEFAULTS = {
  persona: {
    name: 'Avelle Adar',
    title: 'Lord Treasurer of Luna',
    description:
      "I'm Avelle Adar. Owner of the bank of Luna. I offer loans, trading, and insurance services.",
    portrait: 'https://assets.lunarian.app/butler/misc/Avelle-Adar.png',
    portraitVersion: 1,
  },
  enabled: true,
  trade_level: 1,
  loan_tiers: [
    { level: 1, amount: 5000,   interest: 0.20, duration: 604800000 },
    { level: 1, amount: 10000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 15000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 20000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 25000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 30000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 40000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 50000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 75000,  interest: 0.20, duration: 604800000 },
    { level: 1, amount: 100000, interest: 0.20, duration: 604800000 },
    { level: 1, amount: 150000, interest: 0.20, duration: 604800000, passport_required: true },
  ],
  investor_interest: 0.15,
  insurance_types: [
    { name: 'حماية من السرقة', type: 'steal_protection', price: 500000, duration: -1 },
  ],
  investment: {
    maturity_period: 2592000000,   // 30d
    profit_rate: 0.30,
    min_amount: 20000,
    early_withdrawal_fee: 5000,
    check_interval: 900000,        // 15m
  },
  overdue_debt_role_id: '1450896401650155641',
  investor_deposit_role_id: '1450899585206845470',
};

interface LoanTier {
  level: number;
  amount: number;
  interest: number;
  duration: number;
  passport_required?: boolean;
}

interface InsuranceType {
  name: string;
  type: string;
  price: number;
  duration: number; // -1 = lifetime
}

function mergeBanking(stored: any): typeof AVELLE_DEFAULTS {
  const d = AVELLE_DEFAULTS;
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    persona: { ...d.persona, ...(s.persona ?? {}) },
    enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
    trade_level: typeof s.trade_level === 'number' ? s.trade_level : d.trade_level,
    loan_tiers: Array.isArray(s.loan_tiers) && s.loan_tiers.length > 0 ? s.loan_tiers : d.loan_tiers,
    investor_interest: typeof s.investor_interest === 'number' ? s.investor_interest : d.investor_interest,
    insurance_types: Array.isArray(s.insurance_types) && s.insurance_types.length > 0 ? s.insurance_types : d.insurance_types,
    investment: { ...d.investment, ...(s.investment ?? {}) },
    overdue_debt_role_id: typeof s.overdue_debt_role_id === 'string' ? s.overdue_debt_role_id : d.overdue_debt_role_id,
    investor_deposit_role_id: typeof s.investor_deposit_role_id === 'string' ? s.investor_deposit_role_id : d.investor_deposit_role_id,
  };
}

function validateLoanTiers(tiers: unknown): string | null {
  if (!Array.isArray(tiers)) return 'loan_tiers must be an array';
  if (tiers.length > 30) return 'too many loan tiers (max 30)';
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i] as any;
    if (!t || typeof t !== 'object') return `loan_tiers[${i}] must be an object`;
    if (typeof t.amount !== 'number' || t.amount < 1 || t.amount > 100_000_000) return `loan_tiers[${i}].amount must be 1-100,000,000`;
    if (typeof t.interest !== 'number' || t.interest < 0 || t.interest > 2) return `loan_tiers[${i}].interest must be 0-2 (e.g. 0.20 = 20%)`;
    if (typeof t.duration !== 'number' || t.duration < 60_000 || t.duration > 31_536_000_000) return `loan_tiers[${i}].duration must be 1min-1yr in ms`;
    if (typeof t.level !== 'number' || t.level < 0 || t.level > 200) return `loan_tiers[${i}].level must be 0-200`;
  }
  return null;
}

function validateInsurance(types: unknown): string | null {
  if (!Array.isArray(types)) return 'insurance_types must be an array';
  if (types.length > 20) return 'too many insurance types (max 20)';
  for (let i = 0; i < types.length; i++) {
    const t = types[i] as any;
    if (!t || typeof t !== 'object') return `insurance_types[${i}] must be an object`;
    if (typeof t.name !== 'string' || !t.name.trim()) return `insurance_types[${i}].name required`;
    if (typeof t.type !== 'string' || !t.type.trim()) return `insurance_types[${i}].type required (e.g. steal_protection)`;
    if (typeof t.price !== 'number' || t.price < 0 || t.price > 100_000_000) return `insurance_types[${i}].price must be 0-100,000,000`;
    if (typeof t.duration !== 'number' || (t.duration !== -1 && (t.duration < 0 || t.duration > 31_536_000_000))) return `insurance_types[${i}].duration must be -1 (lifetime) or 0-1yr in ms`;
  }
  return null;
}

function validatePersona(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'persona must be an object';
  const x = p as any;
  if (typeof x.name !== 'string' || x.name.trim().length < 1 || x.name.length > 80) return 'persona.name 1-80 chars required';
  if (typeof x.title !== 'string' || x.title.length > 120) return 'persona.title max 120 chars';
  if (typeof x.description !== 'string' || x.description.length > 800) return 'persona.description max 800 chars';
  if (typeof x.portrait !== 'string' || x.portrait.length > 500) return 'persona.portrait URL max 500 chars';
  if (x.portrait && !/^https?:\/\//.test(x.portrait)) return 'persona.portrait must be http(s) URL';
  return null;
}

function validateInvestment(inv: unknown): string | null {
  if (!inv || typeof inv !== 'object') return 'investment must be an object';
  const i = inv as any;
  if (typeof i.profit_rate !== 'number' || i.profit_rate < 0 || i.profit_rate > 5) return 'investment.profit_rate must be 0-5 (e.g. 0.30 = 30%)';
  if (typeof i.min_amount !== 'number' || i.min_amount < 1 || i.min_amount > 100_000_000) return 'investment.min_amount must be 1-100,000,000';
  if (typeof i.maturity_period !== 'number' || i.maturity_period < 60_000 || i.maturity_period > 31_536_000_000) return 'investment.maturity_period 1min-1yr in ms';
  if (typeof i.early_withdrawal_fee !== 'number' || i.early_withdrawal_fee < 0 || i.early_withdrawal_fee > 100_000_000) return 'investment.early_withdrawal_fee must be 0-100,000,000';
  if (typeof i.check_interval !== 'number' || i.check_interval < 60_000 || i.check_interval > 86_400_000) return 'investment.check_interval 1min-1d in ms';
  return null;
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const doc = await client.db(DB_NAME).collection('bot_config').findOne({ _id: DOC_ID as any });
    const merged = mergeBanking(doc?.data ?? {});
    return NextResponse.json({
      ...merged,
      updatedAt: doc?.updatedAt ?? null,
      updatedBy: doc?.updatedBy ?? null,
    });
  } catch (err) {
    console.error('Banking config GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

type Section = 'persona' | 'loan_tiers' | 'insurance_types' | 'investment' | 'core';

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

  let err: string | null = null;
  let update: Record<string, any> = {};

  if (section === 'persona') {
    err = validatePersona(value);
    if (!err) {
      const p = value as any;
      update['data.persona'] = {
        name: p.name.trim().slice(0, 80),
        title: p.title.trim().slice(0, 120),
        description: p.description.trim().slice(0, 800),
        portrait: p.portrait.trim().slice(0, 500).split('?')[0],
        portraitVersion: typeof p.portraitVersion === 'number' ? Math.floor(p.portraitVersion) : Date.now(),
      };
    }
  } else if (section === 'loan_tiers') {
    err = validateLoanTiers(value);
    if (!err) {
      update['data.loan_tiers'] = (value as LoanTier[]).map((t) => ({
        level: Math.floor(t.level),
        amount: Math.floor(t.amount),
        interest: Number(t.interest.toFixed(4)),
        duration: Math.floor(t.duration),
        ...(t.passport_required ? { passport_required: true } : {}),
      }));
    }
  } else if (section === 'insurance_types') {
    err = validateInsurance(value);
    if (!err) {
      update['data.insurance_types'] = (value as InsuranceType[]).map((t) => ({
        name: t.name.trim().slice(0, 120),
        type: t.type.trim().slice(0, 60),
        price: Math.floor(t.price),
        duration: Math.floor(t.duration),
      }));
    }
  } else if (section === 'investment') {
    err = validateInvestment(value);
    if (!err) {
      const i = value as any;
      update['data.investment'] = {
        profit_rate: Number(i.profit_rate.toFixed(4)),
        min_amount: Math.floor(i.min_amount),
        maturity_period: Math.floor(i.maturity_period),
        early_withdrawal_fee: Math.floor(i.early_withdrawal_fee),
        check_interval: Math.floor(i.check_interval),
      };
    }
  } else if (section === 'core') {
    // enabled, trade_level, investor_interest, role IDs
    const v = value as any;
    if (typeof v !== 'object' || v === null) err = 'core value must be an object';
    if (!err && v.enabled !== undefined && typeof v.enabled !== 'boolean') err = 'core.enabled must be boolean';
    if (!err && v.trade_level !== undefined && (typeof v.trade_level !== 'number' || v.trade_level < 0 || v.trade_level > 200)) err = 'core.trade_level must be 0-200';
    if (!err && v.investor_interest !== undefined && (typeof v.investor_interest !== 'number' || v.investor_interest < 0 || v.investor_interest > 5)) err = 'core.investor_interest must be 0-5';
    if (!err && v.overdue_debt_role_id !== undefined && typeof v.overdue_debt_role_id !== 'string') err = 'core.overdue_debt_role_id must be string';
    if (!err && v.investor_deposit_role_id !== undefined && typeof v.investor_deposit_role_id !== 'string') err = 'core.investor_deposit_role_id must be string';
    if (!err) {
      if (v.enabled !== undefined) update['data.enabled'] = v.enabled;
      if (v.trade_level !== undefined) update['data.trade_level'] = Math.floor(v.trade_level);
      if (v.investor_interest !== undefined) update['data.investor_interest'] = Number(v.investor_interest.toFixed(4));
      if (v.overdue_debt_role_id !== undefined) update['data.overdue_debt_role_id'] = v.overdue_debt_role_id.trim().slice(0, 40);
      if (v.investor_deposit_role_id !== undefined) update['data.investor_deposit_role_id'] = v.investor_deposit_role_id.trim().slice(0, 40);
    }
  } else {
    err = `unknown section: ${section}`;
  }

  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');
    const before = await col.findOne({ _id: DOC_ID as any });
    await col.updateOne(
      { _id: DOC_ID as any },
      { $set: { ...update, updatedAt: new Date(), updatedBy: adminId } },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: `banking_${section}_update`,
      before: { [section]: (before?.data as any)?.[section === 'core' ? 'enabled' : section] },
      after: update,
      metadata: { section },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Banking config PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
