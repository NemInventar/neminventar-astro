import { useEffect, useState } from 'react';
import ContactForm from './ContactForm';
import CallbackForm from './CallbackForm';

// Forsidens tredje vej: "Send os materialet" (forside v3, 05-10-2026). Tre spor — en skitse eller et foto, udbud og
// tegninger, eller bare en mail. Skitse og udbud bruger den samme ContactForm med hvert sit spor, så leadet i CRM
// viser, hvordan henvendelsen kom ind. "Bare en mail" viser adresserne og "Bestil et opkald".
// Fra toppens designer: et 'ni:tilbud'-event med spec-teksten åbner skitse-sporet med teksten i beskeden (spor designer).
// lang: den engelske forside (06-11-2026) har samme panel; formularen og "Bestil et opkald" får sproget med.
type Mode = 'skitse' | 'udbud' | 'mail';
const T = {
  da: { modes: ['Skitse eller foto', 'Udbud og tegninger', 'Bare en mail'], hvad: 'Hvad vil I sende?', direkte: 'Skriv direkte til os', kopieret: 'Kopieret', kopier: 'Kopiér',
    tekst: 'Skriv, hvad I skal have, og vedhæft gerne tegninger eller udbuddet. Vi svarer inden for én arbejdsdag.', opkald: 'Hellere tale sammen? Bestil et opkald' },
  en: { modes: ['Sketch or photo', 'Tender and drawings', 'Just an email'], hvad: 'What would you like to send?', direkte: 'Write to us directly', kopieret: 'Copied', kopier: 'Copy',
    tekst: 'Tell us what you need, and feel free to attach drawings or the tender documents. We reply within one working day.', opkald: 'Rather talk? Book a call' },
};
const MODER: Mode[] = ['skitse', 'udbud', 'mail'];

// 'ni:tilbud' bærer enten tekst (toppens designer → spor designer) eller et objekt fra et kort: en variant (D4 → spor
// variant + konfiguration) eller en type uden kulør (spor skitse, kun emnet).
type Tilbud = { besked: string; spor: 'designer' | 'variant' | 'skitse'; konfiguration?: Record<string, string> };
const somTilbud = (d: unknown): Tilbud | null => {
  if (typeof d === 'string') return d ? { besked: d, spor: 'designer' } : null;
  const t = d as Tilbud | null;
  return t && typeof t === 'object' && typeof t.besked === 'string' && ['variant', 'designer', 'skitse'].includes(t.spor) ? t : null;
};

export default function SendPanel({ lang = 'da' }: { lang?: 'da' | 'en' }) {
  const t = T[lang];
  const [mode, setMode] = useState<Mode>('skitse');
  const [tilbud, setTilbud] = useState<Tilbud | null>(null);
  const [kopieret, setKopieret] = useState(false);

  useEffect(() => {
    // Panelet hydreres først, når det bliver synligt (client:visible) — en besked, der kom før, ligger på window.
    const w = window as unknown as { niTilbud?: unknown };
    const t0 = somTilbud(w.niTilbud);
    if (t0) { setTilbud(t0); setMode('skitse'); }
    const on = (e: Event) => { const t = somTilbud((e as CustomEvent<unknown>).detail); if (t) { setTilbud(t); setMode('skitse'); } };
    window.addEventListener('ni:tilbud', on);
    return () => window.removeEventListener('ni:tilbud', on);
  }, []);

  const kopier = () => {
    const done = () => { setKopieret(true); setTimeout(() => setKopieret(false), 1600); };
    try { navigator.clipboard.writeText('tilbud@neminventar.dk').then(done, () => {}); } catch { /* vis adressen; den kan markeres */ }
  };

  return (
    <div className="sendpanel">
      <div className="seg" role="group" aria-label={t.hvad}>
        {MODER.map((k, i) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{t.modes[i]}</button>
        ))}
      </div>
      {mode === 'mail' ? (
        <div className="sp-mail">
          <span className="sp-lbl">{t.direkte}</span>
          <div className="sp-addr"><a href="mailto:tilbud@neminventar.dk">tilbud@neminventar.dk</a><button type="button" className="btn btn-ghost sp-copy" onClick={kopier}>{kopieret ? t.kopieret : t.kopier}</button></div>
          <p>{t.tekst}</p>
          <CallbackForm label={t.opkald} lang={lang} />
        </div>
      ) : (
        // key: et nyt spor giver en frisk formular (placeholder og spor følger med)
        <ContactForm key={mode + (tilbud ? ':' + tilbud.spor + ':' + tilbud.besked : '')} spor={tilbud ? tilbud.spor : mode} besked={tilbud?.besked ?? ''} konfiguration={tilbud?.konfiguration} lang={lang} />
      )}
    </div>
  );
}
