import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';
import { FOOTER_DEFAULTS, invalidateFooterCache, type FooterConfig } from '@/lib/admin/footer-defaults';

const DB = 'Database';
const MAX_COLUMNS = 6;
const MAX_LINKS_PER_COLUMN = 12;
const MAX_SOCIAL_LINKS = 8;
const MAX_STRING_LEN = 200;

function sanitize(val: string): string {
  return val.replace(/<[^>]*>/g, '').trim().slice(0, MAX_STRING_LEN);
}

function validateConfig(config: any): string | null {
  if (!config || typeof config !== 'object') return 'Invalid config object';

  // Columns
  if (!Array.isArray(config.columns)) return 'columns must be an array';
  if (config.columns.length > MAX_COLUMNS) return `Max ${MAX_COLUMNS} columns`;
  for (const col of config.columns) {
    if (!col.id || typeof col.id !== 'string') return 'Column missing id';
    if (typeof col.titleEn !== 'string' || typeof col.titleAr !== 'string') return 'Column missing title';
    if (typeof col.visible !== 'boolean') return 'Column missing visible flag';
    if (!Array.isArray(col.links)) return 'Column links must be an array';
    if (col.links.length > MAX_LINKS_PER_COLUMN) return `Max ${MAX_LINKS_PER_COLUMN} links per column`;
    for (const link of col.links) {
      if (typeof link.labelEn !== 'string' || typeof link.labelAr !== 'string') return 'Link missing label';
      if (typeof link.href !== 'string' || !link.href) return 'Link missing href';
      if (typeof link.external !== 'boolean') return 'Link missing external flag';
    }
  }

  // Social links
  if (!Array.isArray(config.socialLinks)) return 'socialLinks must be an array';
  if (config.socialLinks.length > MAX_SOCIAL_LINKS) return `Max ${MAX_SOCIAL_LINKS} social links`;
  for (const s of config.socialLinks) {
    if (typeof s.platform !== 'string' || typeof s.url !== 'string') return 'Social link missing platform/url';
    if (typeof s.visible !== 'boolean') return 'Social link missing visible flag';
  }

  // Payment icons
  if (!config.paymentIcons || typeof config.paymentIcons !== 'object') return 'paymentIcons required';

  // Legal links
  if (!Array.isArray(config.legalLinks)) return 'legalLinks must be an array';
  for (const l of config.legalLinks) {
    if (typeof l.key !== 'string' || typeof l.href !== 'string') return 'Legal link missing key/href';
    if (typeof l.visible !== 'boolean') return 'Legal link missing visible flag';
  }

  // Copyright
  if (typeof config.copyrightEn !== 'string' || typeof config.copyrightAr !== 'string') return 'Copyright text required';

  return null;
}

function sanitizeConfig(config: FooterConfig): FooterConfig {
  return {
    columns: config.columns.map(col => ({
      id: sanitize(col.id).replace(/[^a-zA-Z0-9_-]/g, ''),
      titleEn: sanitize(col.titleEn),
      titleAr: sanitize(col.titleAr),
      visible: !!col.visible,
      links: col.links.map(link => ({
        labelEn: sanitize(link.labelEn),
        labelAr: sanitize(link.labelAr),
        href: sanitize(link.href),
        external: !!link.external,
      })),
    })),
    socialLinks: config.socialLinks.map(s => ({
      platform: sanitize(s.platform).replace(/[^a-zA-Z0-9_-]/g, ''),
      url: sanitize(s.url),
      visible: !!s.visible,
    })),
    paymentIcons: {
      visa: !!config.paymentIcons?.visa,
      mastercard: !!config.paymentIcons?.mastercard,
      paypal: !!config.paymentIcons?.paypal,
    },
    legalLinks: config.legalLinks.map(l => ({
      key: sanitize(l.key).replace(/[^a-zA-Z0-9_-]/g, ''),
      labelEn: sanitize(l.labelEn || ''),
      labelAr: sanitize(l.labelAr || ''),
      href: sanitize(l.href),
      visible: !!l.visible,
    })),
    copyrightEn: sanitize(config.copyrightEn),
    copyrightAr: sanitize(config.copyrightAr),
    brandDescription: !!config.brandDescription,
  };
}

// GET: Return footer config (or defaults)
export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const doc = await client.db(DB).collection('bot_config').findOne({ _id: 'footer_config' as any });

    return NextResponse.json({
      config: doc?.config ?? FOOTER_DEFAULTS,
      metadata: doc ? { updatedAt: doc.updatedAt, updatedBy: doc.updatedBy } : null,
    });
  } catch (err) {
    console.error('[FooterConfig] GET error:', err);
    return NextResponse.json({ config: FOOTER_DEFAULTS, metadata: null });
  }
}

// PUT: Save footer config
export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_footer_config', adminId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const body = await req.json();
    const config = body.config as FooterConfig;

    const error = validateConfig(config);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const sanitized = sanitizeConfig(config);
    const adminName = auth.session.user?.globalName ?? 'Unknown';
    const ip = getClientIp(req);

    const client = await clientPromise;
    await client.db(DB).collection('bot_config').updateOne(
      { _id: 'footer_config' as any },
      { $set: { config: sanitized, updatedAt: new Date(), updatedBy: adminName } },
      { upsert: true },
    );

    invalidateFooterCache();

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: adminName,
      action: 'footer_config_update',
      before: null,
      after: { columns: sanitized.columns.length, socialLinks: sanitized.socialLinks.length },
      metadata: {},
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FooterConfig] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
