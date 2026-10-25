import { useEffect, useRef, useState } from 'react';
import { KILDE_SVAR, hentKilde, starterPrivat } from '../lib/kilde';
import { variantFraUrl } from '../lib/varianter';
import { formularFetch, uploadAdresse, type Via } from '../lib/api';

// Poster til contact-form edge function på ERP-projektet (guhbrpektblabndqttgp).
// Adressen vælges i src/lib/api.ts: supabase.co direkte, eller api.neminventar.dk, når API_AKTIV er sat.
// Funktionen sender en notifikation via Microsoft Graph til tilbud@ + kontakt@ med reply-to
// = afsenderen. verify_jwt=false → ingen nøgle i klient-bundtet (fast modtager + honeypot beskytter).
//
// Filer (04-10-2026): tegninger, udbudsmateriale og fotos kan vedhæftes. Flowet er to trin:
//   1) action='upload-urls' → funktionen tjekker filtype/størrelse og udsteder signerede upload-adresser
//   2) browseren PUT'er hver fil direkte til Storage (bucket web-henvendelser, privat) — ingen nøgle, ingen omvej
//   3) beskeden sendes med upload_id + fil-stierne; mailen får links, og henvendelsen gemmes i Supabase.
// Grænserne (10 filer, 50 MB, filtyper) er de samme som i funktionen — tjekkes her for hurtig besked til brugeren.
const MAX_FILES = 10;
const MAX_MB = 50;
const EXT = ['pdf', 'dwg', 'dxf', 'ifc', 'rvt', 'skp', 'step', 'stp', 'zip', '7z', 'rar', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'pptx', 'odt', 'ods'];
const ACCEPT = EXT.map((e) => '.' + e).join(',') + ',image/*,application/pdf';

type Status = 'idle' | 'sending' | 'ok' | 'error';
type UploadUrl = { name: string; size: number; path: string; url: string; token: string };
type Progress = { i: number; pct: number };

const extOf = (n: string) => (n.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? '').toLowerCase();
const fmt = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// PUT direkte til den signerede adresse. XMLHttpRequest, så vi kan vise fremdrift på store tegninger.
function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload network'));
    xhr.send(file);
  });
}

// Gik kaldet via api.neminventar.dk, går filen også den vej. Netværksfejl dér → én gang direkte til supabase.co.
// Et HTTP-svar (fx 400) prøves ikke igen.
async function putFil(url: string, via: Via, file: File, onProgress: (pct: number) => void): Promise<void> {
  const adr = uploadAdresse(url, via);
  try {
    await putFile(adr, file, onProgress);
  } catch (e) {
    if (adr === url || !(e instanceof Error && e.message === 'upload network')) throw e;
    onProgress(0);
    await putFile(url, file, onProgress);
  }
}

// spor (05-10-2026, konverteringslaget): hvor formularen er åbnet — følger med i leadet i CRM.
type Spor = 'besked' | 'skitse' | 'udbud' | 'designer' | 'variant';
declare global { interface Window { plausible?: (e: string, o?: { props?: Record<string, string> }) => void } }

// Pladsholder pr. spor (forsidens "Send os materialet"); besked = forudfyldt tekst (fx spec fra designeren).
const PLACEHOLDER: Partial<Record<Spor, string>> = {
  skitse: 'Fx 6 højskabe i blå krydsfiner, 210 cm høje, til et personalerum. Et foto af rummet eller en skitse med mål kan vedhæftes herunder.',
  udbud: 'Fx fast inventar til en ny daginstitution, licitation 14/11. Vedhæft udbuddet herunder, eller skriv linket til Dalux eller iBinder.',
};

