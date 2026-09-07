import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('studios')
      .select('nome_studio, elenco_paese, elenco_via, elenco_citta, elenco_cap, elenco_sito')
      .eq('elenco_pubblico', true)
      .eq('plan', 'annuale')
      .in('subscription_status', ['active', 'trialing'])
      .order('elenco_paese', { ascending: true })
      .order('elenco_citta', { ascending: true });

    if (error) {
      return NextResponse.json({ studi: [], errore: error.message }, { status: 200 });
    }
    return NextResponse.json({ studi: data || [] });
  } catch {
    return NextResponse.json({ studi: [] });
  }
}
