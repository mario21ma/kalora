import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

export class AiHttpError extends Error {
 status:number;retryAfter?:number;
 constructor(message:string,status:number,retryAfter?:number){super(message);this.status=status;this.retryAfter=retryAfter}
}
export const anonymousAiEnabled=()=>process.env.ALLOW_ANONYMOUS_AI==='true';
function limit(name:string,fallback:number){const raw=process.env[name];if(!raw)return fallback;const value=Number(raw);if(!Number.isSafeInteger(value)||value<1||value>100000)throw new AiHttpError('AI zaštita nije ispravno konfigurirana.',503);return value}
export async function consumeAiQuota(req:Request,userId?:string){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new AiHttpError('AI zaštita trenutačno nije dostupna. Pokušaj kasnije.',503);
 let subject:string;
 if(userId)subject='user:'+userId;
 else{
  if(!anonymousAiEnabled())throw new AiHttpError('Za AI se najprije prijavi u aplikaciju.',401);
  // Only trust the forwarding header when Vercel is the ingress. Other hosts share a safe fallback bucket.
  const forwarded=process.env.VERCEL==='1'?req.headers.get('x-forwarded-for')?.split(',')[0]?.trim():null;
  let ip=forwarded&&isIP(forwarded)?forwarded.toLowerCase():'unknown';
  // Group IPv6 clients by /64 to prevent trivial address rotation.
  if(isIP(ip)===6){const parsed=new URL('http://['+ip+']/').hostname.slice(1,-1);const halves=parsed.split('::');const left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[];const parts=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;ip=parts.slice(0,4).map(p=>p.padStart(4,'0')).join(':')}
  subject='anon:'+createHmac('sha256',process.env.AI_RATE_LIMIT_SECRET||key).update(ip).digest('hex');
 }
 const prefix=userId?'AI_USER':'AI_ANON';
 const body={subject,user_id:userId||null,minute_limit:limit(prefix+'_PER_MINUTE',userId?6:3),hour_limit:limit(prefix+'_PER_HOUR',userId?40:10),day_limit:limit(prefix+'_PER_DAY',userId?200:20),global_minute_limit:limit('AI_GLOBAL_PER_MINUTE',30),global_hour_limit:limit('AI_GLOBAL_PER_HOUR',100),global_day_limit:limit('AI_GLOBAL_PER_DAY',500)};
 let result:Response;
 try{result=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/consume_ai_request_quota',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(8000)})}catch{throw new AiHttpError('AI zaštita trenutačno nije dostupna. Pokušaj kasnije.',503)}
 const data=await result.json().catch(()=>null);
 if(!result.ok||typeof data?.allowed!=='boolean'||!Number.isInteger(data?.retry_after)||data.retry_after<0||data.retry_after>86400)throw new AiHttpError('AI zaštita trenutačno nije dostupna. Pokušaj kasnije.',503);
 if(!data.allowed){const seconds=Math.max(1,data.retry_after),minutes=Math.ceil(seconds/60);throw new AiHttpError(data.scope==='global'?`AI je dosegnuo ukupni limit aplikacije. Pokušaj ponovno za ${minutes} min.`:`Dosegnut je ${userId?'tvoj':'anonimni'} limit AI zahtjeva. Pokušaj ponovno za ${minutes} min.`,429,seconds)}
}
