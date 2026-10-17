import {NextResponse} from 'next/server';
import {pushConfig} from '@/lib/push-server';
export const dynamic='force-dynamic';
export async function GET(){const publicKey=await pushConfig();return publicKey?NextResponse.json({publicKey}):NextResponse.json({error:'Push obavijesti nisu konfigurirane.'},{status:503})}
