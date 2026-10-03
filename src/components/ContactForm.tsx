import { useEffect, useState } from 'react';

// Poster til contact-form edge function på ERP-projektet (guhbrpektblabndqttgp).
// Funktionen sender en notifikation via Microsoft Graph til tilbud@ + kontakt@ med reply-to
// = afsenderen. verify_jwt=false → ingen nøgle i klient-bundtet (fast modtager + honeypot beskytter).
const FUNCTION_URL = 'https://guhbrpektblabndqttgp.supabase.co/functions/v1/contact-form';

type Status = 'idle' | 'sending' | 'ok' | 'error';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', message: '', website: '' });
  // Privat eller erhverv (Joachim 01-10-2026): virksomhedsfeltet kræves kun for erhverv.
  // Edge-funktionen kræver ikke virksomhed, så private sendes som "Privatkunde" i det felt.
  const [kundetype, setKundetype] = useState<'erhverv' | 'privat'>('erhverv');
  const privat = kundetype === 'privat';
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

  // Kommer man fra en produkt- eller landingsside ("Få pris på denne"), står emnet i ?emne=… og skrives
  // øverst i beskeden, så vi ved, hvad henvendelsen handler om. Sættes efter mount, så server og klient er ens.
  useEffect(() => {
    const emne = new URLSearchParams(location.search).get('emne');
    if (emne) setForm((f) => (f.message ? f : { ...f, message: `Vedr. ${emne}\n\n` }));
  }, []);

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) {
      setStatus('error');
      setErrMsg('Indtast venligst en gyldig e-mailadresse.');
      return;
    }
    if (!form.name.trim() || !form.message.trim() || (!privat && !form.company.trim())) {
      setStatus('error');
      setErrMsg(privat ? 'Udfyld navn og en besked.' : 'Udfyld navn, virksomhed og en besked.');
      return;
    }
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, company: privat ? 'Privatkunde' : form.company }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus('ok');
      } else {
        throw new Error(data?.error || 'Kunne ikke sende beskeden.');
      }
    } catch (err) {
      setStatus('error');
      setErrMsg('Der opstod en fejl ved afsendelse. Prøv igen, eller ring til os på +45 42 42 26 84.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="form">
        <div className="form-done">
          <h3>Tak — beskeden er sendt.</h3>
          <p>Vi vender tilbage hurtigst muligt. Haster det, så ring på +45 42 42 26 84.</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  return (
    <form className="form" onSubmit={submit} noValidate>
      {/* Honeypot — usynligt for mennesker; bots udfylder det og afvises server-side */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={form.website} onChange={update}
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />
      <div className="kundetype" role="radiogroup" aria-label="Er du privat eller erhverv?">
        {(['erhverv', 'privat'] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={kundetype === t}
            className={kundetype === t ? 'on' : ''} onClick={() => setKundetype(t)} disabled={sending}>
            {t === 'erhverv' ? 'Erhverv' : 'Privat'}
          </button>
        ))}
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="cf-name">Navn *</label>
          <input id="cf-name" name="name" autoComplete="name" required value={form.name} onChange={update} disabled={sending} />
        </div>
        {privat ? (
          <div className="field">
            <label htmlFor="cf-phone">Telefon</label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} disabled={sending} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="cf-company">Virksomhed *</label>
            <input id="cf-company" name="company" autoComplete="organization" required value={form.company} onChange={update} disabled={sending} />
          </div>
        )}
      </div>
      {privat ? (
        <div className="field">
          <label htmlFor="cf-email">E-mail *</label>
          <input id="cf-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} disabled={sending} />
        </div>
      ) : (
        <div className="row">
          <div className="field">
            <label htmlFor="cf-email">E-mail *</label>
            <input id="cf-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} disabled={sending} />
          </div>
          <div className="field">
            <label htmlFor="cf-phone">Telefon</label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} disabled={sending} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="cf-message">{privat ? 'Hvad skal du have lavet? *' : 'Besked / projektbeskrivelse *'}</label>
        <textarea id="cf-message" name="message" required rows={5} value={form.message} onChange={update}
          disabled={sending} placeholder={privat
            ? 'Fx en reol på mål til stuen eller skabe til entréen — gerne med mål.'
            : 'Beskriv kort jeres projekt og behov — eller vedhæft tegninger i en mail.'} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Sender…' : 'Send besked'} <span className="arr">→</span>
      </button>
      {status === 'error' && <p className="form-msg err">{errMsg}</p>}
      {privat && (
        <p className="callback-note">Som privat handler du efter vores <a href={`${import.meta.env.BASE_URL}handelsbetingelser`}>handelsbetingelser for private</a>.</p>
      )}
    </form>
  );
}
