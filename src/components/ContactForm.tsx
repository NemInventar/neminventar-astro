import { useState } from 'react';

// Poster til det EKSISTERENDE send-email edge function på det gamle Supabase-projekt
// (nlyqbvwryocpzrwicxmf). Funktionen sender mail via Resend + gemmer i contact_submissions,
// har CORS '*' og kan kaldes fra dette domæne. Anon-nøglen her er det gamle sites OFFENTLIGE
// nøgle (allerede eksponeret), så den er client-safe.
const FUNCTION_URL = 'https://nlyqbvwryocpzrwicxmf.supabase.co/functions/v1/send-email';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seXFidndyeW9jcHpyd2ljeG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODU2NDgsImV4cCI6MjA4NDA2MTY0OH0.ThtWbrjBXKwo-MzwL-eIkU5yH_lnFWgSZ4ptxSbwUq8';

type Status = 'idle' | 'sending' | 'ok' | 'error';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', message: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

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
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus('ok');
      } else {
        throw new Error(data?.error || 'Kunne ikke sende beskeden.');
      }
    } catch (err) {
      setStatus('error');
      setErrMsg('Der opstod en fejl ved afsendelse. Prøv igen, eller ring til os på +45 40 14 05 08.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="form">
        <div className="form-done">
          <h3>Tak — beskeden er sendt.</h3>
          <p>Vi vender tilbage hurtigst muligt. Haster det, så ring på +45 40 14 05 08.</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="row">
        <div className="field">
          <label htmlFor="cf-name">Navn *</label>
          <input id="cf-name" name="name" required value={form.name} onChange={update} disabled={sending} />
        </div>
        <div className="field">
          <label htmlFor="cf-company">Virksomhed *</label>
          <input id="cf-company" name="company" required value={form.company} onChange={update} disabled={sending} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="cf-email">E-mail *</label>
          <input id="cf-email" name="email" type="email" required value={form.email} onChange={update} disabled={sending} />
        </div>
        <div className="field">
          <label htmlFor="cf-phone">Telefon *</label>
          <input id="cf-phone" name="phone" type="tel" required value={form.phone} onChange={update} disabled={sending} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cf-message">Besked / projektbeskrivelse *</label>
        <textarea id="cf-message" name="message" required rows={5} value={form.message} onChange={update}
          disabled={sending} placeholder="Beskriv kort jeres projekt og behov — eller vedhæft tegninger i en mail." />
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Sender…' : 'Send besked'} <span className="arr">→</span>
      </button>
      {status === 'error' && <p className="form-msg err">{errMsg}</p>}
    </form>
  );
}
