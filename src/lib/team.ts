// Holdet, som det vises på /om-os og /kontakt. Billederne ligger i public/team/.
export interface Member { name: string; role: string; desc: string; email: string; phone: string; img: string; edu: string; bio: string }

export const TEAM: Member[] = [
  { name: 'Joachim Skovbogaard', role: 'Administrerende direktør', desc: 'Kontakt og koordinering med entreprenører, arkitekter m.fl.', email: 'js@neminventar.dk', phone: '+45 20 54 14 88', img: 'joachim.png',
    edu: 'Civilingeniør · kandidat i Construction Management · kandidat i datavidenskab',
    bio: 'Joachim er civilingeniør med speciale i bærende konstruktioner fra Ingeniørhøjskolen i Aarhus. Han har en kandidat i Construction Management fra Aarhus Universitet og en kandidat i datavidenskab fra Syddansk Universitet. Han har arbejdet i byggebranchen siden 2017 med lean, lokationsbaseret planlægning og byggestyring, bl.a. hos Enemærke & Petersen på store renoveringssager. Hos Nem Inventar står han for kontakten til entreprenører og arkitekter, tilbuddene og de digitale værktøjer, der binder tegning, produktion og levering sammen.' },
  { name: 'Milot Salihu', role: 'Medejer · salg og leverandører', desc: 'Salg, leverandørkoordinering og proces.', email: 'kontakt@neminventar.dk', phone: '+45 42 42 26 84', img: 'milot.png',
    edu: 'Proces og Innovation, DTU · Management & Technology, TUM',
    bio: 'Milot er uddannet i Proces og Innovation fra DTU og har læst Management & Technology ved TUM School of Management. Før Nem Inventar var han projektleder og siden partner inden for automation og robotteknologi hos Novo Nordisk, hvor han satte nye produktionslinjer og udstyr i drift. Han underviser også som gæsteforelæser på DTU. Hos Nem Inventar står han for salget, leverandørerne og koordineringen af produktionen.' },
  { name: 'Christian Foss', role: 'Produktansvarlig', desc: 'Produktdesign, innovation og kvalitet.', email: 'cf@neminventar.dk', phone: '+45 24 64 97 43', img: 'christian.png',
    edu: 'Professionsbachelor i Proces og Innovation, DTU',
    bio: 'Christian er uddannet professionsbachelor i Proces og Innovation fra DTU i 2022. Han har arbejdet som teknisk designer og produktudviklingskonsulent i industrien og som business analyst i finanssektoren. Hos Nem Inventar tegner han produkterne i 3D, laver produktionstegningerne og holder øje med, at kundens krav, kvaliteten og prisen hænger sammen.' },
];
