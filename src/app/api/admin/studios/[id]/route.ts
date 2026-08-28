import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: Request, ctx: RouteContext<'/api/admin/studios/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { id } = await ctx.params;
  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  for (const key of ['subscription_status', 'subscription_expires_at', 'plan', 'nome_studio', 'refund_requested_at']) {
    if (key in body) allowed[key] = body[key];
  }

  const admin = createAdminClient();
  const { error } = await admin.from('studios').update(allowed).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
