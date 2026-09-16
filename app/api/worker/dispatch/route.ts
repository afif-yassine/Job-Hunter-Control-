import { z } from "zod";
const payload=z.object({applicationId:z.string().uuid(),action:z.enum(["inspect","prepare"])});
export async function POST(req:Request){
 if(process.env.APPLICATION_MODE!=="PREPARE_ONLY")return Response.json({error:"Unsafe mode rejected"},{status:403});
 if(!process.env.WORKER_BASE_URL||!process.env.WORKER_SHARED_SECRET)return Response.json({error:"Worker not configured"},{status:503});
 const parsed=payload.safeParse(await req.json());if(!parsed.success)return Response.json({error:"Invalid payload"},{status:400});
 const response=await fetch(`${process.env.WORKER_BASE_URL}/jobs`,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${process.env.WORKER_SHARED_SECRET}`},body:JSON.stringify({...parsed.data,mode:"PREPARE_ONLY"})});
 return new Response(await response.text(),{status:response.status,headers:{"content-type":"application/json"}});
}
