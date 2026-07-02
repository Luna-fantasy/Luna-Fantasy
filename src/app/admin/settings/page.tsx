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
    // Auth / core
    nextauthUrl: envFlag('NEXTAUTH_URL'),
    authSecret: envFlag('AUTH_SECRET'),
    authDiscordId: envFlag('AUTH_DISCORD_ID'),
    authDiscordSecret: envFlag('AUTH_DISCORD_SECRET'),
    mongo: envFlag('MONGODB_URI'),
    // Discord identity
    discordGuild: envFlag('DISCORD_GUILD_ID'),
    publicGuild: envFlag('NEXT_PUBLIC_GUILD_ID'),
    // Bot tokens
    discord: envFlag('DISCORD_BOT_TOKEN'),
    butler: envFlag('BUTLER_BOT_TOKEN'),
    jester: envFlag('JESTER_BOT_TOKEN'),
    sage: envFlag('SAGE_BOT_TOKEN'),
    oracle: envFlag('ORACLE_BOT_TOKEN'),
    // R2
    r2Account: envFlag('R2_ACCOUNT_ID'),
    r2Access: envFlag('R2_ACCESS_KEY_ID'),
    r2Secret: envFlag('R2_SECRET_ACCESS_KEY'),
    r2Bucket: envFlag('R2_BUCKET_NAME'),
    r2Public: envFlag('R2_PUBLIC_URL'),
    // Cloudflare cache purge
    cfZone: envFlag('CLOUDFLARE_ZONE_ID'),
    cfToken: envFlag('CLOUDFLARE_API_TOKEN'),
    // Infra
    vpsAgent: envFlag('VPS_AGENT_KEY'),
    vpsAgentUrl: envFlag('VPS_AGENT_URL'),
    txWebhook: envFlag('TRANSACTION_WEBHOOK_KEY'),
    cronSecret: envFlag('CRON_SECRET'),
  };
  const r2OK = env.r2Account && env.r2Access && env.r2Secret && env.r2Bucket && env.r2Public;
  const cfOK = env.cfZone && env.cfToken;
  const allCount = Object.values(env).filter(Boolean).length;
  const totalCount = Object.keys(env).length;
  const authOK = env.nextauthUrl && env.authSecret && env.authDiscordId && env.authDiscordSecret && env.mongo;

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
          tone={allCount === totalCount ? 'cyan' : 'red'}
          value={`${allCount}/${totalCount}`}
          meta={`${allCount === totalCount ? 'All set' : (totalCount - allCount) + ' missing'}`}
          hint="Count of required environment variables that are present. Missing values often explain 'action does nothing' or SSR crashes."
        />
        <StatCard
          label="R2 Storage"
          icon="image"
          tone={r2OK ? 'green' : 'red'}
          value={r2OK ? 'Online' : 'Misconfigured'}
          meta={r2OK ? 'All 5 R2 vars present' : 'Missing R2 variables'}
        />
        <StatCard
          label="Discord Auth"
          icon="bot"
          tone={authOK ? 'green' : 'red'}
          value={authOK ? 'Configured' : 'Broken'}
          meta="NEXTAUTH_URL, AUTH_*, MONGODB_URI"
          hint="If NEXTAUTH_URL is missing on Railway, SSR fetches to same-origin API routes build a bad URL — pages crash."
        />
        <StatCard
          label="Cloudflare"
          icon="rocket"
          tone={cfOK ? 'green' : 'gold'}
          value={cfOK ? 'Ready' : 'No purge'}
          meta="CLOUDFLARE_ZONE_ID + API_TOKEN"
          hint="Without these, R2 cache-purge on image upload silently fails and images look stale."
        />
      </div>

      <Surface title="Auth / Core" icon="server" meta="Anything missing here breaks the dashboard outright">
        <table className="av-settings-env">
          <thead><tr><th>Variable</th><th>Status</th><th>Used by</th></tr></thead>
          <tbody>
            <EnvRow name="NEXTAUTH_URL" set={env.nextauthUrl} usage="Same-origin server fetches (challenges, voice pages). Missing → SSR 500s." />
            <EnvRow name="AUTH_SECRET" set={env.authSecret} usage="NextAuth session encryption." />
            <EnvRow name="AUTH_DISCORD_ID" set={env.authDiscordId} usage="Discord OAuth app client ID." />
            <EnvRow name="AUTH_DISCORD_SECRET" set={env.authDiscordSecret} usage="Discord OAuth app client secret." />
            <EnvRow name="MONGODB_URI" set={env.mongo} usage="All admin reads/writes, Atlas cluster." />
            <EnvRow name="DISCORD_GUILD_ID" set={env.discordGuild} usage="Guild member fetches, channel listings, announce picker." />
            <EnvRow name="NEXT_PUBLIC_GUILD_ID" set={env.publicGuild} usage="Client-side guild ID (Valecroft grant-special)." />
          </tbody>
        </table>
      </Surface>

      <Surface title="Bot Tokens" icon="bot" meta="Announce / role grants use these per-bot">
        <table className="av-settings-env">
          <thead><tr><th>Variable</th><th>Status</th><th>Used by</th></tr></thead>
          <tbody>
            <EnvRow name="DISCORD_BOT_TOKEN" set={env.discord} usage="Default token — role lookup, member fetches, embeds." />
            <EnvRow name="BUTLER_BOT_TOKEN" set={env.butler} usage="Announce as Butler. Falls back to DISCORD_BOT_TOKEN if unset." />
            <EnvRow name="JESTER_BOT_TOKEN" set={env.jester} usage="Announce as Jester. No fallback — missing means /admin/announce → Jester returns 500." />
            <EnvRow name="SAGE_BOT_TOKEN" set={env.sage} usage="Announce as Sage. No fallback — missing means /admin/announce → Sage returns 500." />
            <EnvRow name="ORACLE_BOT_TOKEN" set={env.oracle} usage="Announce as Oracle, fallback for guild API." />
          </tbody>
        </table>
      </Surface>

      <Surface title="Storage & Cache" icon="image">
        <table className="av-settings-env">
          <thead><tr><th>Variable</th><th>Status</th><th>Used by</th></tr></thead>
          <tbody>
            <EnvRow name="R2_ACCOUNT_ID" set={env.r2Account} usage="Cloudflare R2 account binding." />
            <EnvRow name="R2_ACCESS_KEY_ID" set={env.r2Access} usage="R2 image uploads (cards, stones, bots, characters, valecroft)." />
            <EnvRow name="R2_SECRET_ACCESS_KEY" set={env.r2Secret} usage="R2 image uploads — private key." />
            <EnvRow name="R2_BUCKET_NAME" set={env.r2Bucket} usage="Target bucket name (assets)." />
            <EnvRow name="R2_PUBLIC_URL" set={env.r2Public} usage="Public CDN base URL (assets.lunarian.app)." />
            <EnvRow name="CLOUDFLARE_ZONE_ID" set={env.cfZone} usage="R2 cache-purge on image upload — without this, edits look stale." />
            <EnvRow name="CLOUDFLARE_API_TOKEN" set={env.cfToken} usage="Cloudflare API auth for cache-purge." />
          </tbody>
        </table>
      </Surface>

      <Surface title="Infrastructure" icon="settings">
        <table className="av-settings-env">
          <thead><tr><th>Variable</th><th>Status</th><th>Used by</th></tr></thead>
          <tbody>
            <EnvRow name="VPS_AGENT_URL" set={env.vpsAgentUrl} usage="VPS deploy agent base URL." />
            <EnvRow name="VPS_AGENT_KEY" set={env.vpsAgent} usage="Bearer auth for /pm2/list and /deploy/*." />
            <EnvRow name="TRANSACTION_WEBHOOK_KEY" set={env.txWebhook} usage="External webhook signatures into /api/webhooks/transactions." />
            <EnvRow name="CRON_SECRET" set={env.cronSecret} usage="Auth for scheduled tasks (auction auto-resolve, avatar refresh)." />
          </tbody>
        </table>
        <p className="av-callout">
          <strong>Tip</strong> — Environment values can&apos;t be edited from the dashboard for security. Update them in Railway → Variables and Railway will auto-redeploy.
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
