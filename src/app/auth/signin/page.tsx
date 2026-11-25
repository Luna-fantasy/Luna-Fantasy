import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signInReturnPath } from '@/lib/discord-signin';

export default async function SignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const query = await searchParams;
  const savedLocale = (await cookies()).get('NEXT_LOCALE')?.value === 'ar' ? 'ar' : 'en';
  const raw = typeof query.callbackUrl === 'string' ? query.callbackUrl : undefined;
  const path = signInReturnPath(raw, savedLocale, process.env.AUTH_URL || process.env.NEXTAUTH_URL);
  const locale = path.match(/^\/(ar|en)(?:\/|$)/)?.[1] || savedLocale;
  const params = new URLSearchParams();
  if (raw) params.set('callbackUrl', path);
  if (query.error) params.set('error', 'signin');
  const suffix = params.toString();
  redirect(`/${locale}/auth/signin/${suffix ? '?' + suffix : ''}`);
}
