import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { NextAuthConfig } from 'next-auth';

const root = resolve(__dirname, '..');
const requireFromApp = createRequire(join(root, 'package.json'));
const authRoot = dirname(requireFromApp.resolve('next-auth'));
const coreRoot = dirname(createRequire(join(authRoot, 'index.js')).resolve('@auth/core'));
const loadCore = (file: string): Promise<any> => import(pathToFileURL(join(coreRoot, file)).href);
const originalFetch = globalThis.fetch;
const logger = { error() {}, warn() {}, debug() {} };
let networkAttempts = 0;
let appConfig: NextAuthConfig;
let init: any, handleOAuth: any, getAuthorizationUrl: any, AuthInternal: any, createCSRFToken: any;
let customFetch: symbol;

// Capture the real application's configuration without importing its eager MongoDB connection.
// Only the configuration factory and database boundary are replaced; OAuth and cookie checks run normally.
async function readAppConfig(): Promise<NextAuthConfig> {
  const { default: Discord } = await loadCore('providers/discord.js');
  let captured: NextAuthConfig | undefined;
  const modules: Record<string, unknown> = {
    'next-auth': (config: NextAuthConfig) => { captured = config; return {}; },
    'next-auth/providers/discord': Discord,
    '@auth/mongodb-adapter': { MongoDBAdapter: () => ({}) },
    '@/lib/mongodb': undefined,
    '@/lib/admin/constants': { MASTERMIND_IDS: [] },
  };
  const source = readFileSync(join(root, 'src/auth.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  runInNewContext(outputText, {
    exports: {},
    require(name: string) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected auth dependency: ${name}`);
      return modules[name];
    },
  }, { filename: 'src/auth.ts', timeout: 1000 });
  assert.ok(captured, 'src/auth.ts must configure NextAuth');
  return captured;
}

before(async () => {
  globalThis.fetch = async () => { networkAttempts++; throw new Error('External requests are forbidden in auth tests'); };
  appConfig = await readAppConfig();
  ({ init } = await loadCore('lib/init.js'));
  ({ handleOAuth } = await loadCore('lib/actions/callback/oauth/callback.js'));
  ({ getAuthorizationUrl } = await loadCore('lib/actions/signin/authorization-url.js'));
  ({ AuthInternal } = await loadCore('lib/index.js'));
  ({ customFetch } = await loadCore('lib/symbols.js'));
  ({ createCSRFToken } = await loadCore('lib/actions/callback/oauth/csrf-token.js'));
});

after(() => {
  globalThis.fetch = originalFetch;
  assert.equal(networkAttempts, 0, 'OAuth tests must never reach a real provider');
});

async function fixture(withState = false) {
  const authOptions = {
    ...appConfig,
    providers: Array.from(appConfig.providers),
    adapter: undefined,
    session: { strategy: 'jwt' as const },
    secret: 'synthetic-auth-regression-secret-never-used-in-production',
    trustHost: true,
    basePath: '/api/auth',
    logger,
  };
  const { options } = await init({
    authOptions, providerId: 'discord', action: 'signin',
    url: new URL('https://local.test/api/auth/signin/discord'), cookies: {}, isPost: false,
  });
  options.provider.clientId = 'synthetic-client';
  options.provider.clientSecret = 'synthetic-client-secret';
  // The application defaults to PKCE. Exercise optional state without replacing its existing checks.
  if (withState) options.provider.checks = [...options.provider.checks, 'state'];
  const generated = await getAuthorizationUrl({}, options);
  const authorization = new URL(generated.redirect);
  const cookies: Record<string, string> = Object.fromEntries(generated.cookies.map((c: any) => [c.name, c.value]));
  const params: Record<string, string> = { code: 'synthetic-code', iss: 'https://discord.com' };
  if (authorization.searchParams.has('state')) params.state = authorization.searchParams.get('state')!;
  const calls: string[] = [];
  options.provider[customFetch] = async (url: string | URL, request: any) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://discord.com');
    if (target.pathname === '/api/oauth2/token') {
      const verifier = request.body.get('code_verifier');
      assert.ok(verifier, 'the token exchange must include the PKCE verifier');
      assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorization.searchParams.get('code_challenge'));
      assert.equal(request.body.get('redirect_uri'), 'https://local.test/api/auth/callback/discord');
      calls.push('token');
      return Response.json({ access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 3600 });
    }
    assert.equal(target.pathname, '/api/users/@me');
    calls.push('userinfo');
    return Response.json({
      id: '123456789012345678', username: 'test-user', global_name: 'Test User',
      email: 'user@example.invalid', avatar: null, discriminator: '0',
    });
  };
  return { authOptions, options, authorization, cookies, params, calls };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function rejectsBeforeExchange(f: Fixture, predicate: (error: any) => boolean) {
  await assert.rejects(() => handleOAuth(f.params, f.cookies, f.options), predicate);
  assert.deepEqual(f.calls, [], 'invalid callbacks must not exchange the authorization code');
}

test('Discord callback accepts its RFC 9207 issuer and preserves S256 PKCE', async () => {
  const f = await fixture();
  assert.equal(f.authorization.searchParams.get('code_challenge_method'), 'S256');
  const result = await handleOAuth(f.params, f.cookies, f.options);
  assert.equal(result.account.providerAccountId, '123456789012345678');
  assert.equal(result.user.email, 'user@example.invalid');
  assert.deepEqual(f.calls, ['token', 'userinfo']);
});

for (const issuer of ['https://attacker.invalid', 'https://discord.com/']) {
  test(`Discord callback rejects issuer ${issuer}`, async () => {
    const f = await fixture();
    f.params.iss = issuer;
    await rejectsBeforeExchange(f, e => e.message.includes('unexpected "iss"') && e.cause.expected === 'https://discord.com');
  });
}

for (const value of [undefined, 'tampered']) {
  test(`Discord callback rejects ${value ? 'tampered' : 'missing'} PKCE cookie`, async () => {
    const f = await fixture();
    if (value) f.cookies[f.options.cookies.pkceCodeVerifier.name] = value;
    else delete f.cookies[f.options.cookies.pkceCodeVerifier.name];
    await rejectsBeforeExchange(f, e => e.type === 'InvalidCheck');
  });
}

test('Discord callback preserves configured state alongside PKCE', async () => {
  const f = await fixture(true);
  const result = await handleOAuth(f.params, f.cookies, f.options);
  assert.equal(result.account.providerAccountId, '123456789012345678');
  assert.deepEqual(f.calls, ['token', 'userinfo']);
});

for (const value of [undefined, 'mismatch']) {
  test(`Discord callback rejects ${value ? 'mismatched' : 'missing'} configured state parameter`, async () => {
    const f = await fixture(true);
    if (value) f.params.state = value;
    else delete f.params.state;
    await rejectsBeforeExchange(f, e => e.message.includes('state'));
  });
}

for (const value of [undefined, 'tampered']) {
  test(`Discord callback rejects ${value ? 'tampered' : 'missing'} configured state cookie`, async () => {
    const f = await fixture(true);
    if (value) f.cookies[f.options.cookies.state.name] = value;
    else delete f.cookies[f.options.cookies.state.name];
    await rejectsBeforeExchange(f, e => e.type === 'InvalidCheck');
  });
}

function signin(cookies: Record<string, string> = {}, body: Record<string, string> = {}) {
  return {
    method: 'POST', action: 'signin', providerId: 'discord',
    url: new URL('https://local.test/api/auth/signin/discord'), query: {}, cookies, body,
  };
}

test('Discord sign-in still rejects a missing CSRF token', async () => {
  const f = await fixture();
  await assert.rejects(() => AuthInternal(signin(), f.authOptions), (e: any) => e.type === 'MissingCSRF');
});

test('Discord sign-in accepts a valid CSRF cookie and body token', async () => {
  const f = await fixture();
  const csrf = await createCSRFToken({ options: f.options, isPost: false });
  const result = await AuthInternal(signin({ [f.options.cookies.csrfToken.name]: csrf.cookie }, { csrfToken: csrf.csrfToken }), f.authOptions);
  assert.equal(new URL(result.redirect).hostname, 'discord.com');
});

test('Discord sign-in rejects a CSRF body token that does not match the cookie', async () => {
  const f = await fixture();
  const csrf = await createCSRFToken({ options: f.options, isPost: false });
  await assert.rejects(
    () => AuthInternal(signin({ [f.options.cookies.csrfToken.name]: csrf.cookie }, { csrfToken: 'mismatch' }), f.authOptions),
    (e: any) => e.type === 'MissingCSRF',
  );
});

test('Discord sign-in rejects a CSRF cookie signed with a different secret', async () => {
  const f = await fixture();
  const csrf = await createCSRFToken({ options: f.options, isPost: false });
  await assert.rejects(
    () => AuthInternal(signin({ [f.options.cookies.csrfToken.name]: csrf.cookie }, { csrfToken: csrf.csrfToken }), {
      ...f.authOptions, secret: 'another-synthetic-secret',
    }),
    (e: any) => e.type === 'MissingCSRF',
  );
});
