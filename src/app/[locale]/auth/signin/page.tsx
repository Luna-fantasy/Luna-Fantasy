import { Metadata } from 'next';
import SignInContent from './SignInContent';

export const metadata: Metadata = {
  title: 'Sign In — Luna',
};

export default function SignInPage() {
  return <SignInContent />;
}
