import {NextRequest,NextResponse} from 'next/server';
import type {PushSubscription} from 'web-push';
import {authorizedPushUser,deletePushSubscription,pushHttpError,savePushSubscription} from '@/lib/push-server';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{const userId=await authorizedPushUser(req),body=await req.json();const response=await savePushSubscription(userId,body as PushSubscription);if(!response.ok)throw new Error('push-db');return NextResponse.json({ok:true})}
 catch(error){const result=pushHttpError(error);return NextResponse.json({error:result.message},{status:result.status})}
}
export async function DELETE(req:NextRequest){
 try{const userId=await authorizedPushUser(req),body=await req.json();if(typeof body.endpoint!=='string'||!body.endpoint.startsWith('https://'))throw new Error('push-invalid');const response=await deletePushSubscription(userId,body.endpoint);if(!response.ok)throw new Error('push-db');return NextResponse.json({ok:true})}
 catch(error){const result=pushHttpError(error);return NextResponse.json({error:result.message},{status:result.status})}
}
