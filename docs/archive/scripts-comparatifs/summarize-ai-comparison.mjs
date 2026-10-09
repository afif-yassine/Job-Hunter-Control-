import { readFile, writeFile } from 'node:fs/promises';
const ledger = JSON.parse(await readFile('test-results/ai-comparison/results.json', 'utf8'));
const normalize = text => String(text).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const allowed = [['python','sql'],['excel'],['seo','canva']];
for (const r of ledger.results) {
  let parsed;
  try { parsed = JSON.parse((r.output ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { /* A format failure remains visible. */ }
  r.parseableAfterFences = Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  if (r.task === 'extraction' && parsed) {
    r.schemaValid = Array.isArray(parsed.missions) && Array.isArray(parsed.skills) && (typeof parsed.level === 'string' || parsed.level === null) && [null,'non','partiel','total'].includes(parsed.remote) && typeof parsed.conditions === 'string';
    r.factsCorrectAfterFences = r.schemaValid && r.expected.skills.every(s => parsed.skills.some(t => normalize(t) === normalize(s))) && parsed.level === r.expected.level && parsed.remote === r.expected.remote;
  } else if (r.task === 'writing' && parsed) {
    const nonempty = value => typeof value === 'string' && value.trim().length > 0;
    r.schemaValid = nonempty(parsed.cv?.title) && nonempty(parsed.cv?.summary) && Array.isArray(parsed.cv?.skills) && Array.isArray(parsed.cv?.experience) && nonempty(parsed.cover_letter) && Array.isArray(parsed.unresolved_questions);
    r.letterWords = typeof parsed.cover_letter === 'string' ? parsed.cover_letter.replace(/\\n/g,' ').trim().split(/\s+/).length : null;
    const profile = Number(r.case.split('-')[1]) - 1;
    r.unlistedCvSkills = Array.isArray(parsed.cv?.skills) ? parsed.cv.skills.filter(s => !allowed[profile].includes(normalize(s))) : [];
  }
}
const summary = [...new Set(ledger.results.map(r=>r.model))].map(model => {
  const all = ledger.results.filter(r=>r.model===model);
  return {model, phases:['baseline','structured','clean'].map(phase=>{
    const rows = all.filter(r=>phase==='clean' ? r.case.endsWith('-clean') : phase==='structured' ? r.case.endsWith('-structured') : !r.case.endsWith('-structured') && !r.case.endsWith('-clean'));
    const done = rows.filter(r=>r.status==='completed');
    const latency = done.map(r=>r.elapsedMs).sort((a,b)=>a-b);
    return {phase,attempts:rows.length,completed:done.length,strictJson:done.filter(r=>r.jsonValid).length,schemaValid:done.filter(r=>r.schemaValid).length,extractionsCorrect:done.filter(r=>r.task==='extraction'&&r.factsCorrectAfterFences).length,writingWithinLength:done.filter(r=>r.task==='writing'&&r.letterWords>=170&&r.letterWords<=240).length,medianSeconds:latency.length ? latency[Math.floor(latency.length/2)]/1000:null,reportedCostUsd:done.reduce((s,r)=>s+(r.usage?.cost??0),0)};
  })};
});
await writeFile('test-results/ai-comparison/audit.json',JSON.stringify({reservedUsd:ledger.reservedUsd,totalReportedCostUsd:ledger.results.reduce((s,r)=>s+(r.usage?.cost??0),0),summary,results:ledger.results},null,2));
console.log(JSON.stringify(summary,null,2));
