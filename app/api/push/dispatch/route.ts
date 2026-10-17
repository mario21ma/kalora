import {NextRequest,NextResponse} from 'next/server';
import {dateKey} from '@/lib/domain';
import {deliverPush} from '@/lib/push-server';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET||'',supabaseUrl=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,''),serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!supabaseUrl||!serviceRole)return NextResponse.json({error:'Push dispatch is not configured.'},{status:503});
 try{
  const response=await fetch(supabaseUrl+'/rest/v1/rpc/pending_push_weigh_reminders',{method:'POST',headers:{apikey:serviceRole,Authorization:'Bearer '+serviceRole,'Content-Type':'application/json'},body:JSON.stringify({p_today:dateKey()}),cache:'no-store'});
  if(!response.ok)throw new Error('Reminder query failed');
  const reminders=await response.json() as {user_id:string;period:string}[];let delivered=0;
  for(const reminder of reminders){try{const result=await deliverPush(reminder.user_id,'weighing',reminder.period);delivered+=result.sent}catch{}}
  return NextResponse.json({ok:true,eligible:reminders.length,delivered});
 }catch{return NextResponse.json({error:'Push dispatch failed.'},{status:502})}
}
