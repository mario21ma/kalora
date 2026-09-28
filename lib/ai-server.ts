import {z} from 'zod';
import {State,stateSchema} from './domain';

type AuthContext={
 authenticated:boolean;
 url?:string;
 headers?:Record<string,string>;
};

export const anonymousAiEnabled=()=>process.env.ALLOW_ANONYMOUS_AI!=='false';
const anonymousQuota=new Map<string,{windowStart:number,count:number}>();
function consumeAnonymousQuota(req:Request){
 const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'local';
 const now=Date.now(),hour=60*60*1000,current=anonymousQuota.get(forwarded);
 if(!current||now-current.windowStart>=hour){anonymousQuota.set(forwarded,{windowStart:now,count:1});return}
 if(current.count>=40)throw new Error('Dosegnut je privremeni limit AI zahtjeva. Pokušaj za sat vremena.');
 current.count+=1;
}

export const configuredAiModel=()=>process.env.OPENAI_MODEL||'gpt-6-luna';

export async function authorize(req:Request):Promise<AuthContext>{
 if(!process.env.OPENAI_API_KEY)throw new Error('AI procjena još nije povezana. Postavi OPENAI_API_KEY na poslužitelju.');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,authorization=req.headers.get('authorization');
 const hasCloud=!!(url&&key);
 if(!authorization?.startsWith('Bearer ')){
  if(!anonymousAiEnabled())throw new Error('Za AI se najprije prijavi u aplikaciju.');
  consumeAnonymousQuota(req);
  return {authenticated:false};
 }
 if(!hasCloud){
  if(!anonymousAiEnabled())throw new Error('Prijava za AI nije dostupna dok Supabase nije povezan.');
  consumeAnonymousQuota(req);
  return {authenticated:false};
 }
 const headers={apikey:key!,Authorization:authorization,'Content-Type':'application/json'};
 const r=await fetch(url!+'/auth/v1/user',{headers,cache:'no-store'});
 if(!r.ok){
  if(anonymousAiEnabled()){consumeAnonymousQuota(req);return {authenticated:false}};
  throw new Error('Prijava je istekla. Prijavi se ponovno.');
 }
 const rate=await fetch(url!+'/rest/v1/rpc/consume_ai_quota',{method:'POST',headers,body:'{}'});
 if(!rate.ok||!(await rate.json()))throw new Error('Dosegnut je limit AI zahtjeva. Pokušaj za sat vremena.');
 return {authenticated:true,url:url!,headers};
}

export async function userState(auth:AuthContext):Promise<State>{
 if(!auth.authenticated||!auth.url||!auth.headers)throw new Error('Za ovaj zahtjev nema spremljenog cloud dnevnika.');
 const r=await fetch(auth.url+'/rest/v1/rpc/load_diary',{method:'POST',headers:auth.headers,body:'{}',cache:'no-store'});
 if(!r.ok)throw new Error('Dnevnik nije dostupan.');
 const d=await r.json();
 if(!d?.state)throw new Error('Najprije spremi svoj dnevnik.');
 return stateSchema.parse(d.state);
}

export async function structured<T>(schema:z.ZodType<T>,jsonSchema:object,instructions:string,input:unknown):Promise<T>{
 const model=configuredAiModel();
 const requestBody:Record<string,unknown>={
  model,
  store:false,
  instructions,
  input:JSON.stringify(input),
  max_output_tokens:3000,
  text:{format:{type:'json_schema',name:'food_result',strict:true,schema:jsonSchema}}
 };
 if(/^(gpt-[56]|o\d)/.test(model))requestBody.reasoning={effort:process.env.OPENAI_REASONING_EFFORT||'low'};
 const r=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify(requestBody),
  signal:AbortSignal.timeout(45000)
 });
 if(!r.ok){
  let detail='';
  try{const d=await r.json();detail=d?.error?.message?` (${d.error.message})`:''}catch{}
  throw new Error('AI trenutno nije dostupan. Pokušaj ponovno.'+detail);
 }
 const d=await r.json();
 if(d.status==='incomplete')throw new Error('AI odgovor nije dovršen. Skrati unos i pokušaj ponovno.');
 const output=d.output?.flatMap((o:{content?:{type:string,text?:string}[]})=>o.content||[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');
 return schema.parse(JSON.parse(output||'{}'));
}

export async function safeBody(req:Request){const raw=await req.text();if(raw.length>50000)throw new Error('Unos je predug.');return JSON.parse(raw)}
export const errorResponse=(e:unknown)=>Response.json({error:e instanceof z.ZodError?'Podaci nisu valjani. Provjeri unos.':e instanceof Error?e.message:'Zahtjev nije uspio.'},{status:400});
