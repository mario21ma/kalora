import {z} from 'zod';

export const runtime='nodejs';

const codeSchema=z.string().regex(/^\d{8,14}$/);
const n=(value:unknown)=>{const x=Number(value);return Number.isFinite(x)?x:NaN};

export async function GET(req:Request){
 try{
  const url=new URL(req.url);
  const code=codeSchema.parse(url.searchParams.get('code')||'');
  const fields='code,product_name,brands,nutriments,serving_size';
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${encodeURIComponent(fields)}`,{
   headers:{'User-Agent':'Kalora/1.1 barcode lookup'},
   cache:'no-store'
  });
  if(!r.ok)throw new Error('Open Food Facts trenutačno nije dostupan.');
  const data=await r.json();
  if(data?.status!==1||!data?.product)return Response.json({error:'Proizvod nije pronađen po tom barkodu.'},{status:404});
  const p=data.product,nut=p.nutriments||{};
  let calories=n(nut['energy-kcal_100g']);
  if(!Number.isFinite(calories)){const kj=n(nut['energy-kj_100g']??nut['energy_100g']);if(Number.isFinite(kj))calories=kj/4.184}
  const protein=n(nut.proteins_100g),carbs=n(nut.carbohydrates_100g),fat=n(nut.fat_100g),fiber=n(nut.fiber_100g);
  if(!p.product_name) return Response.json({error:'Proizvod postoji, ali nema upisan naziv.'},{status:422});
  if(![calories,protein,carbs,fat].every(Number.isFinite)) return Response.json({error:'Proizvod postoji, ali nutritivni podaci nisu dovoljno potpuni.'},{status:422});
  const servingMatch=String(p.serving_size||'').replace(',','.').match(/(\d+(?:\.\d+)?)\s*g\b/i);
  const serving=servingMatch?Math.min(5000,Math.max(1,Number(servingMatch[1]))):100;
  return Response.json({
   code,
   name:String(p.product_name).slice(0,150),
   brand:String(p.brands||'').split(',')[0].trim().slice(0,100),
   serving,
   calories:Math.max(0,calories),
   protein:Math.max(0,protein),
   carbs:Math.max(0,carbs),
   fat:Math.max(0,fat),
   fiber:Number.isFinite(fiber)?Math.max(0,fiber):0
  });
 }catch(e){
  if(e instanceof z.ZodError)return Response.json({error:'Neispravan barkod.'},{status:400});
  return Response.json({error:e instanceof Error?e.message:'Greška pri dohvaćanju proizvoda.'},{status:500});
 }
}
