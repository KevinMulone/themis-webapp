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

export async function DELETE(request: Request, ctx: RouteContext<'/api/admin/studios/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // Elimina l'utente di autenticazione: se studios.id ha un vincolo
  // ON DELETE CASCADE verso auth.users(id), questo basta a far sparire da
  // solo anche la riga in studios e (a cascata) tutte le tabelle collegate.
  // Ripetiamo comunque l'eliminazione della riga studios esplicitamente
  // subito dopo, così funziona anche se quel vincolo non fosse impostato.
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  await admin.from('studios').delete().eq('id', id);

  return NextResponse.json({ ok: true });
}
