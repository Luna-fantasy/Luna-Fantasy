import { redirect } from 'next/navigation';

export default function SignInRedirect({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const params = new URLSearchParams();
  if (searchParams.callbackUrl) params.set('callbackUrl', searchParams.callbackUrl);
  if (searchParams.error) params.set('error', searchParams.error);

  const query = params.toString();
  redirect(`/en/auth/signin${query ? `?${query}` : ''}`);
}
