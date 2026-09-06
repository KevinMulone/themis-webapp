'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className ?? 'premi w-full rounded-[10px] px-2.5 py-2 text-left text-[13px] text-neutral-600 hover:bg-white/70 hover:text-neutral-900'}
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/accedi');
        router.refresh();
      }}
    >
      Esci
    </button>
  );
}
