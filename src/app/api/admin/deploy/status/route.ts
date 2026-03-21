import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const project = req.nextUrl.searchParams.get('project');
  const path = project ? `/deploy/status?project=${encodeURIComponent(project)}` : '/deploy/status';

  const res = await agentFetch(path, { timeout: 5000 });
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to get deploy status' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}
