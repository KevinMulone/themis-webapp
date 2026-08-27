import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, ctx: RouteContext<'/api/admin/studios/[id]/generate-otp'>) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: studio, error } = await admin.from('studios').select('email').eq('id', id).single();
  if (error || !studio) return NextResponse.json({ error: 'Studio non trovato' }, { status: 404 });

  const { data, error: genError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: studio.email,
  });
  if (genError || !data) return NextResponse.json({ error: genError?.message || 'Errore generazione codice' }, { status: 400 });

  return NextResponse.json({ ok: true, email: studio.email, otp: data.properties.email_otp });
}
