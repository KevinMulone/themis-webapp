import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { GOOGLE_KEY_SCOPE_PREFIX, rinnovaAccessToken } from './calendar';

/**
 * L'access token valido di uno studio, pronto per una chiamata all'API.
 * Va richiesto da capo ogni volta: dura un'ora e non si conserva mai,
 * solo il refresh_token (cifrato) resta in tabella.
 *
 * Restituisce null se lo studio non ha Google Calendar collegato o l'ha
 * disattivato: il chiamante decide se quello è un errore o un no-op.
 */
export async function accountGoogleAttivo(studioId: string): Promise<
  { accessToken: string; calendarId: string } | null
> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from('google_calendar_account')
    .select('calendar_id, attivo')
    .eq('studio_id', studioId)
    .maybeSingle();
  if (!account || !account.attivo) return null;

  const { data: cred } = await admin
    .from('google_calendar_credenziali')
    .select('refresh_token_cifrato')
    .eq('studio_id', studioId)
    .maybeSingle();
  if (!cred) return null;

  const refreshToken = decryptBuffer(
    Buffer.from(cred.refresh_token_cifrato, 'base64'),
    GOOGLE_KEY_SCOPE_PREFIX + studioId,
  ).toString('utf-8');

  const accessToken = await rinnovaAccessToken(refreshToken);
  return { accessToken, calendarId: account.calendar_id };
}
