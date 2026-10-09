import {readFile,writeFile} from 'node:fs/promises';
import * as base from './rag-fixtures.mjs';
import * as harder from './rag-hard-fixtures.mjs';
const root='test-results/ai-comparison';
const ledger=JSON.parse(await readFile(`${root}/results.json`,'utf8'));
const catalog=JSON.parse(await readFile(`${root}/embedding-catalog.json`,'utf8'));
const rows=[];
for(const m of catalog)for(const phase of ['v1','v2']){
 const rs=['document','query'].map(kind=>ledger.results.find(r=>r.model===m.id&&r.case===`embedding-${phase}-${kind}`));
 if(!rs.every(r=>r?.status==='completed'))continue;
 const [document,query]=await Promise.all(rs.map(r=>readFile(r.vectorFile,'utf8').then(JSON.parse)));
 const fixture=phase==='v1'?base:harder;
 const metrics=fixture.evaluate({document,query});
 rows.push({model:m.id,phase,dimension:document[0].length,inputUsdPerMillion:Number(m.pricing.input)*1e6,costUsd:rs.reduce((s,r)=>s+(r.usage?.cost??0),0),totalSeconds:rs.reduce((s,r)=>s+r.elapsedMs/1000,0),...metrics});
}
const result={totalReportedCostUsd:ledger.results.reduce((s,r)=>s+(r.usage?.cost??0),0),reservedUsd:ledger.reservedUsd,embeddingRequests:ledger.results.filter(r=>r.task==='embedding-benchmark').length,rows};
await writeFile(`${root}/embedding-audit.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:rows.filter(r=>r.phase==='v2').map(({rows,...r})=>r)},null,2));
