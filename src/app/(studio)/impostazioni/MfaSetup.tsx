'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Enrollment = { id: string; qr: string; secret: string };

export default function MfaSetup() {
  const supabase = createClient();
  const [attiva, setAttiva] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [codice, setCodice] = useState('');
  const [messaggio, setMessaggio] = useState('');

  async function controlla() {
    const { data } = await supabase.auth.mfa.listFactors();
    setAttiva((data?.totp || []).some((f) => f.status === 'verified'));
  }
  useEffect(() => { controlla(); }, []);

  async function inizia() {
    setMessaggio('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Themis' });
    if (error || !data.totp) { setMessaggio(error?.message || 'Attivazione non riuscita.'); return; }
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifica() {
    if (!enrollment || codice.length !== 6) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: codice });
    if (error) { setMessaggio('Codice non valido o scaduto. Riprova.'); return; }
    setEnrollment(null); setCodice(''); setMessaggio('Verifica in due passaggi attivata.'); controlla();
  }

  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-neutral-800">Verifica in due passaggi</p><p className="mt-0.5 text-xs text-neutral-500">Protegge dati e documenti anche se la password viene sottratta.</p></div>
        {attiva === true ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Attiva</span> : <button type="button" onClick={inizia} disabled={attiva === null} className="premi rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Attiva 2FA</button>}
      </div>
      {enrollment && <div className="mt-4 grid gap-4 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-[160px_1fr]"><img src={enrollment.qr} alt="Codice QR per l’app di autenticazione" className="h-40 w-40 rounded-xl bg-white p-2"/><div><p className="text-sm font-medium text-neutral-800">Scansiona con Google Authenticator, Microsoft Authenticator o 1Password.</p><p className="mt-2 break-all font-mono text-[11px] text-neutral-500">Codice manuale: {enrollment.secret}</p><div className="mt-3 flex gap-2"><input value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Codice a 6 cifre" className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"/><button type="button" onClick={verifica} disabled={codice.length !== 6} className="rounded-full bg-bordeaux-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Verifica</button></div></div></div>}
      {messaggio && <p className="mt-2 text-xs text-neutral-600">{messaggio}</p>}
    </div>
  );
}
