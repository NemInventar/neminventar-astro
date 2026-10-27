// /designer-eksempler.json — eksemplerne fra designeren (src/data/designer-eksempler.json) med billedet som fuld adresse.
// Læses af designeren selv ("Se eksempler" og "Overrask mig" i ni-apps core/eksempler.js, Joachim 27-10-2026: "så vil jeg
// også gerne have at man kan se eksempler hvis man ikke ved hvad man leder efter"), så listen kun findes ét sted.
// Genereres ved build; GitHub Pages sender CORS *, som for /varianter.json.
import type { APIRoute } from 'astro';
import EKS from '../data/designer-eksempler.json';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const abs = (p: string) => new URL(base + p, site).href;
  const eksempler = EKS.map((e) => ({
    id: e.id, produkt: e.produkt, titel: e.titel, tekst: e.tekst, st: e.st,
    img: abs(`billeder/designer-eksempler/${e.id}.jpg`),
  }));
  return new Response(JSON.stringify({ genereret: new Date().toISOString(), eksempler }, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
