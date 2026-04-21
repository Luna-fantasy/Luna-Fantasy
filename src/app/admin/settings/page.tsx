import Link from 'next/link';
import PageHeader from '../_components/PageHeader';
import StatCard from '../_components/StatCard';
import Surface from '../_components/Surface';
import Icon from '../_components/Icon';

export const dynamic = 'force-dynamic';

function envFlag(key: string): boolean {
  return Boolean(process.env[key] && String(process.env[key]).length > 0);
}

export default function SettingsPage() {
  const env = {
    discord: envFlag('DISCORD_BOT_TOKEN'),
    oracle:  envFlag('ORACLE_BOT_TOKEN'),
    mongo:   envFlag('MONGODB_URI'),
    r2Account: envFlag('R2_ACCOUNT_ID'),
    r2Access:  envFlag('R2_ACCESS_KEY_ID'),
    r2Secret:  envFlag('R2_SECRET_ACCESS_KEY'),
    r2Bucket:  envFlag('R2_BUCKET_NAME'),
    r2Public:  envFlag('R2_PUBLIC_URL'),
    vpsAgent:  envFlag('VPS_AGENT_KEY'),
    txWebhook: envFlag('TRANSACTION_WEBHOOK_KEY'),
  };
  const r2OK = env.r2Account && env.r2Access && env.r2Secret && env.r2Bucket && env.r2Public;
  const allCount = Object.values(env).filter(Boolean).length;
  const totalCount = Object.keys(env).length;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Here you manage system settings — environment variables, integrations, and caches."
      />

      <div className="av-stat-grid">
        <StatCard
          label="Environment"
          icon="server"
          tone="cyan"
          value={`${allCount}/${totalCount}`}
          meta={`${allCount === totalCount ? 'All set' : (totalCount - allCount) + ' missing'}`}
          hint="Count of required environment variables that are present."
        />
        <StatCard
          label="R2 Storage"
          icon="image"
          tone={r2OK ? 'green' : 'red'}
          value={r2OK ? 'Online' : 'Misconfigured'}
          meta={r2OK ? 'All 5 R2 vars present' : 'Missing R2 variables'}
        />
        <StatCard
          label="Discord Bot"
          icon="bot"
          tone={env.discord ? 'green' : 'red'}
          value={env.discord ? 'Token set' : 'Missing'}
          meta="DISCORD_BOT_TOKEN"
        />
        <StatCard
          label="VPS Agent"
          icon="rocket"
          tone={env.vpsAgent ? 'green' : 'gold'}
          value={env.vpsAgent ? 'Authorized' : 'No key'}
          meta="VPS_AGENT_KEY"
        />
      </div>

      <Surface title="Environment Variables" icon="settings" meta={`${allCount}/${totalCount} configured`}>
        <table className="av-settings-env">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Status</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            <EnvRow name="DISCORD_BOT_TOKEN" set={env.discord} usage="Live role lookup, role grants, member fetches" />
            <EnvRow name="ORACLE_BOT_TOKEN" set={env.oracle} usage="Oracle bot announcements, fallback for guild API" />
            <EnvRow name="MONGODB_URI" set={env.mongo} usage="All admin reads/writes, Atlas cluster" />
            <EnvRow name="R2_ACCOUNT_ID" set={env.r2Account} usage="Cloudflare R2 account binding" />
            <EnvRow name="R2_ACCESS_KEY_ID" set={env.r2Access} usage="R2 image uploads (cards, stones, bots)" />
            <EnvRow name="R2_SECRET_ACCESS_KEY" set={env.r2Secret} usage="R2 image uploads — private key" />
            <EnvRow name="R2_BUCKET_NAME" set={env.r2Bucket} usage="Target bucket name (assets)" />
            <EnvRow name="R2_PUBLIC_URL" set={env.r2Public} usage="Public CDN base URL (assets.lunarian.app)" />
            <EnvRow name="VPS_AGENT_KEY" set={env.vpsAgent} usage="Bearer auth for /pm2/list and /deploy/*" />
            <EnvRow name="TRANSACTION_WEBHOOK_KEY" set={env.txWebhook} usage="External webhook signatures into /api/webhooks/transactions" />
          </tbody>
        </table>
        <p className="av-callout">
          <strong>Tip</strong> — Environment values can&apos;t be edited from the dashboard for security. Update them in Railway and redeploy.
        </p>
      </Surface>

      <Surface title="Quick Links" icon="external">
        <div className="av-settings-links">
          <Link href="/admin/audit?actions=deploy_trigger,pm2_restart,pm2_stop,pm2_start" className="av-btn av-btn-ghost">
            <Icon name="audit" /> Deploy / PM2 audit
          </Link>
          <Link href="/admin/audit?actions=r2_upload,r2_delete,r2_presign" className="av-btn av-btn-ghost">
            <Icon name="image" /> R2 audit
          </Link>
          <Link href="/admin/audit?actions=config_butler_update,config_jester_update,config_oracle_update,config_sage_update" className="av-btn av-btn-ghost">
            <Icon name="settings" /> Config audit
          </Link>
          <Link href="/admin/deploy" className="av-btn av-btn-primary">
            <Icon name="rocket" /> Deploy
          </Link>
          <Link href="/admin/ops" className="av-btn av-btn-primary">
            <Icon name="bot" /> Operations
          </Link>
        </div>
      </Surface>
    </>
  );
}

function EnvRow({ name, set, usage }: { name: string; set: boolean; usage: string }) {
  return (
    <tr>
      <td><code>{name}</code></td>
      <td>
        <span className={`av-audit-badge av-audit-badge-${set ? 'grant' : 'destructive'}`}>
          {set ? 'SET' : 'MISSING'}
        </span>
      </td>
      <td>{usage}</td>
    </tr>
  );
}
