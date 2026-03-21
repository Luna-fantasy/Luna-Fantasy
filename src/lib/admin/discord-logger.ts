import type { TransactionRecord } from '@/types/bazaar';

const DISCORD_API = 'https://discord.com/api/v10';

// Log channel IDs (same channels the bots use)
const CHANNELS = {
  lunari: '1448928321240039557',
  cards: '1448928494900875314',
  stones: '1450536515305214064',
};

// Color mapping matching bot logger colors
const TYPE_COLORS: Record<string, { color: number; emoji: string }> = {
  luckbox_spend: { color: 0xfee75c, emoji: '\u{1F4E6}' },
  stonebox_spend: { color: 0x9b59b6, emoji: '\u{1F4E6}' },
  marketplace_buy: { color: 0x3498db, emoji: '\u{1F4B3}' },
  marketplace_sell: { color: 0x57f287, emoji: '\u{1F4B5}' },
  stripe_purchase: { color: 0x00ff00, emoji: '\u{1F4B0}' },
  seluna_purchase: { color: 0x9b59b6, emoji: '\u{1F319}' },
  brimor_purchase: { color: 0x9b59b6, emoji: '\u{1F319}' },
  mells_purchase: { color: 0xff6600, emoji: '\u{1F6D2}' },
  ticket_spend: { color: 0xff6600, emoji: '\u{1F3AB}' },
  refund: { color: 0xff0000, emoji: '\u{1F4B8}' },
  bank_daily: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_loan_taken: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_loan_repaid: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_loan_partial_repaid: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_investment_deposit: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_investment_withdraw: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_insurance: { color: 0xffff00, emoji: '\u{1F3E6}' },
  bank_debt_paid: { color: 0xffff00, emoji: '\u{1F3E6}' },
  trade_win: { color: 0x57f287, emoji: '\u{1F4B0}' },
  trade_loss: { color: 0xed4245, emoji: '\u{1F4B8}' },
  swap_received: { color: 0xe91e63, emoji: '\u{1F504}' },
  admin_reversal: { color: 0xff0000, emoji: '\u{26A0}\u{FE0F}' },
};

function getChannelForType(type: string): string {
  if (type.startsWith('card_')) return CHANNELS.cards;
  if (type.startsWith('stone_')) return CHANNELS.stones;
  return CHANNELS.lunari;
}

function getToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN ?? null;
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString('en-US');
}

/**
 * Escape Discord markdown/mentions to prevent embed injection.
 * Strips @everyone, @here, <@mentions>, and excessive markdown.
 */
function escapeDiscord(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/@(everyone|here)/gi, '@\u200B$1')
    .replace(/<@[!&]?\d+>/g, '[mention]')
    .replace(/<#\d+>/g, '[channel]')
    .replace(/<@&\d+>/g, '[role]')
    .slice(0, 200);
}

export async function sendTransactionEmbed(record: Omit<TransactionRecord, '_id'>): Promise<void> {
  const token = getToken();
  if (!token) return;

  const channelId = getChannelForType(record.type);
  const typeInfo = TYPE_COLORS[record.type] ?? { color: 0x48d8ff, emoji: '\u{1F4B0}' };

  const typeName = record.type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // discordId is validated as snowflake upstream, safe for mention
  const fields: string[] = [
    `**User**`,
    `**Mention:** <@${record.discordId}>`,
    `**ID:** ${record.discordId}`,
    '',
    `**Transaction**`,
    `**Type:** ${typeName}`,
    `**Amount:** ${formatAmount(record.amount)} Lunari`,
    `**Balance:** ${record.balanceBefore.toLocaleString('en-US')} \u2192 ${record.balanceAfter.toLocaleString('en-US')} Lunari`,
  ];

  // Add metadata details (escaped to prevent embed injection)
  const meta = record.metadata;
  if (meta.cardName) fields.push(`**Card:** ${escapeDiscord(meta.cardName)}`);
  if (meta.stoneName) fields.push(`**Stone:** ${escapeDiscord(meta.stoneName)}`);
  if (meta.itemReceived) fields.push(`**Item:** ${escapeDiscord(meta.itemReceived)}`);
  if (meta.itemRarity) fields.push(`**Rarity:** ${escapeDiscord(meta.itemRarity)}`);
  if (meta.reason) fields.push(`**Reason:** ${escapeDiscord(meta.reason)}`);

  const embed = {
    color: typeInfo.color,
    title: `${typeInfo.emoji} [WEB] ${typeName}`,
    description: fields.join('\n'),
    footer: { text: 'Source: lunarian.app' },
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch {
    // fire-and-forget
  }
}
