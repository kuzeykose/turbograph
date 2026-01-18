'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase will automatically handle the OAuth callback
        // and extract the session from the URL hash
        const { error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error during authentication:', error.message);
          router.push('/login?error=auth_failed');
          return;
        }

        // Redirect to dashboard after successful authentication
        router.push('/dashboard');
      } catch (error) {
        console.error('Unexpected error:', error);
        router.push('/login?error=unexpected');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
