import {readFile,writeFile} from 'node:fs/promises';
import {parseJson} from '../lib/generated.ts';
const root='test-results/ai-comparison';const path=`${root}/results.json`;
const ledger=JSON.parse(await readFile(path,'utf8'));
// Backfill costs returned in snake_case by the Cohere-compatible endpoint.
for(const r of ledger.results){const cost=r.output?.provider_metadata?.gateway?.cost;if(cost!==undefined){r.usage??={};r.usage.cost=Number(cost);}}
await writeFile(path,JSON.stringify(ledger,null,2));
const rows=ledger.results.filter(r=>['rerank-benchmark','grounded-rag','cv-text-extraction'].includes(r.task));
for(const r of rows.filter(r=>r.task==='cv-text-extraction'&&r.status==='completed')){
 const parsed=parseJson(r.output);if(!parsed?.education)continue;
 r.reviewedChecks={...r.checks};delete r.reviewedChecks.levelAbsent;
 r.reviewedChecks.levelFaithful=parsed.education.every(e=>e.level===null||r.prompt.toLowerCase().includes(e.level?.toLowerCase()));
 r.reviewedChecks.educationStatus=r.case.endsWith('minimal')||parsed.education.every(e=>/en cours/i.test(e.degree??''));
 r.reviewedPass=Object.values(r.reviewedChecks).every(Boolean);
}
const tasks=['embedding-benchmark','rerank-benchmark','grounded-rag','cv-text-extraction'];
const taskSummary=tasks.map(task=>{const a=ledger.results.filter(r=>r.task===task);return{task,requests:a.length,completed:a.filter(r=>r.status==='completed').length,reportedCostUsd:a.reduce((s,r)=>s+(r.usage?.cost??0),0)};});
const models=[...new Set(rows.map(r=>r.model))].map(model=>({model,tasks:['rerank-benchmark','grounded-rag','cv-text-extraction'].map(task=>{const a=rows.filter(r=>r.model===model&&r.task===task&&(task!=='cv-text-extraction'||r.case.includes('-v2-')));return{task,requests:a.length,completed:a.filter(r=>r.status==='completed').length,pass:a.filter(r=>task==='rerank-benchmark'?r.top1:task==='cv-text-extraction'?r.reviewedPass:r.automaticPass).length,reportedCostUsd:a.reduce((s,r)=>s+(r.usage?.cost??0),0)};})}));
const result={requests:ledger.results.length,completed:ledger.results.filter(r=>r.status==='completed').length,totalReportedCostUsd:ledger.results.reduce((s,r)=>s+(r.usage?.cost??0),0),reservedUsd:ledger.reservedUsd,taskSummary,models,rows};
await writeFile(`${root}/rag-audit.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:undefined},null,2));
