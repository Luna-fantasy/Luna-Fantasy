import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const res = await agentFetch('/pm2/list');
  if (!res.ok) {
    console.error('[server/status] VPS agent error:', res.data?.error);
    return NextResponse.json({ error: 'Failed to reach VPS agent' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}
