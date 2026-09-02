/**
 * Google Calendar, in chiamate dirette all'API REST — niente pacchetto
 * `googleapis`: porterebbe dentro il client di decine di API Google che
 * non serviranno mai, per un'integrazione che usa in tutto tre endpoint
 * (autorizzazione, aggiornamento del token, eventi).
 *
 * Il token di aggiornamento (refresh_token) è l'unica cosa che si
 * conserva: l'access_token dura un'ora e si richiede da capo ogni volta,
 * qui non viene mai salvato.
 */

/**
 * Il minimo che serve, non di più.
 *
 * `calendar.events` consente di leggere, creare ed eliminare eventi — tutto
 * ciò che Themis fa. Lo scope pieno `calendar` darebbe in aggiunta il potere
 * di cancellare interi calendari e di cambiarne le condivisioni: roba che
 * questo codice non usa e che, chiesta senza usarla, allunga la verifica di
 * Google e allarma giustamente chi legge la schermata di consenso.
 */
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';

export const GOOGLE_KEY_SCOPE_PREFIX = 'google-calendar:';

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID!;
}
function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET!;
}
function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/google-calendar/callback`;
}

export function googleConfigurato(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

/** L'indirizzo a cui mandare il titolare per il consenso. `state` porta
 * lo studio_id, firmato non serve: la callback rilegge comunque la
 * sessione per sapere chi ha autorizzato, lo state serve solo contro un
 * click ripetuto a freddo. */
export function urlAutorizzazione(state: string): string {
  const parametri = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Senza questo, un secondo consenso dallo stesso account non
    // restituisce un nuovo refresh_token: Google lo manda solo la prima
    // volta che l'app viene autorizzata.
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parametri.toString()}`;
}

type TokenGoogle = { access_token: string; refresh_token?: string; expires_in: number; token_type: string };

export async function scambiaCodice(code: string): Promise<TokenGoogle> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri(), grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Scambio del codice non riuscito: ${await res.text()}`);
  return res.json();
}

export async function rinnovaAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Rinnovo del token non riuscito: ${await res.text()}`);
  const body = (await res.json()) as TokenGoogle;
  return body.access_token;
}

export async function emailAccount(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Lettura dell'account Google non riuscita");
  const body = (await res.json()) as { email?: string };
  return body.email || '';
}

export async function revocaToken(refreshToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' })
    .catch(() => {}); // se fallisce, il token resta valido lato Google ma qui è già cancellato
}

/** Un impegno di Themis, così com'è in eventi — solo i campi che servono qui. */
export type EventoDaSincronizzare = {
  titolo: string; tipo: string; data: string;
  ora_inizio: string | null; ora_fine: string | null; all_day: boolean;
  luogo: string | null; note: string | null;
};

const FUSO = 'Europe/Rome';

function corpoEvento(ev: EventoDaSincronizzare) {
  const descrizione = [ev.note, ev.luogo ? `Luogo: ${ev.luogo}` : null].filter(Boolean).join('\n\n');
  if (ev.all_day || !ev.ora_inizio) {
    return {
      summary: ev.titolo,
      description: descrizione || undefined,
      start: { date: ev.data },
      end: { date: ev.data },
    };
  }
  const fine = ev.ora_fine || ev.ora_inizio;
  return {
    summary: ev.titolo,
    description: descrizione || undefined,
    location: ev.luogo || undefined,
    start: { dateTime: `${ev.data}T${ev.ora_inizio}:00`, timeZone: FUSO },
    end: { dateTime: `${ev.data}T${fine}:00`, timeZone: FUSO },
  };
}

export async function creaEventoGoogle(
  accessToken: string, calendarId: string, ev: EventoDaSincronizzare,
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoEvento(ev)),
    },
  );
  if (!res.ok) throw new Error(`Creazione evento su Google non riuscita: ${await res.text()}`);
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** Un 404/410 significa che l'evento non esiste già più su Google: va
 * trattato come successo, non come errore — è comunque sparito. */
export async function eliminaEventoGoogle(
  accessToken: string, calendarId: string, googleEventId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Eliminazione evento su Google non riuscita: ${await res.text()}`);
  }
}

export type EventoGoogleImportato = {
  id: string; titolo: string; data: string;
  ora_inizio: string | null; ora_fine: string | null; all_day: boolean; note: string | null;
};

export async function elencaEventiGoogle(
  accessToken: string, calendarId: string, da: string, a: string,
): Promise<EventoGoogleImportato[]> {
  const parametri = new URLSearchParams({
    timeMin: `${da}T00:00:00Z`,
    timeMax: `${a}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${parametri.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Lettura degli eventi Google non riuscita: ${await res.text()}`);
  const body = (await res.json()) as {
    items: { id: string; summary?: string; description?: string; status: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string } }[];
  };
  return (body.items || [])
    .filter((it) => it.status !== 'cancelled')
    .map((it) => {
      const allDay = !!it.start.date;
      return {
        id: it.id,
        titolo: it.summary || '(senza titolo)',
        data: (it.start.date || it.start.dateTime || '').slice(0, 10),
        ora_inizio: allDay ? null : (it.start.dateTime || '').slice(11, 16),
        ora_fine: allDay ? null : (it.end.dateTime || '').slice(11, 16),
        all_day: allDay,
        note: it.description || null,
      };
    });
}
