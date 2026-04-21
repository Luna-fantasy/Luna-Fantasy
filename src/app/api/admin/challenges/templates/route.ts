import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp, hasMongoOperator } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

const DB = 'Database';
const COL = 'bot_config';
const DOC_ID = 'challenge_templates';
const MAX_TEMPLATES = 20;
const VALID_TYPES = ['image', 'text', 'link'] as const;
const MAX_REWARD = 1_000_000;

interface ChallengeTemplate {
  id: string;
  name: string;
  type: 'image' | 'text' | 'link';
  description?: string;
  reward1st?: number;
  reward2nd?: number;
  reward3rd?: number;
  duration?: number;
  createdBy: string;
  createdAt: Date;
}

async function getTemplatesDoc() {
  const client = await clientPromise;
  const col = client.db(DB).collection(COL);
  const doc = await col.findOne({ _id: DOC_ID as any });
  return { col, doc };
}

// GET: Return all saved templates
export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_templates', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const { doc } = await getTemplatesDoc();
    return NextResponse.json({ templates: doc?.templates ?? [] });
  } catch (error) {
    console.error('Challenge templates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add a new template
export async function POST(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_templates_write', adminId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const body = await req.json();

    if (hasMongoOperator(body)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, type, description, reward1st, reward2nd, reward3rd, duration } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Invalid name (1-100 chars)' }, { status: 400 });
    }

    // Validate type
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type (must be image, text, or link)' }, { status: 400 });
    }

    // Validate description if provided
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.length > 500) {
        return NextResponse.json({ error: 'Invalid description (max 500 chars)' }, { status: 400 });
      }
    }

    // Validate rewards if provided
    for (const [field, value] of [['reward1st', reward1st], ['reward2nd', reward2nd], ['reward3rd', reward3rd]] as const) {
      if (value !== undefined && value !== null) {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > MAX_REWARD) {
          return NextResponse.json({ error: `Invalid ${field} (0-${MAX_REWARD})` }, { status: 400 });
        }
      }
    }

    // Validate duration if provided
    if (duration !== undefined && duration !== null) {
      const num = Number(duration);
      if (isNaN(num) || num < 0 || num > 720) {
        return NextResponse.json({ error: 'Invalid duration (0-720 hours)' }, { status: 400 });
      }
    }

    const { col, doc } = await getTemplatesDoc();
    const existing: ChallengeTemplate[] = doc?.templates ?? [];

    if (existing.length >= MAX_TEMPLATES) {
      return NextResponse.json({ error: `Maximum ${MAX_TEMPLATES} templates reached` }, { status: 409 });
    }

    // Sanitize name and description
    const sanitizedName = name.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/```/g, '').trim();
    const sanitizedDesc = description
      ? String(description).replace(/@(everyone|here)/gi, '@\u200b$1').replace(/```/g, '').slice(0, 500)
      : undefined;

    const template: ChallengeTemplate = {
      id: Date.now().toString(36),
      name: sanitizedName,
      type,
      createdBy: adminId,
      createdAt: new Date(),
    };

    if (sanitizedDesc) template.description = sanitizedDesc;

    const r1 = Math.min(Math.floor(Number(reward1st) || 0), MAX_REWARD);
    const r2 = Math.min(Math.floor(Number(reward2nd) || 0), MAX_REWARD);
    const r3 = Math.min(Math.floor(Number(reward3rd) || 0), MAX_REWARD);
    if (r1 > 0) template.reward1st = r1;
    if (r2 > 0) template.reward2nd = r2;
    if (r3 > 0) template.reward3rd = r3;

    if (duration && Number(duration) > 0) {
      template.duration = Number(duration);
    }

    await col.updateOne(
      { _id: DOC_ID as any },
      { $push: { templates: template } as any },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'challenge_template_create',
      before: null,
      after: { name: sanitizedName, type, id: template.id },
      metadata: { templateCount: existing.length + 1 },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      template,
      message: `Template "${sanitizedName}" saved.`,
    });
  } catch (error) {
    console.error('Challenge templates POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a template by ID
export async function DELETE(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_templates_write', adminId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const body = await req.json();

    if (hasMongoOperator(body)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { templateId } = body;

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
    }

    const { col, doc } = await getTemplatesDoc();
    const existing: ChallengeTemplate[] = doc?.templates ?? [];
    const target = existing.find(t => t.id === templateId);

    if (!target) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await col.updateOne(
      { _id: DOC_ID as any },
      { $pull: { templates: { id: templateId } } as any },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'challenge_template_delete',
      before: { name: target.name, type: target.type, id: target.id },
      after: null,
      metadata: { templateCount: existing.length - 1 },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Template "${target.name}" deleted.`,
    });
  } catch (error) {
    console.error('Challenge templates DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
