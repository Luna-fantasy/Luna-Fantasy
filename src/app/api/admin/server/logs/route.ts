import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const name = req.nextUrl.searchParams.get('name');
  const lines = Math.min(5000, Math.max(1, parseInt(req.nextUrl.searchParams.get('lines') || '200', 10)));

  if (!name) {
    return NextResponse.json({ error: 'Process name required' }, { status: 400 });
  }

  const res = await agentFetch(`/pm2/logs/${encodeURIComponent(name)}?lines=${lines}`, { timeout: 15000 });
  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'Failed to get logs' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}
