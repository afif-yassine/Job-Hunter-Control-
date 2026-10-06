import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as base from './rag-fixtures.mjs';
import * as harder from './rag-hard-fixtures.mjs';
const phase=process.argv.includes('--hard')?'v2':'v1';
const {corpus,allQueries,evaluate}=phase==='v2'?harder:base;
const root='test-results/ai-comparison';
const ledgerPath=`${root}/results.json`;
const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
const catalog=JSON.parse(await readFile(`${root}/embedding-catalog.json`,'utf8'));
// All 28 embedding models in the captured Gateway catalogue, including controls.
const models=process.env.TEST_MODELS?catalog.filter(m=>process.env.TEST_MODELS.split(',').includes(m.id)):catalog;
const inputs={document:corpus.map(d=>d.text),query:allQueries.map(q=>q.text)};
const reserve=(m,kind)=>(inputs[kind].reduce((s,t)=>s+Buffer.byteLength(t),0)+1024)*Number(m.pricing.input)*2;
console.log(JSON.stringify({models:models.length,documents:corpus.length,queries:allQueries.length,previousReservedUsd:ledger.reservedUsd,plannedReservedUsd:models.reduce((s,m)=>s+reserve(m,'document')+reserve(m,'query'),0)}));
if(!process.argv.includes('--run'))process.exit(0);
if(!process.env.AI_GATEWAY_API_KEY)throw new Error('Missing private test key');
const fresh=await fetch('https://ai-gateway.vercel.sh/v1/models').then(r=>r.json());
const save=()=>writeFile(ledgerPath,JSON.stringify(ledger,null,2));
await mkdir(`${root}/embedding-vectors`,{recursive:true});
for(const m of models){
 const price=fresh.data?.find(x=>x.id===m.id)?.pricing?.input;
 if(price===undefined||Number(price)>Number(m.pricing.input))throw new Error(`Price changed: ${m.id}`);
 let failed=false;
 for(const kind of ['document','query']){
  const caseId=`embedding-${phase}-${kind}`;
  const existing=ledger.results.find(r=>r.model===m.id&&r.case===caseId);
  if(existing){if(existing.status!=='completed')failed=true;continue;}
  if(failed)break;
  const reservationUsd=reserve(m,kind);
  if(ledger.reservedUsd+reservationUsd>1)throw new Error('Cumulative $1 ceiling');
  // Explicit 768 where supported. Other models use their native dimensions.
  const dimension768=/^(openai\/text-embedding-3-|alibaba\/qwen3-|google\/)/.test(m.id);
  const providerOptions={};
  if(m.id.startsWith('google/'))providerOptions.google={taskType:kind==='query'?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT'};
  if(m.id.startsWith('cohere/'))providerOptions.cohere={inputType:kind==='query'?'search_query':'search_document'};
  if(m.id.startsWith('voyage/'))providerOptions.voyage={inputType:kind};
  const input=m.id.startsWith('alibaba/')&&kind==='query'?inputs[kind].map(t=>`Instruct: Retrieve relevant job offers or verified candidate evidence for the query.\nQuery:${t}`):inputs[kind];
  const settings={model:m.id,input,encoding_format:'float',providerOptions,...(dimension768?{dimensions:768}:{})};
  const r={model:m.id,case:caseId,task:'embedding-benchmark',status:'pending',reservationUsd,settings};
  ledger.reservedUsd+=reservationUsd;ledger.results.push(r);await save();
  const start=Date.now();
  try{
   const res=await fetch('https://ai-gateway.vercel.sh/v1/embeddings',{method:'POST',signal:AbortSignal.timeout(60000),headers:{authorization:`Bearer ${process.env.AI_GATEWAY_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(settings)});
   const body=await res.json();
   r.elapsedMs=Date.now()-start;
   if(!res.ok){r.status='http-error';r.httpStatus=res.status;r.errorSummary=String(body.error?.message??'').replaceAll(process.env.AI_GATEWAY_API_KEY,'[redacted]').slice(0,300);failed=true;await save();console.log(`${m.id} ${kind}: HTTP ${res.status}`);if([401,402,403,429].includes(res.status))throw new Error('Auth, credit or rate limit: stop');continue;}
   const vectors=body.data?.slice().sort((a,b)=>a.index-b.index).map(d=>d.embedding);
   if(!vectors||vectors.length!==input.length||vectors.some(v=>!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='number'||!Number.isFinite(x))||!v.some(x=>x!==0)||v.length!==vectors[0].length))throw new Error('Invalid or merged batch');
   if(dimension768&&vectors[0].length!==768)throw new Error('Requested dimension not respected');
   r.status='completed';r.dimension=vectors[0].length;r.usage=body.usage??{};
   const cost=body.providerMetadata?.gateway?.cost??body.usage?.cost;
   if(cost!==undefined&&Number.isFinite(Number(cost)))r.usage.cost=Number(cost);
   r.providerMetadata=body.providerMetadata;
   r.vectorFile=`${root}/embedding-vectors/${m.id.replaceAll('/','_')}-${phase}-${kind}.json`;
   await writeFile(r.vectorFile,JSON.stringify(vectors));await save();console.log(`${m.id} ${kind}: ${vectors.length} vectors, ${r.dimension} dimensions`);
  }catch(error){if(r.status==='http-error')throw error;r.status='request-error';r.errorType=error.name;r.errorSummary=String(error.message).slice(0,150);failed=true;await save();console.log(`${m.id} ${kind}: ${error.name}; no retry`);}
 }
 const records=['document','query'].map(kind=>ledger.results.find(r=>r.model===m.id&&r.case===`embedding-${phase}-${kind}`));
 if(records.every(r=>r?.status==='completed')){
  const [document,query]=await Promise.all(records.map(r=>readFile(r.vectorFile,'utf8').then(JSON.parse)));
  const metrics=evaluate({document,query});
  await writeFile(`${root}/embedding-vectors/${m.id.replaceAll('/','_')}-${phase}-metrics.json`,JSON.stringify(metrics,null,2));
  console.log(`${m.id}: recall offers=${metrics.offerRecall3.toFixed(3)} evidence=${metrics.evidenceRecall2.toFixed(3)}`);
 }
}
