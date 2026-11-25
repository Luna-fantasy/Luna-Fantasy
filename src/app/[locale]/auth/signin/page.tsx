import { Metadata } from 'next';
import SignInContent from './SignInContent';
import { discordOAuthCredentials, guestSignInDestination, signInReturnPath } from '@/lib/discord-signin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign In — Luna',
};

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ params, searchParams }: SignInPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const callback = typeof query.callbackUrl === 'string' ? query.callbackUrl : undefined;
  const returnPath = signInReturnPath(callback, locale, process.env.AUTH_URL || process.env.NEXTAUTH_URL);
  return <SignInContent enabled={Boolean(discordOAuthCredentials(process.env))} returnPath={returnPath}
    guestPath={guestSignInDestination(returnPath, locale)} failed={Boolean(query.error)} />;
}
