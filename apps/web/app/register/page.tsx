import { redirect } from 'next/navigation';

// Signing up and signing in are the same step now.
export default function RegisterPage() {
  redirect('/login');
}
