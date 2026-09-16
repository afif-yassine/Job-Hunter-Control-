import { chromium } from "playwright";
import { createServer } from "node:http";
const port=Number(process.env.PORT||3001),secret=process.env.WORKER_SHARED_SECRET;
const server=createServer(async(req,res)=>{
 res.setHeader("content-type","application/json");
 if(req.url==="/health"){res.end(JSON.stringify({ok:true,mode:"PREPARE_ONLY"}));return}
 if(req.method!=="POST"||req.url!=="/jobs"){res.statusCode=404;res.end(JSON.stringify({error:"Not found"}));return}
 if(!secret||req.headers.authorization!==`Bearer ${secret}`){res.statusCode=401;res.end(JSON.stringify({error:"Unauthorized"}));return}
 let raw="";for await(const chunk of req)raw+=chunk;const job=JSON.parse(raw);
 if(job.mode!=="PREPARE_ONLY"||!['inspect','prepare'].includes(job.action)){res.statusCode=403;res.end(JSON.stringify({error:"Unsafe job rejected"}));return}
 const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();res.end(JSON.stringify({ok:true,state:"PAUSED_FOR_HUMAN",reason:"Application submission is intentionally disabled",applicationId:job.applicationId,pageReady:Boolean(page)}))}finally{await browser.close()}
});server.listen(port,()=>console.log(`Worker listening on ${port} in PREPARE_ONLY mode`));
