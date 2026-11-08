// Designer-link (standardudgaven, uden kulør) for hver type, designeren kan åbne. Bruges af scripts/produkt_priser.py.
import { DESIGNER_AF, designerLink } from '../src/lib/forside.ts';

const ud = {};
for (const slug of Object.keys(DESIGNER_AF)) ud[slug] = { produkt: DESIGNER_AF[slug], link: designerLink(slug) };
console.log(JSON.stringify(ud));
