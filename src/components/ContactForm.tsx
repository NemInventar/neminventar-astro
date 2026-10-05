import { useEffect, useRef, useState } from 'react';

// Poster til contact-form edge function på ERP-projektet (guhbrpektblabndqttgp).
// Funktionen sender en notifikation via Microsoft Graph til tilbud@ + kontakt@ med reply-to
// = afsenderen. verify_jwt=false → ingen nøgle i klient-bundtet (fast modtager + honeypot beskytter).
//
// Filer (04-10-2026): tegninger, udbudsmateriale og fotos kan vedhæftes. Flowet er to trin:
//   1) action='upload-urls' → funktionen tjekker filtype/størrelse og udsteder signerede upload-adresser
//   2) browseren PUT'er hver fil direkte til Storage (bucket web-henvendelser, privat) — ingen nøgle, ingen omvej
//   3) beskeden sendes med upload_id + fil-stierne; mailen får links, og henvendelsen gemmes i Supabase.
// Grænserne (10 filer, 50 MB, filtyper) er de samme som i funktionen — tjekkes her for hurtig besked til brugeren.
const FUNCTION_URL = 'https://guhbrpektblabndqttgp.supabase.co/functions/v1/contact-form';
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

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', message: '', website: '' });
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
    if (emne) setForm((f) => (f.message ? f : { ...f, message: `Vedr. ${emne}\n\n` }));
  }, []);

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    const errs: string[] = [];
    for (const f of Array.from(list)) {
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      if (!EXT.includes(extOf(f.name))) { errs.push(`${f.name}: den filtype kan ikke sendes her`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { errs.push(`${f.name}: over ${MAX_MB} MB`); continue; }
      if (f.size === 0) { errs.push(`${f.name}: filen er tom`); continue; }
      if (next.length >= MAX_FILES) { errs.push(`Højst ${MAX_FILES} filer ad gangen`); break; }
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
    const headers = { 'Content-Type': 'application/json' };
    try {
      // Trin 1 + 2: filerne lægges i Storage, før beskeden sendes
      let upload_id: string | undefined;
      const sent: { name: string; size: number; path: string }[] = [];
      if (files.length) {
        const r = await fetch(FUNCTION_URL, {
          method: 'POST', headers,
          body: JSON.stringify({ action: 'upload-urls', website: form.website, files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) }),
        });
        const d = await r.json().catch(() => ({}));
        const urls: UploadUrl[] = Array.isArray(d?.files) ? d.files : [];
        if (!r.ok || !d?.success || urls.length !== files.length) throw new Error(d?.error || 'Kunne ikke gøre klar til upload.');
        upload_id = d.upload_id;
        for (let i = 0; i < files.length; i++) {
          setProgress({ i, pct: 0 });
          try {
            await putFile(urls[i].url, files[i], (pct) => setProgress({ i, pct }));
          } catch {
            throw new Error(`${files[i].name} kunne ikke sendes. Prøv igen — eller send filerne i en mail til tilbud@neminventar.dk.`);
          }
          sent.push({ name: files[i].name, size: files[i].size, path: urls[i].path });
        }
        setProgress(null);
      }
      // Trin 3: beskeden
      const res = await fetch(FUNCTION_URL, {
        method: 'POST', headers,
        body: JSON.stringify({ ...form, company: privat ? 'Privatkunde' : form.company, side: location.pathname, upload_id, files: sent }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSentFiles(Number(data.files ?? sent.length));
        setStatus('ok');
      } else {
        throw new Error(data?.error || 'Kunne ikke sende beskeden.');
      }
    } catch (err) {
      setProgress(null);
      setStatus('error');
      const msg = err instanceof Error ? err.message : '';
      setErrMsg(msg && !/^upload /.test(msg) ? msg : 'Der opstod en fejl ved afsendelse. Prøv igen, eller ring til os på +45 42 42 26 84.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="form">
        <div className="form-done">
          <h3>Tak — beskeden{sentFiles ? ` og ${sentFiles} ${sentFiles === 1 ? 'fil' : 'filer'}` : ''} er sendt.</h3>
          <p>Vi vender tilbage hurtigst muligt. Haster det, så ring på +45 42 42 26 84.</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';
  const sendLabel = sending
    ? (progress ? `Sender fil ${progress.i + 1} af ${files.length} · ${progress.pct} %` : 'Sender…')
    : files.length ? `Send besked og ${files.length} ${files.length === 1 ? 'fil' : 'filer'}` : 'Send besked';

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
            ? 'Fx en reol på mål til stuen eller skabe til entréen — gerne med mål. Et foto af rummet kan vedhæftes herunder.'
            : 'Beskriv kort jeres projekt og behov. Tegninger, beskrivelse eller tilbudsliste kan vedhæftes herunder.'} />
      </div>
      <div className="field">
        <label htmlFor="cf-files">{privat ? 'Fotos, skitser eller tegninger (valgfrit)' : 'Tegninger, beskrivelse eller tilbudsliste (valgfrit)'}</label>
        <div className={`dropzone${drag ? ' drag' : ''}${sending ? ' off' : ''}`} role="button" tabIndex={sending ? -1 : 0}
          aria-label="Vælg filer, eller træk dem hertil"
          onClick={() => !sending && fileRef.current?.click()}
          onKeyDown={(e) => { if (!sending && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!sending) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!sending && e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}>
          <input ref={fileRef} id="cf-files" type="file" multiple accept={ACCEPT} hidden disabled={sending}
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
          <span className="dz-ico" aria-hidden="true">↑</span>
          <span><b>Træk filer hertil</b> eller klik for at vælge</span>
          <small>PDF, DWG, DXF, IFC, billeder, Excel, Word, ZIP · højst {MAX_FILES} filer à {MAX_MB} MB</small>
        </div>
        {files.length > 0 && (
          <ul className="filelist" aria-label="Valgte filer">
            {files.map((f, i) => (
              <li key={f.name + f.size}>
                <span className="fn" title={f.name}>{f.name}</span>
                <span className="fs">{fmt(f.size)}</span>
                {progress && progress.i === i ? <span className="fp">{progress.pct} %</span>
                  : progress && progress.i > i ? <span className="fp ok">✓</span>
                  : <button type="button" aria-label={`Fjern ${f.name}`} onClick={() => removeFile(i)} disabled={sending}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sendLabel} <span className="arr">→</span>
      </button>
      {status === 'error' && <p className="form-msg err">{errMsg}</p>}
      <p className="callback-note">
        Oplysninger og filer gemmes hos vores databehandler og bruges kun til at svare dig — se vores <a href={`${import.meta.env.BASE_URL}privatlivspolitik`}>privatlivspolitik</a>.
        {privat && <> Som privat handler du efter vores <a href={`${import.meta.env.BASE_URL}handelsbetingelser`}>handelsbetingelser for private</a>.</>}
      </p>
    </form>
  );
}
