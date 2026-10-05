import { useEffect, useState } from 'react';
import ContactForm from './ContactForm';
import CallbackForm from './CallbackForm';

// Forsidens tredje vej: "Send os materialet" (forside v3, 05-10-2026). Tre spor — en skitse eller et foto, udbud og
// tegninger, eller bare en mail. Skitse og udbud bruger den samme ContactForm med hvert sit spor, så leadet i CRM
// viser, hvordan henvendelsen kom ind. "Bare en mail" viser adresserne og "Bestil et opkald".
// Fra toppens designer: et 'ni:tilbud'-event med spec-teksten åbner skitse-sporet med teksten i beskeden (spor designer).
type Mode = 'skitse' | 'udbud' | 'mail';
const MODES: { k: Mode; l: string }[] = [
  { k: 'skitse', l: 'Skitse eller foto' },
  { k: 'udbud', l: 'Udbud og tegninger' },
  { k: 'mail', l: 'Bare en mail' },
];

export default function SendPanel() {
  const [mode, setMode] = useState<Mode>('skitse');
  const [designer, setDesigner] = useState<string>('');
  const [kopieret, setKopieret] = useState(false);

  useEffect(() => {
    // Panelet hydreres først, når det bliver synligt (client:visible) — en besked, der kom før, ligger på window.
    const w = window as unknown as { niTilbud?: string };
    if (w.niTilbud) { setDesigner(w.niTilbud); setMode('skitse'); }
    const on = (e: Event) => { const t = (e as CustomEvent<string>).detail || ''; setDesigner(t); setMode('skitse'); };
    window.addEventListener('ni:tilbud', on);
    return () => window.removeEventListener('ni:tilbud', on);
  }, []);

  const kopier = () => {
    const done = () => { setKopieret(true); setTimeout(() => setKopieret(false), 1600); };
    try { navigator.clipboard.writeText('tilbud@neminventar.dk').then(done, () => {}); } catch { /* vis adressen; den kan markeres */ }
  };

  return (
    <div className="sendpanel">
      <div className="seg" role="group" aria-label="Hvad vil I sende?">
        {MODES.map((m) => (
          <button key={m.k} type="button" aria-pressed={mode === m.k} onClick={() => setMode(m.k)}>{m.l}</button>
        ))}
      </div>
      {mode === 'mail' ? (
        <div className="sp-mail">
          <span className="sp-lbl">Skriv direkte til os</span>
          <div className="sp-addr"><a href="mailto:tilbud@neminventar.dk">tilbud@neminventar.dk</a><button type="button" className="btn btn-ghost sp-copy" onClick={kopier}>{kopieret ? 'Kopieret' : 'Kopiér'}</button></div>
          <p>Skriv, hvad I skal have, og vedhæft gerne tegninger eller udbuddet. Vi svarer inden for én arbejdsdag.</p>
          <CallbackForm label="Hellere tale sammen? Bestil et opkald" />
        </div>
      ) : (
        // key: et nyt spor giver en frisk formular (placeholder og spor følger med)
        <ContactForm key={mode + (designer ? ':d' : '')} spor={designer ? 'designer' : mode} besked={designer} />
      )}
    </div>
  );
}
