import {readFile,writeFile} from 'node:fs/promises';
import {allQueries,corpus} from './rag-hard-fixtures.mjs';
const root='test-results/ai-comparison';const path=`${root}/results.json`;
const ledger=JSON.parse(await readFile(path,'utf8'));
const catalog=await fetch('https://ai-gateway.vercel.sh/v1/models').then(r=>r.json());
const models=catalog.data.filter(m=>m.type==='reranking'&&m.pricing?.input!==undefined&&Number(m.pricing.input)<=.00000005);
await writeFile(`${root}/rerank-catalog.json`,JSON.stringify(catalog.data.filter(m=>m.type==='reranking'),null,2));
const metrics=JSON.parse(await readFile(`${root}/embedding-vectors/alibaba_qwen3-embedding-0.6b-v2-metrics.json`,'utf8'));
const offerRows=metrics.rows.filter(r=>!r.id.startsWith('preuve-'));
const misses=offerRows.filter(r=>!allQueries.find(q=>q.id===r.id).relevant.includes(r.top[0].id));
const selected=[...misses,...offerRows.filter(r=>!misses.includes(r))].slice(0,8);
console.log(JSON.stringify({models:models.map(m=>m.id),queries:selected.length,unpricedSkipped:catalog.data.filter(m=>m.type==='reranking'&&m.pricing?.input===undefined).map(m=>m.id)}));
if(!process.argv.includes('--run'))process.exit(0);
if(!process.env.AI_GATEWAY_API_KEY)throw new Error('Missing private test key');
const save=()=>writeFile(path,JSON.stringify(ledger,null,2));
for(const m of models)for(const c of selected){
 const q=allQueries.find(q=>q.id===c.id);const docs=c.top.map(d=>corpus.find(x=>x.id===d.id));
 const caseId=`rerank-v1-${q.id}`;if(ledger.results.some(r=>r.model===m.id&&r.case===caseId))continue;
 const settings={model:m.id,query:q.text,documents:docs.map(d=>d.text),top_n:docs.length};
 const reservationUsd=(Buffer.byteLength(JSON.stringify(settings))+1024)*Number(m.pricing.input)*2;
 if(ledger.reservedUsd+reservationUsd>1)throw new Error('Cumulative ceiling');
 ledger.reservedUsd+=reservationUsd;const r={model:m.id,case:caseId,task:'rerank-benchmark',status:'pending',reservationUsd,settings,documentIds:docs.map(d=>d.id),baselineTop1:q.relevant.includes(c.top[0].id)};ledger.results.push(r);await save();
 const start=Date.now();
 try{
  const res=await fetch('https://ai-gateway.vercel.sh/v2/rerank',{method:'POST',signal:AbortSignal.timeout(60000),headers:{authorization:`Bearer ${process.env.AI_GATEWAY_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(settings)});
  const body=await res.json();r.elapsedMs=Date.now()-start;
  if(!res.ok){r.status='http-error';r.httpStatus=res.status;r.errorSummary=String(body.message??body.error?.message??'').slice(0,200);await save();console.log(`${m.id}: HTTP ${res.status}`);if([401,402,403,429].includes(res.status))throw new Error('Stop: access, credit or rate limit');break;}
  if(!Array.isArray(body.results)||!body.results.length||body.results.some(x=>!Number.isInteger(x.index)||x.index<0||x.index>=docs.length))throw new Error('Invalid ranks');
  r.status='completed';r.output=body;r.top1=q.relevant.includes(docs[body.results[0].index].id);
  const cost=body.providerMetadata?.gateway?.cost??body.provider_metadata?.gateway?.cost??body.usage?.cost;r.usage=body.usage??{};if(cost!==undefined)r.usage.cost=Number(cost);
  await save();console.log(`${m.id} ${q.id}: top1=${r.top1}`);
 }catch(e){if(r.status==='http-error')throw e;r.status='request-error';r.errorType=e.name;await save();console.log(`${m.id}: ${e.name}; no retry`);break;}
}
