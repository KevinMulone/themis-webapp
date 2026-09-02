import { redirect } from 'next/navigation';
import SincronizzazionePec from './SincronizzazionePec';
import { oggiIso } from '@/lib/dateUtils';
import { contestoStudio, eCollaboratoreDisattivato } from '@/lib/studio/contesto';
import { createClient } from '@/lib/supabase/server';
import { STATI_APERTI } from '@/lib/incarichi';
import { StudioProvider } from '@/lib/studio/StudioProvider';
import SidebarNav from './SidebarNav';
import UsageTracker from './UsageTracker';

function giorniRimanenti(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - new Date(oggiIso()).getTime();
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return 'scaduto';
  if (days === 0) return 'scade oggi';
  if (days === 1) return 'scade domani';
  return `scade tra ${days} giorni`;
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clienti', label: 'Clienti' },
  { href: '/pratiche', label: 'Pratiche' },
  { href: '/themis', label: 'Themis' },
  { href: '/incarichi', label: 'I miei incarichi' },
  { href: '/calendario', label: 'Calendario' },
  { href: '/pec', label: 'PEC' },
  { href: '/whatsapp', label: 'WhatsApp' },
  { href: '/genera', label: 'Genera Atto' },
  { href: '/deposito', label: 'Deposito' },
  { href: '/calcolo-danno', label: 'Calcolo Danno' },
  { href: '/parcelle', label: 'Parcelle' },
  { href: '/patrocinio', label: 'Patrocinio Stato' },
];

// Resta sempre in fondo, dopo le voci riservate al titolare.
const NAV_IMPOSTAZIONI = { href: '/impostazioni', label: 'Impostazioni' };

// Voci riservate al titolare. Nasconderle è solo cortesia verso chi non le
// può usare: la barriera vera è il controllo lato server nelle pagine e
// nelle route API.
const NAV_TITOLARE = [
  { href: '/attivita', label: 'Registro attività' },
  { href: '/collaboratori', label: 'Collaboratori' },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Non più "qual è la riga studios con id = user.id", che vale solo
  // finché un utente è per forza uno studio: adesso è il database a dire a
  // quale studio appartiene chi sta navigando (funzione contesto_studio,
  // migrazione 005). Per un titolare la risposta è la stessa di prima.
  //
  // ctx nullo significa "non appartiene a nessuno studio attivo": utente
  // registrato ma senza licenza riscattata, oppure collaboratore
  // disattivato. Chi non è autenticato affatto non arriva nemmeno qui, lo
  // ferma prima il middleware mandandolo su /accedi.
  const ctx = await contestoStudio();
  if (!ctx) {
    // A un collaboratore appena rimosso non si propone di comprare una
    // licenza: gli si dice che non fa più parte dello studio.
    if (await eCollaboratoreDisattivato()) redirect('/account-sospeso?motivo=collaboratore_rimosso');
    redirect('/attiva');
  }

  const today = oggiIso();
  const expired = !!ctx.subscriptionExpiresAt && ctx.subscriptionExpiresAt < today;
  if (ctx.subscriptionStatus !== 'active' || expired) {
    redirect(`/account-sospeso?motivo=${expired ? 'scaduto' : 'sospeso'}`);
  }

  // Il contatore accanto a "I miei incarichi": è la notifica in-app, e
  // costa una query di sola conta.
  const supabase = await createClient();
  const { count: incarichiAperti } = await supabase
    .from('incarichi')
    .select('id', { count: 'exact', head: true })
    .eq('assegnato_a', ctx.userId)
    .in('stato', STATI_APERTI);

  const voci = [
    ...NAV,
    ...(ctx.ruolo === 'titolare' ? NAV_TITOLARE : []),
    NAV_IMPOSTAZIONI,
  ].map((v) =>
    v.href === '/incarichi' ? { ...v, badge: incarichiAperti ?? 0 } : v,
  );

  return (
    <StudioProvider
      valore={{ userId: ctx.userId, studioId: ctx.studioId, ruolo: ctx.ruolo, nomeStudio: ctx.nomeStudio }}
    >
      <div className="flex min-h-screen flex-col bg-white lg:flex-row">
        <UsageTracker />
        <SidebarNav
          navItems={voci}
          nomeStudio={ctx.nomeStudio ?? ''}
          abbonamentoLabel={giorniRimanenti(ctx.subscriptionExpiresAt)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8"><SincronizzazionePec />
      {children}</main>
      </div>
    </StudioProvider>
  );
}
