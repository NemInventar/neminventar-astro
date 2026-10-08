import { useState } from 'react';
import { hentKilde } from '../lib/kilde';
import { formularFetch } from '../lib/api';

// "Bestil et opkald" — poster til contact-form edge function med kind='opkald'.
// Funktionen opretter et lead i CRM, lægger en opgave på Milots huskeliste og giver ham besked
// på mail og Slack. Milot ringer tilbage (Joachim 30-09-2026).
// verify_jwt=false → ingen nøgle i klient-bundtet (honeypot + validering + dedup server-side).
// ref = den eksterne side, der sendte besøgeren hertil (document.referrer) → leadets lead_kanal.
// Bevidst INGEN sessionStorage/localStorage: sitet gemmer intet på besøgerens enhed (ingen cookie-banner).
// Kom de via en intern side, er ref tom → 'Ukendt', og Milot spørger i opkaldet.
// Adressen vælges i src/lib/api.ts: supabase.co direkte, eller api.neminventar.dk, når API_AKTIV er sat.

type Status = 'idle' | 'sending' | 'ok' | 'error';

interface Props { defaultOpen?: boolean; label?: string }

export default function CallbackForm({ defaultOpen = false, label = 'Bestil et opkald' }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState({ name: '', company: '', phone: '', message: '', hp: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

  const update = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 8) {
      setStatus('error');
      setErrMsg('Skriv dit navn og et telefonnummer, så ringer vi dig op.');
      return;
    }
    setStatus('sending');
    setErrMsg('');
    const ref = hentKilde().referrer_host;
    try {
      const { res } = await formularFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, kind: 'opkald', side: location.pathname, ref }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus('ok');
        const w = window as unknown as { plausible?: (e: string, o?: object) => void };
        w.plausible?.('Opkald', { props: { side: location.pathname } });
      } else {
        throw new Error(data?.error || 'fejl');
      }
    } catch {
      setStatus('error');
      setErrMsg('Det lykkedes ikke at sende. Ring til os på +45 42 42 26 84.');
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  if (status === 'ok') {
    return (
      <div className="form callback-form">
        <div className="form-done">
          <h3>Tak, vi ringer dig op.</h3>
          <p>Du hører fra os inden for en arbejdsdag. Haster det, så ring på +45 42 42 26 84.</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  return (
    <form className="form callback-form" id="opkald" onSubmit={submit} noValidate>
      <h3 className="callback-title">Bestil et opkald</h3>
      <p className="callback-lead">Skriv dit nummer, så ringer vi dig op og tager en snak om projektet.</p>
      {/* Honeypot — usynligt for mennesker; bots udfylder det og afvises server-side */}
      <input type="text" name="hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={form.hp} onChange={update}
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />
      <div className="row">
        <div className="field">
          <label htmlFor="cb-name">Navn *</label>
          <input id="cb-name" name="name" autoComplete="name" required value={form.name} onChange={update} disabled={sending} />
        </div>
        <div className="field">
          <label htmlFor="cb-phone">Telefon *</label>
          <input id="cb-phone" name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={update} disabled={sending} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cb-company">Virksomhed</label>
        <input id="cb-company" name="company" autoComplete="organization" value={form.company} onChange={update} disabled={sending} />
      </div>
      <div className="field">
        <label htmlFor="cb-message">Hvad drejer det sig om?</label>
        <input id="cb-message" name="message" value={form.message} onChange={update} disabled={sending}
          placeholder="Fx garderober til en skole, udbud i november" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Sender…' : 'Ring mig op'} <span className="arr">→</span>
      </button>
      {status === 'error' && <p className="form-msg err">{errMsg}</p>}
      <p className="callback-note">Vi bruger kun dit nummer til at ringe dig op. Se vores <a href={`${import.meta.env.BASE_URL}privatlivspolitik`}>privatlivspolitik</a>.</p>
    </form>
  );
}
