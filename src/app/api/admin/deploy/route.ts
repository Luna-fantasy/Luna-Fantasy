import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';
import { gitCommitAndPush } from '@/lib/admin/config-writer';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const PROJECT_PATHS: Record<string, string> = {
  butler: process.env.BUTLER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaButlerMain',
  jester: process.env.JESTER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaJesterMain',
};

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const { allowed } = checkRateLimit('admin_deploy', auth.session.user.discordId!, 3, 300_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited — max 3 deploys per 5 minutes' }, { status: 429 });

  const { project, commitMessage } = await req.json();

  if (!project || !['butler', 'jester', 'oracle', 'sage', 'fantasy'].includes(project)) {
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

  const completedAt = new Date();
  const steps = [{ name: 'VPS Deploy', status: 'ok' }];
  if (localPath && commitMessage) {
    steps.push({ name: 'Git Push', status: gitPushed ? 'ok' : 'skipped' });
  }
  await db.collection('admin_deploys').updateOne(
    { _id: insertedId },
    { $set: { status: 'ok', completedAt, duration: completedAt.getTime() - deployDoc.triggeredAt.getTime(), steps } }
  );

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
