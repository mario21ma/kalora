import {NextRequest,NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function DELETE(req:NextRequest){
 const supabaseUrl=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
 const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 if(!supabaseUrl||!anonKey||!serviceRoleKey)return NextResponse.json({error:'Brisanje računa nije konfigurirano na poslužitelju.'},{status:503});
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return NextResponse.json({error:'Prijava je istekla. Prijavi se ponovno.'},{status:401});
 try{
  const userResponse=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:authorization},cache:'no-store'});
  if(!userResponse.ok)return NextResponse.json({error:'Prijava je istekla. Prijavi se ponovno.'},{status:401});
  const user=await userResponse.json() as {id?:string};
  if(!user.id)return NextResponse.json({error:'Korisnički račun nije pronađen.'},{status:401});
  const deleteResponse=await fetch(supabaseUrl+'/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',headers:{apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey},cache:'no-store'});
  if(!deleteResponse.ok){
   const body=await deleteResponse.json().catch(()=>({})) as {msg?:string;message?:string;error?:string};
   console.error('Supabase account delete failed',deleteResponse.status,body.error||body.message||body.msg||'Unknown error');
   return NextResponse.json({error:'Račun trenutačno nije moguće izbrisati. Pokušaj ponovno.'},{status:502});
  }
  return NextResponse.json({ok:true});
 }catch(error){
  console.error('Account delete failed',error);
  return NextResponse.json({error:'Brisanje računa trenutačno nije dostupno.'},{status:500});
 }
}
