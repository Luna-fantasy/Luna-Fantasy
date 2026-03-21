import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const res = await agentFetch('/health', { timeout: 5000 });
  if (!res.ok) {
    return NextResponse.json({ online: false, error: res.data?.error }, { status: 502 });
  }
  return NextResponse.json({ online: true, ...res.data });
}
