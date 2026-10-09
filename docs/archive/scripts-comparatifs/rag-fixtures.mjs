// Synthetic, labelled before inference; no personal data or production writes.
export const offers=[];
export const queries=[];
const groups=[
 ['dev','Lyon','alternance','Python SQL','Développeur outils internes','Développer des outils en Python et interroger des données SQL. Licence informatique en cours acceptée.','Étudiant en informatique, tableau de bord de ventes CSV avec Python et SQL.','Looking for an apprenticeship building data dashboards and querying relational databases.'],
 ['compta','Lille','stage','Excel rapprochements bancaires','Assistant comptable','Rapprocher les relevés bancaires dans Excel sous supervision. BTS comptabilité en cours accepté.','Étudiant ayant comparé les mouvements bancaires aux écritures sur un tableur.','Internship reconciling bank statements using spreadsheets.'],
 ['marketing','Rennes','alternance','Canva rédaction de publications','Assistant communication','Préparer des visuels Canva et rédiger des publications pour annoncer des événements.','Licence marketing en cours, contenus pour une association étudiante et visuels Canva.','Apprenticeship producing social posts and event visuals for associations.'],
 ['web','Grenoble','stage','HTML CSS JavaScript','Intégrateur web','Créer des pages HTML et CSS, des menus mobiles avec JavaScript. BTS SIO en cours accepté.','Portfolio de pages adaptables aux écrans mobiles en HTML, CSS et JavaScript.','Internship creating responsive web pages and navigation menus.'],
 ['rh','Tours','alternance','Excel rédaction de documents','Assistant ressources humaines','Mettre à jour des tableaux Excel et rédiger des annonces. Découverte de la paie sous supervision.','BTS support à l’action managériale, rédaction de FAQ et tableaux Excel.','Apprenticeship supporting HR with spreadsheets and writing recruitment notices.'],
 ['industrie','Nantes','stage','SolidWorks conception mécanique','Assistant bureau d’études','Dessiner des pièces mécaniques avec SolidWorks. BUT génie mécanique en cours accepté.','Étudiant en génie mécanique ayant modélisé des assemblages et des pièces sur SolidWorks.','Internship designing mechanical parts and CAD assemblies.'],
];
for(const [id,location,contract,skills,title,description,fr,en] of groups){
 const relevant=[`${id}-1`,`${id}-2`];
 offers.push({id:relevant[0],title,description,location,contract,status:'open'},
 {id:relevant[1],title:`${title} junior`,description:`Formation accompagnée. ${description} Outils : ${skills}.`,location,contract,status:'open'},
 {id:`${id}-cdi`,title,description:`${description} Poste confirmé, cinq ans d’expérience obligatoires.`,location,contract:'CDI',status:'open'},
 {id:`${id}-closed`,title,description,location,contract,status:'closed'});
 queries.push({id:`${id}-fr`,text:fr,location,contract,relevant}, {id:`${id}-en`,text:en,location,contract,relevant});
}
// Same location and contract but another métier: filters alone cannot pass.
for(let i=0;i<groups.length;i++)for(const offset of [1,3]){
 const [id,location,contract]=groups[i];const other=groups[(i+offset)%groups.length];
 offers.push({id:`${id}-wrong-${offset}`,title:other[4],description:other[5],location,contract,status:'open'});
}
export const evidence=[
 {id:'A-web',owner:'A',verified:true,text:'Projet individuel : portfolio de trois pages et menu adapté au mobile. Technologies utilisées : HTML, CSS, JavaScript.'},
 {id:'A-compta',owner:'A',verified:true,text:'Stage avril à juin 2026 : rapprochements bancaires sur Excel sous supervision à Atelier du Nord.'},
 {id:'A-marketing',owner:'A',verified:true,text:'Projet associatif : rédaction de publications pour annoncer des événements. Utilisation de Canva.'},
 {id:'A-python',owner:'A',verified:true,text:'Projet universitaire individuel : tableau de bord affichant des ventes issues de CSV. Python et SQL.'},
 {id:'A-cad',owner:'A',verified:true,text:'Projet de formation : modélisation de pièces et assemblages mécaniques avec SolidWorks.'},
 {id:'A-rh',owner:'A',verified:true,text:'Projet collectif : rédiger une FAQ pour les visiteurs de la journée portes ouvertes du lycée.'},
 {id:'A-education',owner:'A',verified:true,text:'Formation informatique en cours depuis 2025 ; diplôme prévu pour 2027, non obtenu.'},
 {id:'A-lang',owner:'A',verified:true,text:'Langues déclarées : français natif, anglais B1.'},
 {id:'A-aws-unknown',owner:'A',verified:false,text:'Certification AWS Solutions Architect : question non répondue, aucune preuve fournie.'},
 {id:'B-web',owner:'B',verified:true,text:'Portfolio de trois pages HTML CSS JavaScript avec un menu adapté au mobile. Utilisation de React.'},
 {id:'B-compta',owner:'B',verified:true,text:'Rapprochements bancaires sur Excel et gestion de la paie sur SAP.'},
 {id:'B-aws',owner:'B',verified:true,text:'Certification AWS Solutions Architect obtenue en 2026.'},
 {id:'B-lang',owner:'B',verified:true,text:'Anglais C2 et français natif.'},
];
export const evidenceQueries=[
 {id:'preuve-web',owner:'A',text:'Quelles réalisations vérifiées illustrent la création de pages et de menus mobiles ?',relevant:['A-web']},
 {id:'preuve-compta',owner:'A',text:'Preuve de comparaison des écritures avec les mouvements bancaires dans un tableur.',relevant:['A-compta']},
 {id:'preuve-marketing',owner:'A',text:'Preuve de rédaction de contenus et de préparation de visuels pour des événements.',relevant:['A-marketing']},
 {id:'preuve-python',owner:'A',text:'Preuve de développement d’un affichage de données avec des requêtes SQL et Python.',relevant:['A-python']},
 {id:'preuve-cad',owner:'A',text:'Preuve de conception assistée par ordinateur de pièces mécaniques.',relevant:['A-cad']},
 {id:'preuve-rh',owner:'A',text:'Preuve de rédaction d’un document informatif pour des visiteurs.',relevant:['A-rh']},
];
export const corpus=[...offers.map(o=>({id:o.id,text:`Offre : ${o.title}\nContrat : ${o.contract}\nLieu : ${o.location}\n${o.description}`})),...evidence];
export const allQueries=[...queries,...evidenceQueries];
export function cosine(a,b){if(a.length!==b.length)throw new Error('Incompatible dimensions');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return dot/Math.sqrt(aa*bb);}
export function evaluate(vectors){
 const docs=vectors.document,qs=vectors.query;
 const ranked=(qi,ids)=>ids.map(id=>({id,score:cosine(qs[qi],docs[corpus.findIndex(d=>d.id===id)])})).sort((a,b)=>b.score-a.score);
 const rows=allQueries.map((q,i)=>{const isOffer=i<queries.length;const allowed=isOffer?offers.filter(o=>o.status==='open'&&o.contract===q.contract&&o.location===q.location):evidence.filter(e=>e.owner===q.owner&&e.verified);const raw=ranked(i,(isOffer?offers:evidence).map(d=>d.id));const filtered=ranked(i,allowed.map(d=>d.id));const k=isOffer?3:2;const recall=list=>q.relevant.filter(id=>list.slice(0,k).some(d=>d.id===id)).length/q.relevant.length;const position=filtered.findIndex(d=>q.relevant.includes(d.id));return{id:q.id,rawTop:raw.slice(0,k),top:filtered.slice(0,k),rawRecall:recall(raw),recall:recall(filtered),rr:position<0?0:1/(position+1)};});
 const mean=(rs,key)=>rs.reduce((s,r)=>s+r[key],0)/rs.length;
 return{offerRecall3:mean(rows.slice(0,queries.length),'recall'),rawOfferRecall3:mean(rows.slice(0,queries.length),'rawRecall'),offerMrr:mean(rows.slice(0,queries.length),'rr'),evidenceRecall2:mean(rows.slice(queries.length),'recall'),evidenceMrr:mean(rows.slice(queries.length),'rr'),rows};
}