// konfiguration (D4): varianten (eller senere designerens tilstand) følger med henvendelsen (contact-form v6, højst 4 KB).
// Kommer man fra "Få pris på denne" på en typeside, står varianten i ?v=<slug>~<kulør> → spor 'variant'.
// Engelsk udgave (/en/contact/, backlog e2c66652): samme formular og samme edge function. Sproget kan ses på leadet,
// fordi `side` (/en/contact/) følger med og står i leadets beskrivelse og i mailen. "Hvor fandt I os?" sender den danske
// værdi (KILDE_SVAR), så lead_kanal mappes ens; kun teksten i listen er engelsk.
const KILDE_EN: Record<string, string> = {
  'Google': 'Google', 'ChatGPT eller anden AI': 'ChatGPT or another AI', 'Anbefaling': 'Recommendation',
  'LinkedIn': 'LinkedIn', 'Vi har arbejdet sammen før': 'We have worked together before', 'Andet': 'Other',
};
// Tysk light-udgave (/de/, backlog 3de10daf): samme mekanik, `side` = /de/ viser sproget på leadet.
const KILDE_DE: Record<string, string> = {
  'Google': 'Google', 'ChatGPT eller anden AI': 'ChatGPT oder eine andere KI', 'Anbefaling': 'Empfehlung',
  'LinkedIn': 'LinkedIn', 'Vi har arbejdet sammen før': 'Wir haben schon zusammengearbeitet', 'Andet': 'Sonstiges',
};
const TXT = {
  da: {
    badEmail: 'Indtast venligst en gyldig e-mailadresse.', needPriv: 'Udfyld navn og en besked.', needBiz: 'Udfyld navn, virksomhed og en besked.',
    fail: 'Der opstod en fejl ved afsendelse. Prøv igen, eller ring til os på +45 42 42 26 84.',
    thanks: (n: number) => `Tak — beskeden${n ? ` og ${n} ${n === 1 ? 'fil' : 'filer'}` : ''} er sendt.`,
    thanksP: 'Vi vender tilbage hurtigst muligt. Haster det, så ring på +45 42 42 26 84.',
    sendingFile: (i: number, n: number, pct: number) => `Sender fil ${i} af ${n} · ${pct} %`, sending: 'Sender…',
    send: (n: number) => (n ? `Send besked og ${n} ${n === 1 ? 'fil' : 'filer'}` : 'Send besked'),
    typeAria: 'Er du privat eller erhverv?', biz: 'Erhverv', priv: 'Privat',
    name: 'Navn *', phone: 'Telefon', company: 'Virksomhed *', email: 'E-mail *',
    msgPriv: 'Hvad skal du have lavet? *', msgBiz: 'Besked / projektbeskrivelse *',
    phPriv: 'Fx en reol på mål til stuen eller skabe til entréen — gerne med mål. Et foto af rummet kan vedhæftes herunder.',
    phBiz: 'Beskriv kort jeres projekt og behov. Tegninger, beskrivelse eller tilbudsliste kan vedhæftes herunder.',
    filesPriv: 'Fotos, skitser eller tegninger (valgfrit)', filesBiz: 'Tegninger, beskrivelse eller tilbudsliste (valgfrit)',
    dzAria: 'Vælg filer, eller træk dem hertil', dz1: 'Træk filer hertil', dz2: 'eller klik for at vælge',
    dzSmall: `PDF, DWG, DXF, IFC, billeder, Excel, Word, ZIP · højst ${MAX_FILES} filer à ${MAX_MB} MB`,
    filesAria: 'Valgte filer', remove: 'Fjern', kilde: 'Hvor fandt I os?', optional: '(valgfrit)', choose: 'Vælg',
    fileFail: (n: string) => `${n} kunne ikke sendes. Prøv igen — eller send filerne i en mail til tilbud@neminventar.dk.`,
  },
  en: {
    badEmail: 'Please enter a valid email address.', needPriv: 'Please fill in your name and a message.', needBiz: 'Please fill in your name, company and a message.',
    fail: 'Something went wrong. Please try again, or email tilbud@neminventar.dk.',
    thanks: (n: number) => `Thank you, your message${n ? ` and ${n} ${n === 1 ? 'file' : 'files'}` : ''} has been sent.`,
    thanksP: 'We will reply in English as soon as we can. If it is urgent, call +45 42 42 26 84.',
    sendingFile: (i: number, n: number, pct: number) => `Sending file ${i} of ${n} · ${pct} %`, sending: 'Sending…',
    send: (n: number) => (n ? `Send message and ${n} ${n === 1 ? 'file' : 'files'}` : 'Send message'),
    typeAria: 'Business or private?', biz: 'Business', priv: 'Private',
    name: 'Name *', phone: 'Phone', company: 'Company *', email: 'Email *',
    msgPriv: 'What would you like us to make? *', msgBiz: 'Message / project description *',
    phPriv: 'For example a wardrobe for the hallway, with the measurements of the wall. A photo of the room can be attached below.',
    phBiz: 'Tell us briefly about the project: building type, quantities and timing. Drawings, specifications or the bill of quantities can be attached below.',
    filesPriv: 'Photos, sketches or drawings (optional)', filesBiz: 'Drawings, specifications or bill of quantities (optional)',
    dzAria: 'Choose files, or drag them here', dz1: 'Drag files here', dz2: 'or click to choose',
    dzSmall: `PDF, DWG, DXF, IFC, images, Excel, Word, ZIP · up to ${MAX_FILES} files of ${MAX_MB} MB`,
    filesAria: 'Selected files', remove: 'Remove', kilde: 'How did you find us?', optional: '(optional)', choose: 'Choose',
    fileFail: (n: string) => `${n} could not be sent. Try again, or email the files to tilbud@neminventar.dk.`,
  },
  de: {
    badEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', needPriv: 'Bitte Name und Nachricht ausfüllen.', needBiz: 'Bitte Name, Firma und Nachricht ausfüllen.',
    fail: 'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder schreiben Sie an tilbud@neminventar.dk.',
    thanks: (n: number) => `Vielen Dank, Ihre Nachricht${n ? ` und ${n} ${n === 1 ? 'Datei' : 'Dateien'}` : ''} wurde gesendet.`,
    thanksP: 'Wir antworten so bald wie möglich, auf Deutsch oder Englisch. In dringenden Fällen: +45 42 42 26 84.',
    sendingFile: (i: number, n: number, pct: number) => `Sende Datei ${i} von ${n} · ${pct} %`, sending: 'Wird gesendet…',
    send: (n: number) => (n ? `Nachricht und ${n} ${n === 1 ? 'Datei' : 'Dateien'} senden` : 'Nachricht senden'),
    typeAria: 'Gewerblich oder privat?', biz: 'Gewerblich', priv: 'Privat',
    name: 'Name *', phone: 'Telefon', company: 'Firma / Schule *', email: 'E-Mail *',
    msgPriv: 'Was sollen wir für Sie bauen? *', msgBiz: 'Nachricht / Projektbeschreibung *',
    phPriv: 'Zum Beispiel ein Schrank für den Flur, mit den Maßen der Wand. Ein Foto des Raums können Sie unten anhängen.',
    phBiz: 'Beschreiben Sie kurz das Projekt: Gebäude, Stückzahlen und Zeitplan. Zeichnungen, Leistungsverzeichnis oder Ausschreibung können Sie unten anhängen.',
    filesPriv: 'Fotos, Skizzen oder Zeichnungen (optional)', filesBiz: 'Zeichnungen, Leistungsverzeichnis oder Ausschreibung (optional)',
    dzAria: 'Dateien auswählen oder hierher ziehen', dz1: 'Dateien hierher ziehen', dz2: 'oder zum Auswählen klicken',
    dzSmall: `PDF, DWG, DXF, IFC, Bilder, Excel, Word, ZIP · bis zu ${MAX_FILES} Dateien à ${MAX_MB} MB`,
    filesAria: 'Ausgewählte Dateien', remove: 'Entfernen', kilde: 'Wie haben Sie uns gefunden?', optional: '(optional)', choose: 'Auswählen',
    fileFail: (n: string) => `${n} konnte nicht gesendet werden. Bitte erneut versuchen oder die Dateien per E-Mail an tilbud@neminventar.dk senden.`,
  },
};

