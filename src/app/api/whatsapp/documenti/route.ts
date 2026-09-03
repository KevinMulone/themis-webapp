import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';

// Vedi la stessa nota in /api/whatsapp/messaggi: senza tipi generati
// dallo schema, una select con più colonne più relazioni annidate esce
// da postgrest-js come un tipo generico inutilizzabile.
type RigaDocumento = {
  id: string; jid_mittente: string; documento_nome: string; ricevuto_il: string;
  cliente_id: string | null; matter_id: string | null; nome_whatsapp: string | null;
  clients: { nome: string | null; cognome: string | null; ragione_sociale: string | null }
    | { nome: string | null; cognome: string | null; ragione_sociale: string | null }[] | null;
  matters: { controparte_nome: string | null; compagnia_assicurativa: string | null; tipo_pratica: string | null }
    | { controparte_nome: string | null; compagnia_assicurativa: string | null; tipo_pratica: string | null }[] | null;
};

/**
 * Tutti i documenti, le foto e i video ricevuti su WhatsApp, con chi li
 * ha mandati e se sono già agganciati a una pratica — il "reparto
 * fascicoli" degli allegati: una vista sola per rivedere tutto quello
 * che è arrivato, senza dover riaprire ogni conversazione una per una.
 */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('whatsapp_messaggi')
    .select('id, jid_mittente, documento_nome, ricevuto_il, cliente_id, matter_id, nome_whatsapp, '
      + 'clients(nome, cognome, ragione_sociale), matters(controparte_nome, compagnia_assicurativa, tipo_pratica)')
    .eq('studio_id', contesto.studioId)
    .not('documento_nome', 'is', null)
    .order('ricevuto_il', { ascending: false })
    .limit(300) as { data: RigaDocumento[] | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const documenti = (data ?? []).map((d) => {
    const cliente = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    const pratica = Array.isArray(d.matters) ? d.matters[0] : d.matters;
    return {
      id: d.id, jidMittente: d.jid_mittente, nomeFile: d.documento_nome, ricevutoIl: d.ricevuto_il,
      clienteId: d.cliente_id, matterId: d.matter_id,
      clienteNome: cliente
        ? [cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale
        : null,
      nomeWhatsapp: d.nome_whatsapp,
      praticaLabel: pratica
        ? [pratica.controparte_nome, pratica.compagnia_assicurativa].filter(Boolean).join(' — ') || pratica.tipo_pratica
        : null,
    };
  });

  return NextResponse.json({ ok: true, documenti });
}
