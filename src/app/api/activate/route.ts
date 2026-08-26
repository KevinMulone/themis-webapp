import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLicenseId } from '@/lib/licenseKey';

export async function POST(request: Request) {
  const { key } = await request.json();
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Inserisci una chiave di licenza' }, { status: 400 });
  }

  let licenseId: string;
  try {
    licenseId = extractLicenseId(key);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Devi essere registrato/collegato per attivare una chiave' }, { status: 401 });
  }

  const { error } = await supabase.rpc('redeem_license', { p_license_id: licenseId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: studio } = await supabase
    .from('studios')
    .select('plan, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ ok: true, studio });
}
