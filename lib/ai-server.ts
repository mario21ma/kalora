import {z} from 'zod';
import {stateSchema} from './domain';
import type {State} from './domain';

type AuthContext={
 authenticated:boolean;
 url?:string;
 headers?:Record<string,string>;
};

export {anonymousAiEnabled} from './ai-rate-limit';
import {consumeAiQuota,AiHttpError} from './ai-rate-limit';

export const configuredAiModel=()=>process.env.OPENAI_MODEL||'gpt-6-luna';

export async function authorize(req:Request):Promise<AuthContext>{
 if(!process.env.OPENAI_API_KEY)throw new Error('AI procjena još nije povezana. Postavi OPENAI_API_KEY na poslužitelju.');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,authorization=req.headers.get('authorization');
 if(!authorization){
  await consumeAiQuota(req);
  return {authenticated:false};
 }
 if(!authorization.startsWith('Bearer '))throw new AiHttpError('Sesija je istekla. Prijavi se ponovno.',401);
 if(!url||!key)throw new AiHttpError('Prijava za AI trenutačno nije dostupna.',503);
 const headers={apikey:key,Authorization:authorization,'Content-Type':'application/json'};
 let r:Response;
 try{r=await fetch(url+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(8000)})}catch{throw new AiHttpError('Provjera prijave trenutačno nije dostupna.',503)}
 if(!r.ok)throw new AiHttpError(r.status===401||r.status===403?'Sesija je istekla. Prijavi se ponovno.':'Provjera prijave trenutačno nije dostupna.',r.status===401||r.status===403?401:503);
 const user=await r.json().catch(()=>null);
 if(typeof user?.id!=='string'||! /^[0-9a-f-]{36}$/i.test(user.id))throw new AiHttpError('Provjera prijave trenutačno nije dostupna.',503);
 await consumeAiQuota(req,user.id);
 return {authenticated:true,url,headers};
}

export async function userState(auth:AuthContext):Promise<State>{
 if(!auth.authenticated||!auth.url||!auth.headers)throw new Error('Za ovaj zahtjev nema spremljenog cloud dnevnika.');
 const r=await fetch(auth.url+'/rest/v1/rpc/load_diary',{method:'POST',headers:auth.headers,body:'{}',cache:'no-store'});
 if(!r.ok)throw new Error('Dnevnik nije dostupan.');
 const d=await r.json();
 if(!d?.state)throw new Error('Najprije spremi svoj dnevnik.');
 return stateSchema.parse(d.state);
}

export async function structured<T>(schema:z.ZodType<T>,jsonSchema:object,instructions:string,input:unknown,options?:{webSearch?:boolean}):Promise<T>{
 const model=configuredAiModel();
 const requestBody:Record<string,unknown>={
  model,
  store:false,
  instructions,
  input:JSON.stringify(input),
  max_output_tokens:3000,
  text:{format:{type:'json_schema',name:'food_result',strict:true,schema:jsonSchema}}
 };
 if(options?.webSearch){requestBody.tools=[{type:'web_search',search_context_size:'low'}];requestBody.max_tool_calls=1;}
 if(/^(gpt-[56]|o\d)/.test(model))requestBody.reasoning={effort:process.env.OPENAI_REASONING_EFFORT||'low'};
 const r=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify(requestBody),
  signal:AbortSignal.timeout(45000)
 });
 if(!r.ok){
  throw new Error('AI trenutno nije dostupan. Pokušaj ponovno.');
 }
 const d=await r.json();
 if(d.status==='incomplete')throw new Error('AI odgovor nije dovršen. Skrati unos i pokušaj ponovno.');
 const output=d.output?.flatMap((o:{content?:{type:string,text?:string}[]})=>o.content||[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');
 return schema.parse(JSON.parse(output||'{}'));
}

export async function safeBody(req:Request){const raw=await req.text();if(raw.length>50000)throw new Error('Unos je predug.');return JSON.parse(raw)}
export const errorResponse=(e:unknown)=>Response.json({error:e instanceof z.ZodError?'Podaci nisu valjani. Provjeri unos.':e instanceof Error?e.message:'Zahtjev nije uspio.'},{status:e instanceof AiHttpError?e.status:400,headers:{'Cache-Control':'no-store',...(e instanceof AiHttpError&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});