export default function ContactForm({ spor = 'besked', besked = '', konfiguration, lang = 'da' }: { spor?: Spor; besked?: string; konfiguration?: Record<string, string>; lang?: 'da' | 'en' | 'de' }) {
  const T = TXT[lang];
  const en = lang !== 'da';   // engelsk og tysk deler de faste valg (ingen danske pladsholdere, fast fejltekst)
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', message: '', hp: '' });
  const [urlVariant, setUrlVariant] = useState<Record<string, string> | null>(null);
  const konf = konfiguration ?? urlVariant;
  const sporNu: Spor = konfiguration ? spor : urlVariant ? 'variant' : spor;
  // "Hvor fandt I os?" — valgfrit. Besøgerens eget svar vinder over referreren i leadets lead_kanal.
  const [kilde, setKilde] = useState('');
  // Tidsfælde: en formular udfyldt på under 3 sekunder får ingen lead (edge-funktionen afgør det).
  const t0 = useRef(Date.now());
  // Privat eller erhverv (Joachim 01-10-2026): virksomhedsfeltet kræves kun for erhverv.
  // Edge-funktionen kræver ikke virksomhed, så private sendes som "Privatkunde" i det felt.
  const [kundetype, setKundetype] = useState<'erhverv' | 'privat'>('erhverv');
  const privat = kundetype === 'privat';
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sentFiles, setSentFiles] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Kommer man fra en produkt- eller landingsside ("Få pris på denne"), står emnet i ?emne=… og skrives
  // øverst i beskeden, så vi ved, hvad henvendelsen handler om. Sættes efter mount, så server og klient er ens.
  useEffect(() => {
    const emne = new URLSearchParams(location.search).get('emne');
    if (besked) setForm((f) => ({ ...f, message: `${besked}\n\n` }));
    else if (emne) setForm((f) => (f.message ? f : { ...f, message: `${lang === 'de' ? 'Betreff:' : en ? 'Re:' : 'Vedr.'} ${emne}\n\n` }));
    setUrlVariant(variantFraUrl(location.search));
    // fra en side til private eller en annonce til private: start på Privat (starterPrivat, 22-10-2026)
    if (starterPrivat(location.search)) setKundetype('privat');
  }, [besked, en]);

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    const errs: string[] = [];
    for (const f of Array.from(list)) {
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      if (!EXT.includes(extOf(f.name))) { errs.push(lang === 'de' ? `${f.name}: dieser Dateityp kann hier nicht gesendet werden` : en ? `${f.name}: this file type cannot be sent here` : `${f.name}: den filtype kan ikke sendes her`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { errs.push(`${f.name}: over ${MAX_MB} MB`); continue; }
      if (f.size === 0) { errs.push(lang === 'de' ? `${f.name}: die Datei ist leer` : en ? `${f.name}: the file is empty` : `${f.name}: filen er tom`); continue; }
      if (next.length >= MAX_FILES) { errs.push(lang === 'de' ? `Höchstens ${MAX_FILES} Dateien auf einmal` : en ? `Up to ${MAX_FILES} files at a time` : `Højst ${MAX_FILES} filer ad gangen`); break; }
      next.push(f);
    }
    setFiles(next);
    if (errs.length) { setStatus('error'); setErrMsg(errs.join(' · ')); }
    else if (status === 'error') { setStatus('idle'); setErrMsg(''); }
  }
  const removeFile = (i: number) => setFiles((fs) => fs.filter((_, j) => j !== i));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) {
      setStatus('error');
      setErrMsg(T.badEmail);
      return;
    }
    if (!form.name.trim() || !form.message.trim() || (!privat && !form.company.trim())) {
      setStatus('error');
      setErrMsg(privat ? T.needPriv : T.needBiz);
      return;
    }
    setStatus('sending');
    setErrMsg('');
    const headers = { 'Content-Type': 'application/json' };
    try {
      // Trin 1 + 2: filerne lægges i Storage, før beskeden sendes
      let upload_id: string | undefined;
      const sent: { name: string; size: number; path: string }[] = [];
      if (files.length) {
        const { res: r, via } = await formularFetch({
          method: 'POST', headers,
          body: JSON.stringify({ action: 'upload-urls', hp: form.hp, files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) }),
        });
        const d = await r.json().catch(() => ({}));
        const urls: UploadUrl[] = Array.isArray(d?.files) ? d.files : [];
        if (!r.ok || !d?.success || urls.length !== files.length) throw new Error(d?.error || 'Kunne ikke gøre klar til upload.');
        upload_id = d.upload_id;
        for (let i = 0; i < files.length; i++) {
          setProgress({ i, pct: 0 });
          try {
            await putFil(urls[i].url, via, files[i], (pct) => setProgress({ i, pct }));
          } catch {
            throw new Error(T.fileFail(files[i].name));
          }
          sent.push({ name: files[i].name, size: files[i].size, path: urls[i].path });
        }
        setProgress(null);
      }
      // Trin 3: beskeden
      const { res } = await formularFetch({
        method: 'POST', headers,
        body: JSON.stringify({
          ...form, company: privat ? 'Privatkunde' : form.company, side: location.pathname, upload_id, files: sent,
          spor: sporNu, ...(konf ? { konfiguration: konf } : {}), kilde_svar: kilde, ...hentKilde(), ms: Date.now() - t0.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSentFiles(Number(data.files ?? sent.length));
        setStatus('ok');
        try { window.plausible?.('Henvendelse sendt', { props: { spor: sporNu, kilde: kilde || 'ikke oplyst' } }); } catch { /* statistik er valgfri */ }
      } else {
        throw new Error(data?.error || 'Kunne ikke sende beskeden.');
      }
    } catch (err) {
      setProgress(null);
      setStatus('error');
      const msg = err instanceof Error ? err.message : '';
      // Funktionens egne fejltekster er på dansk; på engelsk vises filfejlen eller en fast tekst.
      setErrMsg(msg && !/^upload /.test(msg) && (!en || /could not be sent|konnte nicht gesendet/.test(msg)) ? msg : T.fail);
    }
  }

  if (status === 'ok') {
    return (
      <div className="form">
        <div className="form-done">
          <h3>{T.thanks(sentFiles)}</h3>
          <p>{T.thanksP}</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  const sendLabel = sending
    ? (progress ? T.sendingFile(progress.i + 1, files.length, progress.pct) : T.sending)
    : T.send(files.length);

  return (
    <form className="form" onSubmit={submit} noValidate>
      {/* Honeypot — usynligt for mennesker; bots udfylder det og afvises server-side */}
      <input type="text" name="hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={form.hp} onChange={update}
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />
      <div className="kundetype" role="radiogroup" aria-label={T.typeAria}>
        {(['erhverv', 'privat'] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={kundetype === t}
            className={kundetype === t ? 'on' : ''} onClick={() => setKundetype(t)} disabled={sending}>
            {t === 'erhverv' ? T.biz : T.priv}
          </button>
        ))}
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="cf-name">{T.name}</label>
          <input id="cf-name" name="name" autoComplete="name" required value={form.name} onChange={update} disabled={sending} />
        </div>
        {privat ? (
          <div className="field">
            <label htmlFor="cf-phone">{T.phone}</label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} disabled={sending} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="cf-company">{T.company}</label>
            <input id="cf-company" name="company" autoComplete="organization" required value={form.company} onChange={update} disabled={sending} />
          </div>
        )}
      </div>
      {privat ? (
        <div className="field">
          <label htmlFor="cf-email">{T.email}</label>
          <input id="cf-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} disabled={sending} />
        </div>
      ) : (
        <div className="row">
          <div className="field">
            <label htmlFor="cf-email">{T.email}</label>
            <input id="cf-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} disabled={sending} />
          </div>
          <div className="field">
            <label htmlFor="cf-phone">{T.phone}</label>
            <input id="cf-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} disabled={sending} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="cf-message">{privat ? T.msgPriv : T.msgBiz}</label>
        <textarea id="cf-message" name="message" required rows={5} value={form.message} onChange={update}
          disabled={sending} placeholder={privat ? T.phPriv : (en ? undefined : PLACEHOLDER[sporNu]) ?? T.phBiz} />
      </div>
      <div className="field">
        <label htmlFor="cf-files">{privat ? T.filesPriv : T.filesBiz}</label>
        <div className={`dropzone${drag ? ' drag' : ''}${sending ? ' off' : ''}`} role="button" tabIndex={sending ? -1 : 0}
          aria-label={T.dzAria}
          onClick={() => !sending && fileRef.current?.click()}
          onKeyDown={(e) => { if (!sending && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!sending) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!sending && e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}>
          <input ref={fileRef} id="cf-files" type="file" multiple accept={ACCEPT} hidden disabled={sending}
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
          <span className="dz-ico" aria-hidden="true">↑</span>
          <span><b>{T.dz1}</b> {T.dz2}</span>
          <small>{T.dzSmall}</small>
        </div>
        {files.length > 0 && (
          <ul className="filelist" aria-label={T.filesAria}>
            {files.map((f, i) => (
              <li key={f.name + f.size}>
                <span className="fn" title={f.name}>{f.name}</span>
                <span className="fs">{fmt(f.size)}</span>
                {progress && progress.i === i ? <span className="fp">{progress.pct} %</span>
                  : progress && progress.i > i ? <span className="fp ok">✓</span>
                  : <button type="button" aria-label={`${T.remove} ${f.name}`} onClick={() => removeFile(i)} disabled={sending}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="field">
        <label htmlFor="cf-kilde">{T.kilde} <span className="valgfrit">{T.optional}</span></label>
        <select id="cf-kilde" name="kilde" value={kilde} onChange={(e) => setKilde(e.target.value)} disabled={sending}>
          <option value="">{T.choose}</option>
          {KILDE_SVAR.map((k) => <option key={k} value={k}>{lang === 'de' ? KILDE_DE[k] ?? k : en ? KILDE_EN[k] ?? k : k}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sendLabel} <span className="arr">→</span>
      </button>
      {status === 'error' && <p className="form-msg err">{errMsg}</p>}
      {lang === 'de' ? (
      <p className="callback-note">
        Ihre Angaben und Dateien werden bei unserem Auftragsverarbeiter gespeichert und nur verwendet, um Ihnen zu antworten. Siehe <a href={`${import.meta.env.BASE_URL}de/datenschutz/`}>Datenschutzerklärung</a>.
      </p>
      ) : en ? (
      <p className="callback-note">
        Your details and files are stored with our data processor and used only to reply to you. Our <a href={`${import.meta.env.BASE_URL}privatlivspolitik`} hreflang="da">privacy policy</a> is in Danish.
      </p>
      ) : (
      <p className="callback-note">
        Oplysninger og filer gemmes hos vores databehandler og bruges kun til at svare dig — se vores <a href={`${import.meta.env.BASE_URL}privatlivspolitik`}>privatlivspolitik</a>.
        {privat && <> Som privat handler du efter vores <a href={`${import.meta.env.BASE_URL}handelsbetingelser`}>handelsbetingelser for private</a>.</>}
      </p>
      )}
    </form>
  );
}
