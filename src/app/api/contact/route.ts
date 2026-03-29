import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 3;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit('contact', ip, RATE_LIMITS.contact.maxRequests, RATE_LIMITS.contact.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const fd = await req.formData();
    const discord = fd.get('discord') as string | null;
    const reason = fd.get('reason') as string | null;
    const area = fd.get('area') as string | null;
    const message = fd.get('message') as string | null;
    const attachments = fd.getAll('attachments') as File[];

    if (!discord?.trim() || !reason || !area || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate attachments
    const validFiles = attachments
      .filter((f) => f instanceof File && f.size > 0 && f.type.startsWith('image/') && f.size <= MAX_SIZE)
      .slice(0, MAX_FILES);

    const reasonLabels: Record<string, string> = {
      bugReport: 'Bug Report',
      featureRequest: 'Feature Request',
      paymentIssue: 'Payment Issue',
      accountIssue: 'Account Issue',
      complaint: 'Complaint',
      partnership: 'Partnership',
    };

    const areaLabels: Record<string, string> = {
      lunaFantasy: 'Luna Fantasy',
      bank: 'Bank',
      bazaar: 'Bazaar',
      marketplace: 'Marketplace',
      auth: 'Authentication',
      website: 'Website',
      other: 'Other',
    };

    const subject = `[${reasonLabels[reason] || reason}] ${areaLabels[area] || area} — ${discord}`;

    const bodyLines = [
      `Discord: ${discord}`,
      `Reason: ${reasonLabels[reason] || reason}`,
      `Area: ${areaLabels[area] || area}`,
      `Attachments: ${validFiles.length}`,
      '',
      message,
    ];

    // Build email content parts
    const content: { type: string; value: string }[] = [];

    // Escape HTML entities to prevent injection via user input
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // HTML version with inline images
    const htmlLines = bodyLines.map((l) => (l === '' ? '<br>' : `<p>${escapeHtml(l).replace(/\n/g, '<br>')}</p>`));

    const inlineImages: { name: string; type: string; content: string }[] = [];
    for (const file of validFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const b64 = buffer.toString('base64');
      const cid = `attachment-${inlineImages.length}`;
      inlineImages.push({ name: file.name, type: file.type, content: b64 });
      htmlLines.push(`<p><strong>${file.name}</strong></p>`);
      htmlLines.push(`<img src="cid:${cid}" style="max-width:600px;border-radius:8px;" />`);
    }

    content.push({ type: 'text/plain', value: bodyLines.join('\n') });
    content.push({ type: 'text/html', value: htmlLines.join('\n') });

    const mailPayload: Record<string, unknown> = {
      personalizations: [{ to: [{ email: 'support@lunarian.app' }] }],
      from: { email: 'noreply@lunarian.app', name: 'Luna Contact Form' },
      subject,
      content,
    };

    // Attach images as inline attachments
    if (inlineImages.length > 0) {
      mailPayload.headers = { 'X-Entity-Ref-ID': `contact-${Date.now()}` };
      mailPayload.personalizations = [{
        to: [{ email: 'support@lunarian.app' }],
      }];
      // MailChannels attachment format
      mailPayload.attachments = inlineImages.map((img, i) => ({
        filename: img.name,
        content: img.content,
        type: img.type,
        disposition: 'inline',
        content_id: `attachment-${i}`,
      }));
    }

    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailPayload),
    });

    if (!res.ok) {
      console.error('Mail send failed:', res.status, await res.text());
      return NextResponse.json({ error: 'Failed to send' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
