import {NextRequest,NextResponse} from 'next/server';
import {dateKey} from '@/lib/domain';
import {authorizedPushUser,deliverPush,pushHttpError} from '@/lib/push-server';
import type {PushKind} from '@/lib/push-server';
export const dynamic='force-dynamic';
const kinds=new Set<PushKind>(['goal','progress','plateau']);
export async function POST(req:NextRequest){
 try{const userId=await authorizedPushUser(req),body=await req.json() as {kind?:PushKind};if(!body.kind||!kinds.has(body.kind))return NextResponse.json({error:'Nepoznata vrsta obavijesti.'},{status:400});const result=await deliverPush(userId,body.kind,dateKey());return NextResponse.json({ok:true,...result})}
 catch(error){const result=pushHttpError(error);return NextResponse.json({error:result.message},{status:result.status})}
}
