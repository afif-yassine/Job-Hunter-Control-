import {readFile,writeFile} from 'node:fs/promises';
import {generated,parseJson,normaliseGenerated} from '../../../lib/generated.ts';
const ledger=JSON.parse(await readFile('test-results/ai-comparison/results.json','utf8'));
const rows=ledger.results.filter(r=>r.task==='writing-production');
function medianSeconds(a){const sorted=a.filter(r=>r.elapsedMs).map(r=>r.elapsedMs/1000).sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length?sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2:null;}
for(const r of rows){
  if(r.status!=='completed')continue;
  const raw=parseJson(r.output); const normalized=normaliseGenerated(raw);
  r.schemaValid=generated.safeParse(raw).success;
  r.acceptedByApplication=Boolean(normalized);
  if(!normalized)continue;
  const {cv,cover_letter:letter}=normalized;
  r.words=letter?.replace(/\\n/g,' ').trim().split(/\s+/).length??0;
  r.lengthCorrect=r.words>=170&&r.words<=240;
  r.complete=Boolean(cv.title.trim()&&cv.summary.trim()&&cv.education.length&&cv.languages.trim()&&letter?.trim());
  r.letterStructure=Boolean(letter?.startsWith('Objet :')&&letter.includes('Madame, Monsieur,')&&(letter.replace(/\\n/g,'\n').match(/\n\s*\n/g)?.length??0)>=4);
  const letterText=letter??'';
  r.educationClaim=/titulaire|dipl[oô]m[eé](?:e)?\s+(?:d|en)|dipl[oô]me\s+(?:obtenu|valid[eé])/i.test(`${cv.summary} ${cv.education.join(' ')} ${letterText}`);
  const suffix=r.case.split('-').at(-1);
  r.immediateAvailability=suffix!=='marketing'&&/disponible (?:imm[eé]diatement|d[eè]s|pour (?:un stage|une alternance|une p[eé]riode))/i.test(`${cv.summary} ${letterText}`);
  const forbidden=r.expected?.forbidden??(suffix==='compta'?['Salesforce','SAP','Sage','anglais B2','anglais courant']:suffix==='marketing'?['Excel','Google Analytics','Power BI','Python','SQL']:suffix==='mismatch'?['Kubernetes','AWS','Power BI','30 %','30%']:['Pandas','Matplotlib','Git','Docker','Kubernetes','AWS']);
  const cvText=JSON.stringify(cv).toLowerCase();
  r.forbiddenCvMentions=forbidden.filter(s=>cvText.includes(s.toLowerCase()));
  r.evidenceComplete=((r.expected?.profile?.experience?.length??(suffix==='compta'?1:0))>0?cv.experience:cv.projects).some(section=>section.heading.trim()&&section.bullets.some(b=>b.trim()));
  r.preliminaryPass=r.schemaValid&&r.complete&&r.evidenceComplete&&r.lengthCorrect&&r.letterStructure&&!r.educationClaim&&!r.immediateAvailability&&!r.forbiddenCvMentions.length;
}
const summary=[...new Set(rows.map(r=>r.model))].map(model=>({model,phases:['v2','v3','v4','v5'].map(phase=>{const a=rows.filter(r=>r.model===model&&r.case.includes(`-${phase}-`));return{phase,attempts:a.length,completed:a.filter(r=>r.status==='completed').length,strictSchema:a.filter(r=>r.schemaValid).length,complete:a.filter(r=>r.complete).length,length:a.filter(r=>r.lengthCorrect).length,automaticPass:a.filter(r=>r.preliminaryPass).length,costUsd:a.reduce((s,r)=>s+(r.usage?.cost??0),0),medianSeconds:medianSeconds(a)};})}));
await writeFile('test-results/ai-comparison/writing-audit.json',JSON.stringify({totalReportedCostUsd:ledger.results.reduce((s,r)=>s+(r.usage?.cost??0),0),reservedUsd:ledger.reservedUsd,summary,rows},null,2));
console.log(JSON.stringify(summary,null,2));
