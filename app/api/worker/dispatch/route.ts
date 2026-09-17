import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const payload=z.object({applicationId:z.string().uuid(),action:z.enum(["inspect","prepare"])});
export async function POST(req:Request){
 const supabase=await createClient();
 if(!supabase)return Response.json({error:"Supabase is not configured"},{status:503});
 const {data}=await supabase.auth.getClaims();
 if(!data?.claims?.sub)return Response.json({error:"Unauthorized"},{status:401});
 if(process.env.APPLICATION_MODE!=="PREPARE_ONLY")return Response.json({error:"Unsafe mode rejected"},{status:403});
 if(!process.env.WORKER_BASE_URL||!process.env.WORKER_SHARED_SECRET)return Response.json({error:"Worker not configured"},{status:503});
 const parsed=payload.safeParse(await req.json());if(!parsed.success)return Response.json({error:"Invalid payload"},{status:400});
 const response=await fetch(`${process.env.WORKER_BASE_URL}/jobs`,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${process.env.WORKER_SHARED_SECRET}`},body:JSON.stringify({...parsed.data,mode:"PREPARE_ONLY"})});
 return new Response(await response.text(),{status:response.status,headers:{"content-type":"application/json"}});
}
