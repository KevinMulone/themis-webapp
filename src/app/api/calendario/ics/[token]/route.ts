import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calendarioIcs } from '@/lib/calendario/ics';
import { TIPI_EVENTO, labelFromOptions } from '@/lib/constants';

// Google interroga questo indirizzo dai propri server: nessun cookie,
// nessuna sessione. L'unica credenziale è il token nel percorso, quindi
// la lettura passa dal client con chiave di servizio — le policy per
// studio qui non potrebbero applicarsi, non c'è un utente da riconoscere.
export const dynamic = 'force-dynamic';

/** Un anno indietro e tre avanti: abbastanza per un'udienza fissata lontano,
 *  senza far crescere il file all'infinito. */
function finestra(): { da: string; a: string } {
  const oggi = new Date();
  const da = new Date(oggi); da.setFullYear(da.getFullYear() - 1);
  const a = new Date(oggi); a.setFullYear(a.getFullYear() + 3);
  return { da: da.toISOString().slice(0, 10), a: a.toISOString().slice(0, 10) };
}

export async function GET(_request: Request, ctx: RouteContext<'/api/calendario/ics/[token]'>) {
  const { token } = await ctx.params;

  // Un token corto o malformato non viene nemmeno cercato: riduce il
  // rumore e non lascia intuire nulla sulla lunghezza di quelli veri.
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: impostazioni } = await admin
    .from('studio_settings')
    .select('studio_id')
    .eq('calendario_ics_token', token)
    .maybeSingle();

  // Stessa risposta per token inesistente e token revocato: chi prova a
  // indovinare non deve poter distinguere i due casi.
  if (!impostazioni) return new NextResponse('Not found', { status: 404 });

  const { da, a } = finestra();
  const [{ data: eventi }, { data: studio }] = await Promise.all([
    admin.from('eventi')
      .select('id, titolo, tipo, data, ora_inizio, ora_fine, all_day, luogo, note')
      .eq('studio_id', impostazioni.studio_id)
      .gte('data', da).lte('data', a)
      .order('data'),
    admin.from('studios').select('nome_studio').eq('id', impostazioni.studio_id).maybeSingle(),
  ]);

  const ics = calendarioIcs(eventi ?? [], {
    nomeCalendario: studio?.nome_studio ? `Themis — ${studio.nome_studio}` : 'Themis',
    etichettaTipo: (tipo) => labelFromOptions(TIPI_EVENTO, tipo),
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="themis.ics"',
      // L'indirizzo è segreto: non deve finire in nessuna cache condivisa
      // né in un motore di ricerca.
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
