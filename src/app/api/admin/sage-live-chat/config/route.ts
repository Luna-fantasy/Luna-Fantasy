import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const ALLOWED_SECTIONS = [
  'autoJoinEnabled',
  'reactionsEnabled',
  'periodicCheckIn',
  'mastermindOnly',
  'reactionProbability',
  'autoJoinCooldownMinutes',
  'checkInInterval',
  'liveChatChannels',
  'aiCooldownSeconds',
  'reactionCooldownSeconds',
  'userReactionLimit',
  'userReactionWindowMinutes',
  'userHelpOfferCooldownMinutes',
  'userGreetingCooldownMinutes',
  'greetingCooldownSeconds',
  'helpOfferCooldownSeconds',
  'unansweredQuestionDelaySeconds',
  'lunaKeywords',
  'helpOfferTemplates',
  'greetingTemplates',
  'reactionEmojis',
  'channelReferences',
] as const;

type Section = (typeof ALLOWED_SECTIONS)[number];

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const doc = await db.collection('bot_config').findOne({ _id: 'sage_live_chat' as any });

    // Defaults aligned with bot's live_config.js LIVE_CHAT_DEFAULTS
    const defaults = {
      autoJoinEnabled: true,
      reactionsEnabled: true,
      periodicCheckIn: true,
      mastermindOnly: false,
      reactionProbability: 0.3,
      autoJoinCooldownMinutes: 3,
      checkInInterval: 20,
      liveChatChannels: [] as string[],
      aiCooldownSeconds: 8,
      reactionCooldownSeconds: 30,
      userReactionLimit: 3,
      userReactionWindowMinutes: 5,
      userHelpOfferCooldownMinutes: 2,
      userGreetingCooldownMinutes: 5,
      greetingCooldownSeconds: 60,
      helpOfferCooldownSeconds: 30,
      unansweredQuestionDelaySeconds: 60,
      lunaKeywords: [
        'لونا', 'القمر', 'اللوناري', 'العقل المدبر', 'الحارس', 'الفارس',
        'النبيل', 'لونفور', 'الحراس', 'الفرسان', 'النبلاء',
        'كايل', 'ميلونا', 'زولدار', 'سيلونا', 'بريمور', 'كورين',
        'فانتاسي', 'قراند فانتاسي', 'حرب الفصائل', 'أحجار القمر', 'بطاقات لونا',
        'luna', 'lunarian', 'mastermind', 'sentinel', 'guardian', 'knight',
        'noble', 'lunvor', 'kael', 'meluna', 'zoldar', 'seluna', 'primor',
        'fantasy', 'faction war', 'moon stones', 'luna cards',
      ] as string[],
      helpOfferTemplates: {
        mastermind: [
          "سيدي العقل المدبر، عندي تفاصيل عن هالموضوع لو تحب أشرحلك 🌙",
          "سيدي العقل المدبر، أقدر أفيدك بهذا لو تبي 🌙",
          "سيدي العقل المدبر، عندي معلومات عن هذا، تبي أوضحلك؟ 🌙",
        ],
        privileged: [
          "عندي تفاصيل عن هالموضوع لو تبي أشرحلك 🌙",
          "أقدر أساعدك بهذا، تبي؟ 🌙",
          "عندي معلومات عن هذا لو تحب أوضحلك 🌙",
        ],
        lunarian: [
          "أقدر أشرحلك عن هذا، تبي؟ 🌙",
          "تبي أفيدك؟ أعرف كثير عن هالموضوع 🌙",
          "عندي تفاصيل عن هذا لو تبي يا اللوناري 🌙",
        ],
        default: [
          "عندي معلومات عن هالموضوع لو تبي أفيدك 🌙",
          "أقدر أساعدك بهذا، تبي أشرحلك؟ 🌙",
          "تبي أفيدك بهذا؟ 🌙",
        ],
      },
      greetingTemplates: {
        arabic: [
          "وعليكم السلام 👋",
          "هلا وغلا 👋",
          "أهلاً! 👋",
          "حياك الله 👋",
        ],
        english: [
          "Hey! 👋",
          "Hello! 👋",
          "Hi there! 👋",
        ],
      },
      reactionEmojis: {
        luna: "🌙",
        question: "🤔",
        greeting: "👋",
        excitement: "🔥",
      },
      channelReferences: [] as { channelId: string; name: string; description: string }[],
    };

    if (!doc) {
      return NextResponse.json(defaults);
    }

    const data = doc.data ?? {};
    return NextResponse.json({
      autoJoinEnabled: data.autoJoinEnabled ?? defaults.autoJoinEnabled,
      reactionsEnabled: data.reactionsEnabled ?? defaults.reactionsEnabled,
      periodicCheckIn: data.periodicCheckIn ?? defaults.periodicCheckIn,
      mastermindOnly: data.mastermindOnly ?? defaults.mastermindOnly,
      reactionProbability: data.reactionProbability ?? defaults.reactionProbability,
      autoJoinCooldownMinutes: data.autoJoinCooldownMinutes ?? defaults.autoJoinCooldownMinutes,
      checkInInterval: data.checkInInterval ?? defaults.checkInInterval,
      liveChatChannels: data.liveChatChannels ?? defaults.liveChatChannels,
      aiCooldownSeconds: data.aiCooldownSeconds ?? defaults.aiCooldownSeconds,
      reactionCooldownSeconds: data.reactionCooldownSeconds ?? defaults.reactionCooldownSeconds,
      userReactionLimit: data.userReactionLimit ?? defaults.userReactionLimit,
      userReactionWindowMinutes: data.userReactionWindowMinutes ?? defaults.userReactionWindowMinutes,
      userHelpOfferCooldownMinutes: data.userHelpOfferCooldownMinutes ?? defaults.userHelpOfferCooldownMinutes,
      userGreetingCooldownMinutes: data.userGreetingCooldownMinutes ?? defaults.userGreetingCooldownMinutes,
      greetingCooldownSeconds: data.greetingCooldownSeconds ?? defaults.greetingCooldownSeconds,
      helpOfferCooldownSeconds: data.helpOfferCooldownSeconds ?? defaults.helpOfferCooldownSeconds,
      unansweredQuestionDelaySeconds: data.unansweredQuestionDelaySeconds ?? defaults.unansweredQuestionDelaySeconds,
      lunaKeywords: data.lunaKeywords ?? defaults.lunaKeywords,
      helpOfferTemplates: data.helpOfferTemplates ?? defaults.helpOfferTemplates,
      greetingTemplates: data.greetingTemplates ?? defaults.greetingTemplates,
      reactionEmojis: data.reactionEmojis ?? defaults.reactionEmojis,
      channelReferences: data.channelReferences ?? defaults.channelReferences,
    });
  } catch (err) {
    console.error('[sage-live-chat/config] GET error:', err);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const adminUsername = auth.session.user.username ?? 'unknown';

  const { allowed, retryAfterMs } = checkRateLimit('sage_live_chat_config', adminId, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { section, value } = body;

    if (!section || typeof section !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid section' }, { status: 400 });
    }

    if (!ALLOWED_SECTIONS.includes(section as Section)) {
      return NextResponse.json(
        { error: `Invalid section. Allowed: ${ALLOWED_SECTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    if (value === undefined) {
      return NextResponse.json({ error: 'Missing value' }, { status: 400 });
    }

    // Check for NoSQL injection in object values
    if (typeof value === 'object' && value !== null && hasMongoOperator(value)) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
    }

    // Type validation per section
    switch (section) {
      case 'autoJoinEnabled':
      case 'reactionsEnabled':
      case 'periodicCheckIn':
      case 'mastermindOnly':
        if (typeof value !== 'boolean') {
          return NextResponse.json({ error: `${section} must be a boolean` }, { status: 400 });
        }
        break;
      case 'reactionProbability':
        if (typeof value !== 'number' || value < 0 || value > 1) {
          return NextResponse.json(
            { error: 'reactionProbability must be a number between 0 and 1' },
            { status: 400 },
          );
        }
        break;
      case 'autoJoinCooldownMinutes':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
          return NextResponse.json(
            { error: 'autoJoinCooldownMinutes must be an integer between 1 and 30' },
            { status: 400 },
          );
        }
        break;
      case 'checkInInterval':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 5 || value > 100) {
          return NextResponse.json(
            { error: 'checkInInterval must be an integer between 5 and 100' },
            { status: 400 },
          );
        }
        break;
      case 'liveChatChannels':
        if (!Array.isArray(value) || !value.every((v: any) => typeof v === 'string' && /^\d{17,20}$/.test(v))) {
          return NextResponse.json(
            { error: 'liveChatChannels must be an array of Discord channel ID strings' },
            { status: 400 },
          );
        }
        break;
      case 'aiCooldownSeconds':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
          return NextResponse.json(
            { error: 'aiCooldownSeconds must be an integer between 1 and 30' },
            { status: 400 },
          );
        }
        break;
      case 'reactionCooldownSeconds':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 5 || value > 120) {
          return NextResponse.json(
            { error: 'reactionCooldownSeconds must be an integer between 5 and 120' },
            { status: 400 },
          );
        }
        break;
      case 'userReactionLimit':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
          return NextResponse.json(
            { error: 'userReactionLimit must be an integer between 1 and 20' },
            { status: 400 },
          );
        }
        break;
      case 'userReactionWindowMinutes':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
          return NextResponse.json(
            { error: 'userReactionWindowMinutes must be an integer between 1 and 30' },
            { status: 400 },
          );
        }
        break;
      case 'userHelpOfferCooldownMinutes':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
          return NextResponse.json(
            { error: 'userHelpOfferCooldownMinutes must be an integer between 1 and 10' },
            { status: 400 },
          );
        }
        break;
      case 'userGreetingCooldownMinutes':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 30) {
          return NextResponse.json(
            { error: 'userGreetingCooldownMinutes must be an integer between 1 and 30' },
            { status: 400 },
          );
        }
        break;
      case 'greetingCooldownSeconds':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 10 || value > 300) {
          return NextResponse.json(
            { error: 'greetingCooldownSeconds must be an integer between 10 and 300' },
            { status: 400 },
          );
        }
        break;
      case 'helpOfferCooldownSeconds':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 10 || value > 300) {
          return NextResponse.json(
            { error: 'helpOfferCooldownSeconds must be an integer between 10 and 300' },
            { status: 400 },
          );
        }
        break;
      case 'unansweredQuestionDelaySeconds':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 15 || value > 300) {
          return NextResponse.json(
            { error: 'unansweredQuestionDelaySeconds must be an integer between 15 and 300' },
            { status: 400 },
          );
        }
        break;
      case 'lunaKeywords':
        if (!Array.isArray(value) || value.length > 100 || !value.every((v: any) => typeof v === 'string' && v.length <= 50)) {
          return NextResponse.json(
            { error: 'lunaKeywords must be an array of strings (max 100 items, each max 50 chars)' },
            { status: 400 },
          );
        }
        break;
      case 'helpOfferTemplates': {
        const validKeys = ['mastermind', 'privileged', 'lunarian', 'default'];
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return NextResponse.json({ error: 'helpOfferTemplates must be an object with mastermind, privileged, lunarian, default arrays' }, { status: 400 });
        }
        for (const k of validKeys) {
          if (value[k] !== undefined && (!Array.isArray(value[k]) || !value[k].every((v: any) => typeof v === 'string' && v.length <= 200))) {
            return NextResponse.json({ error: `helpOfferTemplates.${k} must be an array of strings (each max 200 chars)` }, { status: 400 });
          }
        }
        break;
      }
      case 'greetingTemplates': {
        const validLangKeys = ['arabic', 'english'];
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return NextResponse.json({ error: 'greetingTemplates must be an object with arabic and english arrays' }, { status: 400 });
        }
        for (const k of validLangKeys) {
          if (value[k] !== undefined && (!Array.isArray(value[k]) || !value[k].every((v: any) => typeof v === 'string' && v.length <= 200))) {
            return NextResponse.json({ error: `greetingTemplates.${k} must be an array of strings (each max 200 chars)` }, { status: 400 });
          }
        }
        break;
      }
      case 'reactionEmojis': {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return NextResponse.json({ error: 'reactionEmojis must be an object with string values' }, { status: 400 });
        }
        const emojiKeys = ['luna', 'question', 'greeting', 'excitement'];
        for (const k of emojiKeys) {
          if (value[k] !== undefined && (typeof value[k] !== 'string' || value[k].length > 10)) {
            return NextResponse.json({ error: `reactionEmojis.${k} must be a string (max 10 chars)` }, { status: 400 });
          }
        }
        break;
      }
      case 'channelReferences': {
        if (!Array.isArray(value) || value.length > 20) {
          return NextResponse.json({ error: 'channelReferences must be an array (max 20 items)' }, { status: 400 });
        }
        for (const ref of value) {
          if (typeof ref !== 'object' || ref === null) {
            return NextResponse.json({ error: 'Each channel reference must be an object' }, { status: 400 });
          }
          if (typeof ref.channelId !== 'string' || !/^\d{17,20}$/.test(ref.channelId)) {
            return NextResponse.json({ error: 'Each channel reference must have a valid channelId' }, { status: 400 });
          }
          if (typeof ref.name !== 'string' || ref.name.length < 1 || ref.name.length > 100) {
            return NextResponse.json({ error: 'Each channel reference must have a name (1-100 chars)' }, { status: 400 });
          }
          if (typeof ref.description !== 'string' || ref.description.length > 200) {
            return NextResponse.json({ error: 'Each channel reference description must be max 200 chars' }, { status: 400 });
          }
        }
        break;
      }
    }

    const client = await clientPromise;
    const db = client.db('Database');

    // Read current value for audit trail
    const currentDoc = await db.collection('bot_config').findOne({ _id: 'sage_live_chat' as any });
    const beforeValue = currentDoc?.data?.[section] ?? null;

    await db.collection('bot_config').updateOne(
      { _id: 'sage_live_chat' as any },
      {
        $set: {
          [`data.${section}`]: value,
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername,
      action: 'sage_live_chat_config_update',
      before: { [section]: beforeValue },
      after: { [section]: value },
      metadata: { section },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, section, value });
  } catch (err) {
    console.error('[sage-live-chat/config] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
