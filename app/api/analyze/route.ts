import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
const input=z.object({jobDescription:z.string().min(50).max(30000),verifiedProfile:z.string().min(20).max(30000)});
export async function POST(req:Request){
 if(!process.env.GEMINI_API_KEY)return Response.json({error:"GEMINI_API_KEY is not configured"},{status:503});
 const parsed=input.safeParse(await req.json());if(!parsed.success)return Response.json({error:"Invalid input"},{status:400});
 const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
 const prompt=`You are a strict job matching assistant. Use only facts explicitly present in VERIFIED PROFILE. Never invent experience, dates, tools, authorization or salary. Return JSON with score_breakdown (contract/20, mission/20, technical/25, education/15, experience/10, location/10), total, verified_strengths, gaps, questions, and cv_summary.\nVERIFIED PROFILE:\n${parsed.data.verifiedProfile}\nJOB:\n${parsed.data.jobDescription}`;
 const result=await ai.models.generateContent({model:"gemini-2.5-flash",contents:prompt,config:{responseMimeType:"application/json"}});
 return Response.json(JSON.parse(result.text||"{}"));
}
