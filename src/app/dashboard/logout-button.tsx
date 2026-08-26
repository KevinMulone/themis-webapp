'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/accedi');
      }}
    >
      Esci
    </button>
  );
}
