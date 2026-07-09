import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';
import { gitCommitAndPush } from '@/lib/admin/config-writer';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const PROJECT_PATHS: Record<string, string> = {
  butler: process.env.BUTLER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaButlerMain',
  jester: process.env.JESTER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaJesterMain',
};

// The agent answers the deploy POST with {status:'started'} BEFORE pulling,
// installing, or building — so the history record must not claim success at
// that point. This detached verifier polls the agent's own /deploy/status for
// the terminal result (which includes build failures), with a PM2 uptime-reset
// check as fallback, and writes the truthful outcome into admin_deploys.
// Runs post-response — Railway keeps the Node process alive, same pattern as
// the fire-and-forget CDN purges.
async function recordTerminalStatus(
  insertedId: any,
  project: string,
  triggeredAt: Date,
  baseSteps: Array<Record<string, unknown>>,
  agentDeployId: string | undefined,
) {
  const client = await clientPromise;
  const db = client.db('Database');
  const finish = async (status: 'ok' | 'failed', step: Record<string, unknown>) => {
    const completedAt = new Date();
    await db.collection('admin_deploys').updateOne(
      { _id: insertedId },
      { $set: { status, completedAt, duration: completedAt.getTime() - triggeredAt.getTime(), steps: [...baseSteps, step] } }
    );
  };

  const deadline = Date.now() + 240_000;
  let sawRunning = false;
  let lastNote = 'no terminal status from agent before timeout';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15_000));
    try {
      const res = await agentFetch(`/deploy/status?project=${encodeURIComponent(project)}`, { timeout: 8000 });
      if (!res.ok) { lastNote = 'agent status endpoint unreachable'; continue; }
      const payload: any = res.data ?? {};
      const s = String(payload.status ?? '');
      // Guard against reading a PREVIOUS deploy's terminal status on the first
      // poll: only trust a terminal result once we've seen this deploy running,
      // or when the agent's deployId matches the one it minted for us.
      const idMatches = !agentDeployId || !payload.deployId || payload.deployId === agentDeployId;
      if (s === 'running' || s === 'started') { sawRunning = true; continue; }
      if ((s === 'success' || s === 'failed') && (sawRunning || idMatches)) {
        await finish(s === 'success' ? 'ok' : 'failed', {
          name: 'Agent Result',
          status: s === 'success' ? 'ok' : 'error',
          ...(Array.isArray(payload.steps) ? { agentSteps: payload.steps } : {}),
          ...(payload.error ? { error: String(payload.error).slice(0, 300) } : {}),
        });
        return;
      }
    } catch (e) {
      lastNote = (e as Error).message;
    }
  }

  // Fallback: the status endpoint never resolved — did the process restart?
  try {
    const res = await agentFetch('/pm2/list', { timeout: 8000 });
    const procs: any[] = Array.isArray((res.data as any)?.processes) ? (res.data as any).processes : [];
    const proc = procs.find((p) => String(p?.name ?? '').toLowerCase().includes(project));
    if (proc?.status === 'online' && typeof proc.uptime === 'number'
      && proc.uptime < Date.now() - triggeredAt.getTime()) {
      await finish('ok', { name: 'Restart Verified', status: 'ok', uptimeMs: proc.uptime });
      return;
    }
  } catch { /* fall through to failed */ }
  await finish('failed', { name: 'Verify', status: 'error', error: lastNote });
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const { allowed, retryAfterMs } = checkRateLimit('admin_deploy', auth.session.user.discordId!, 3, 300_000);
  if (!allowed) return rateLimitResponse(retryAfterMs, 'Rate limited — max 3 deploys per 5 minutes');

  const { project, commitMessage } = await req.json();

  if (!project || !['butler', 'jester', 'oracle', 'sage'].includes(project)) {
    return NextResponse.json({ error: 'Invalid project' }, { status: 400 });
  }

  // Save deploy record to MongoDB
  const client = await clientPromise;
  const db = client.db('Database');
  const deployDoc = {
    project,
    status: 'running',
    steps: [],
    triggeredBy: auth.session.user.username ?? 'unknown',
    triggeredAt: new Date(),
    completedAt: null,
    duration: null,
  };

  const { insertedId } = await db.collection('admin_deploys').insertOne(deployDoc);

  // Step 1: Trigger VPS deploy first (most critical)
  const res = await agentFetch(`/deploy/${project}`, { method: 'POST', timeout: 10000 });

  if (!res.ok) {
    await db.collection('admin_deploys').updateOne(
      { _id: insertedId },
      { $set: { status: 'failed', completedAt: new Date(), steps: [{ name: 'VPS Deploy', status: 'error', error: res.data?.error }] } }
    );
    const safeError = typeof res.data?.error === 'string'
      ? res.data.error.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[redacted]').slice(0, 200)
      : 'Deploy failed';
    return NextResponse.json({ error: safeError }, { status: 502 });
  }

  // Step 2: Git push only after successful VPS deploy
  const localPath = PROJECT_PATHS[project];
  let gitPushed = false;
  if (localPath && commitMessage) {
    const gitResult = await gitCommitAndPush(localPath, commitMessage);
    if (!gitResult.success) {
      // VPS deploy succeeded but git push failed — log it but don't fail the whole request
      console.error(`[deploy] Git push failed after successful VPS deploy for ${project}:`, gitResult.error);
      await db.collection('admin_deploys').updateOne(
        { _id: insertedId },
        { $set: { 'steps': [{ name: 'VPS Deploy', status: 'ok' }, { name: 'Git Push', status: 'warning', error: gitResult.error }] } }
      );
    } else {
      gitPushed = true;
    }
  }

  // Record progress so far but leave status 'running' — the detached verifier
  // below writes the truthful terminal result once the agent finishes.
  const steps = [{ name: 'VPS Deploy', status: 'ok' }];
  if (localPath && commitMessage) {
    steps.push({ name: 'Git Push', status: gitPushed ? 'ok' : 'skipped' });
  }
  await db.collection('admin_deploys').updateOne(
    { _id: insertedId },
    { $set: { steps } }
  );

  void recordTerminalStatus(insertedId, project, deployDoc.triggeredAt, steps, res.data?.deployId)
    .catch((err) => console.error('[deploy] terminal status verification failed:', err));

  await logAdminAction({
    adminDiscordId: auth.session.user.discordId!,
    adminUsername: auth.session.user.username ?? 'unknown',
    action: 'deploy_trigger',
    metadata: { project, deployId: insertedId.toString(), agentResponse: res.ok, gitPushed },
    before: null,
    after: null,
    ip: getClientIp(req),
  });

  return NextResponse.json({
    deployId: insertedId.toString(),
    agentDeployId: res.data?.deployId,
    status: 'started',
    gitPushed,
  });
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const client = await clientPromise;
  const db = client.db('Database');
  const deploys = await db.collection('admin_deploys')
    .find()
    .sort({ triggeredAt: -1 })
    .limit(20)
    .toArray();

  return NextResponse.json({ deploys });
}
