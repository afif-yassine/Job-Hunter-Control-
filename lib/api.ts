import { createClient } from "@/lib/supabase/server";

export async function authenticatedClient(){
  const supabase=await createClient();
  if(!supabase)return {error:Response.json({error:"Supabase is not configured"},{status:503})};
  const {data}=await supabase.auth.getClaims();
  const userId=String(data?.claims?.sub||"");
  if(!userId)return {error:Response.json({error:"Unauthorized"},{status:401})};
  return {supabase,userId};
}

export function safeFilename(value:string){return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,80)}
