import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { email, password, nome_studio, plan, days } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email e password sono obbligatorie' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError || !userData.user) {
    return NextResponse.json({ error: createError?.message || 'Errore creazione utente' }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + (Number(days) || 30) * 86400000).toISOString().slice(0, 10);
  const { error: updateError } = await admin.from('studios').update({
    nome_studio: nome_studio || null, plan: plan || 'monthly',
    subscription_status: 'active', subscription_expires_at: expiresAt,
  }).eq('id', userData.user.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, studio_id: userData.user.id, subscription_expires_at: expiresAt });
}
