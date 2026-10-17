import webpush from 'web-push';
import type {NextRequest} from 'next/server';
import type {PushSubscription as WebPushSubscription} from 'web-push';

const dbUrl=()=> (process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
const anon=()=>process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
const service=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||'';
export type PushKind='weighing'|'goal'|'progress'|'plateau';

export async function authorizedPushUser(req:NextRequest){
 const url=dbUrl(),key=anon(),authorization=req.headers.get('authorization')||'';
 if(!url||!key)throw new Error('push-config');
 if(!authorization.startsWith('Bearer '))throw new Error('push-auth');
 const response=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},cache:'no-store'});
 if(!response.ok)throw new Error('push-auth');
 const user=await response.json() as {id?:string};if(!user.id)throw new Error('push-auth');
 return user.id;
}
function headers(){const key=service();if(!dbUrl()||!key)throw new Error('push-config');return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'}}
export async function pushConfig(){
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'';
 return publicKey&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT?publicKey:null;
}
const content:Record<PushKind,{title:string;body:string}>={
 weighing:{title:'Vrijeme je za vaganje',body:'Zabilježi novu težinu u Kalori i prati trend kroz vrijeme.'},
 goal:{title:'Novi kalorijski cilj',body:'Tvoj preporučeni dnevni cilj promijenio se. Otvori Kaloru za pojedinosti.'},
 progress:{title:'Napredak prema cilju',body:'Trend vaganja pokazuje promjenu prema tvojem cilju.'},
 plateau:{title:'Provjeri svoj napredak',body:'Kalora je primijetila moguću stagnaciju. Pregledaj trend i prijedlog u Povijesti.'},
};

async function rest(path:string,init:RequestInit={}){
 const response=await fetch(dbUrl()+'/rest/v1/'+path,{...init,headers:{...headers(),...(init.headers||{})},cache:'no-store'});
 return response;
}
export async function savePushSubscription(userId:string,subscription:WebPushSubscription){
 const endpoint=subscription.endpoint,keys=subscription.keys;
 if(!endpoint||!keys?.p256dh||!keys.auth||!endpoint.startsWith('https://'))throw new Error('push-invalid');
 const removed=await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,{method:'DELETE'});if(!removed.ok)throw new Error('push-db');
 return rest('push_subscriptions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:userId,endpoint,subscription,updated_at:new Date().toISOString()})});
}
export async function deletePushSubscription(userId:string,endpoint:string){
 return rest(`push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`,{method:'DELETE'});
}

export async function deliverPush(userId:string,kind:PushKind,period:string){
 const vapid=await pushConfig();if(!vapid)throw new Error('push-config');
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,vapid,process.env.VAPID_PRIVATE_KEY!);
 const profileResponse=await rest(`profiles?select=profile&user_id=eq.${encodeURIComponent(userId)}`);
 if(!profileResponse.ok)throw new Error('push-db');
 const [row]=await profileResponse.json() as {profile:{notifications?:Record<string,boolean>}}[];
 if(!row?.profile?.notifications?.[kind])return {sent:0,skipped:true};
 const subsResponse=await rest(`push_subscriptions?select=endpoint,subscription&user_id=eq.${encodeURIComponent(userId)}`);
 if(!subsResponse.ok)throw new Error('push-db');
 const subscriptions=await subsResponse.json() as {endpoint:string;subscription:WebPushSubscription}[];
 if(!subscriptions.length)return {sent:0,skipped:true};
 const prior=await rest(`push_delivery_log?select=user_id&user_id=eq.${encodeURIComponent(userId)}&kind=eq.${kind}&period=eq.${encodeURIComponent(period)}`);
 if(!prior.ok)throw new Error('push-db');if((await prior.json() as unknown[]).length)return {sent:0,skipped:true};
 let sent=0;
 for(const row of subscriptions){
  try{await webpush.sendNotification(row.subscription,JSON.stringify({...content[kind],tag:`kalora-${kind}-${period}`,url:'/'}));sent++}
  catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410)await deletePushSubscription(userId,row.endpoint)}
 }
 if(sent){const log=await rest('push_delivery_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:userId,kind,period})});if(!log.ok&&log.status!==409)throw new Error('push-db')}
 return {sent,skipped:false};
}

export function pushHttpError(error:unknown){
 const kind=error instanceof Error?error.message:'';
 if(kind==='push-auth')return {status:401,message:'Prijava je istekla. Prijavi se ponovno.'};
 if(kind==='push-invalid')return {status:400,message:'Pretplata za obavijesti nije valjana.'};
 if(kind==='push-config')return {status:503,message:'Push obavijesti još nisu konfigurirane na poslužitelju.'};
 return {status:502,message:'Push obavijest trenutačno nije moguće poslati.'};
}
