import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('studios').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const lastSignInById = new Map(
    (usersPage?.users || []).map((u) => [u.id, u.last_sign_in_at]),
  );
  const studios = (data || []).map((s) => ({ ...s, last_sign_in_at: lastSignInById.get(s.id) || null }));

  return NextResponse.json({ studios });
}
