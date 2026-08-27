import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, ctx: RouteContext<'/api/admin/studios/[id]/reset-password'>) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: studio, error } = await admin.from('studios').select('email').eq('id', id).single();
  if (error || !studio) return NextResponse.json({ error: 'Studio non trovato' }, { status: 404 });

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const redirectTo = `${new URL(request.url).origin}/reimposta-password`;
  const { error: sendError } = await anon.auth.resetPasswordForEmail(studio.email, { redirectTo });
  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 400 });

  return NextResponse.json({ ok: true, email: studio.email });
}
