import { z } from 'zod';
export const mealTypes = ['breakfast','lunch','dinner','snack'] as const;
export type MealType = typeof mealTypes[number];
export const macros = ['calories','protein','carbs','fat'] as const;
export type Nutrients = Record<typeof macros[number],number>;
const n = z.number().finite().min(0).max(10000);
export const nutritionSchema = z.object({calories:n,protein:n,carbs:n,fat:n});
export const foodSchema = nutritionSchema.extend({id:z.string().max(100),name:z.string().min(1).max(150),brand:z.string().max(100),aliases:z.array(z.string().max(60)).max(20),serving:z.number().positive().max(5000),fiber:n,source:z.string().max(200),verified:z.boolean()});
export type Food = z.infer<typeof foodSchema>;
export const itemSchema = z.object({id:z.string().max(100),foodId:z.string().max(100),name:z.string().min(1).max(150),grams:z.number().positive().max(5000),meal:z.enum(mealTypes),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),isEstimate:z.boolean(),basis:nutritionSchema,source:z.string().max(200)});
export type Item = z.infer<typeof itemSchema>;
export const targetSchema = nutritionSchema.extend({calories:z.number().min(800).max(8000),protein:z.number().min(0).max(500),carbs:z.number().min(0).max(1200),fat:z.number().min(0).max(500)});
export const profileSchema=z.object({name:z.string().min(1).max(80),sex:z.enum(['male','female']),age:z.number().min(18).max(100),height:z.number().min(100).max(230),weight:z.number().min(35).max(300),goalWeight:z.number().min(35).max(300),activity:z.number().min(1.2).max(1.9),training:z.number().min(0).max(14),goal:z.enum(['mild','moderate','maintain','gain']),targets:targetSchema});
export type Profile = z.infer<typeof profileSchema>;
export const stateSchema=z.object({version:z.literal(1),profile:profileSchema,items:z.array(itemSchema).max(20000),foods:z.array(foodSchema).max(2000),favorites:z.array(z.object({id:z.string(),name:z.string().min(1).max(100),items:z.array(itemSchema).max(100)})).max(200),weights:z.array(z.object({date:z.string(),kg:z.number().min(35).max(300)})).max(3000),targets:z.record(targetSchema),water:z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.number().int().min(0).max(20000)).default({}),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(6000)})).max(200),onboarded:z.boolean(),demo:z.boolean()});
export type State=z.infer<typeof stateSchema>;
export const dateKey=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const dayOffset=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return dateKey(d)};
export const uid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
export const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const nutrition=(i:Item):Nutrients=>Object.fromEntries(macros.map(k=>[k,i.basis[k]*i.grams/100])) as Nutrients;
export const sum=(items:Item[]):Nutrients=>items.reduce((s,i)=>{const a=nutrition(i);for(const k of macros)s[k]+=a[k];return s},{calories:0,protein:0,carbs:0,fat:0});
export const fmt=(n:number,d=0)=>n.toLocaleString('hr-HR',{maximumFractionDigits:d});
export function makeItem(food:Food,grams:number,meal:MealType,date:string,isEstimate=true):Item{return {id:uid(),foodId:food.id,name:food.brand?`${food.name} · ${food.brand}`:food.name,grams,meal,date,isEstimate,basis:{calories:food.calories,protein:food.protein,carbs:food.carbs,fat:food.fat},source:food.source}}
export const baseFoods:Food[]=[
['banana','Banana',['banan'],120,89,1.1,22.8,.3,2.6],
['avocado','Avokado',['avokad'],150,160,2,8.5,14.7,6.7],
['oats','Zobene pahuljice',['zoben','zob'],40,379,13.2,67.7,6.5,10.1],
['whey','Whey izolat',['whey','hydro','izolat','protein u prahu'],30,370,85,3,2,0],
['cocoa','Kakao',['kakao','kaka'],5,228,19.6,57.9,13.7,37],
['pepper','Punjena paprika',['punjen','paprik'],220,130,6.5,10,7,1.5],
['bread','Bijeli kruh',['kruh','kruha'],35,266,8.9,49.4,3.3,2.7],
['egg','Jaje',['jaj'],50,155,12.6,1.1,10.6,0],
['prosciutto','Pršut',['prsut'],30,250,27,.5,16,0],
['pasta','Kuhana tjestenina',['past','tjestenin'],250,158,5.8,30.9,.9,1.8],
['oil','Maslinovo ulje',['ulj'],10,884,0,0,100,0],
['almond','Bademi',['badem'],30,579,21.2,21.6,49.9,12.5],
['date','Medjool datulja',['datul','medjool'],24,277,1.8,75,.2,6.7],
['chicken','Pileća prsa, pečena',['pilet','pilec'],150,165,31,0,3.6,0],
['rice','Kuhana riža',['riz'],150,130,2.7,28.2,.3,.4],
['yogurt','Grčki jogurt 2%',['jogurt'],150,73,9.9,3.9,2,0],
['milk','Mlijeko 2,8%',['mlijek'],200,58,3.2,4.7,2.8,0],
['tuna','Tuna u vodi, ocijeđena',['tun'],120,116,25.5,0,.8,0],
['apple','Jabuka',['jabuk'],180,52,.3,13.8,.2,2.4],
['potato','Kuhani krumpir',['krumpir'],200,87,1.9,20.1,.1,1.8]
].map(([id,name,aliases,serving,calories,protein,carbs,fat,fiber])=>({id,name,aliases,serving,calories,protein,carbs,fat,fiber,brand:'',source:id==='pepper'?'Generički recept; ovisi o mesu, riži i umaku':'Generička referentna procjena; provjerite deklaraciju',verified:false} as Food));
export const defaultProfile:Profile={name:'Korisnik',sex:'male',age:30,height:175,weight:75,goalWeight:75,activity:1.55,training:3,goal:'maintain',targets:{calories:2200,protein:150,carbs:250,fat:70}};
export function initialState(demo=true):State{const date=dateKey();return {version:1,profile:defaultProfile,items:demo?[['banana',120,'breakfast'],['avocado',75,'breakfast'],['oats',100,'breakfast'],['whey',30,'breakfast'],['cocoa',5,'breakfast'],['pepper',660,'lunch'],['bread',60,'lunch']].map(([f,g,m])=>makeItem(baseFoods.find(x=>x.id===f)!,Number(g),m as MealType,date, !['oats','bread'].includes(String(f)))):[],foods:[],favorites:[],weights:demo?[{date,kg:84.5}]:[],targets:{},water:{},messages:[],onboarded:false,demo}}
export function suggestWaterGoalMl(weightKg:number){return Math.min(6000,Math.max(1500,Math.round((weightKg*35)/250)*250))}
export function suggestTargets(p:Profile):Nutrients{const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161);const kcal=Math.max(1200,Math.round((bmr*p.activity+({mild:-250,moderate:-400,maintain:0,gain:200}[p.goal]))/50)*50);const protein=Math.round(p.weight*2),fat=Math.round(kcal*.27/9);return {calories:kcal,protein,fat,carbs:Math.round((kcal-protein*4-fat*9)/4)}}
export function parseLocal(text:string,foods:Food[],meal:MealType,date:string){
 const normalized=norm(text).replace(/(\d),(\d)/g,'$1.$2').replace(/½/g,'pola');
 const inferred=normalized.includes('doruc')?'breakfast':normalized.includes('rucak')?'lunch':normalized.includes('vecer')?'dinner':meal;
 const chunks=normalized.replace(/\b(po jeo|pojeo sam|dodaj|dorucak|rucak|vecera)\s*:?/g,'').split(/[,;+]|\s+i\s+/).map(s=>s.trim()).filter(Boolean);
 const unknown:string[]=[],items:Item[]=[];
 for(const s of chunks){const food=[...foods].sort((a,b)=>Math.max(...b.aliases.map(x=>x.length),b.name.length)-Math.max(...a.aliases.map(x=>x.length),a.name.length)).find(f=>[norm(f.name),...f.aliases.map(norm)].some(a=>s.includes(a)));
 if(!food){unknown.push(s);continue} const gram=s.match(/(\d+(?:\.\d+)?)\s*(kg|g|grama|gr|ml|mililitara)\b/);let grams=food.serving,isEstimate=true;
 if(gram){grams=Number(gram[1])*(gram[2]==='kg'?1000:1);isEstimate=/oko|otprilike/.test(s)}else{const count=s.match(/\b(\d+(?:\.\d+)?)\b/);const number=count?Number(count[1]):/\bdvije\b|\bdva\b/.test(s)?2:/\btri\b/.test(s)?3:1;grams*=number;if(/pola|polovic/.test(s))grams/=2;if(/velik/.test(s))grams*=1.25;if(/mal[oa]/.test(s))grams*=.7;if(/zlicic/.test(s))grams=5*number;else if(/zlic/.test(s))grams=15*number;}
 if(grams>0&&grams<=5000)items.push(makeItem(food,grams,inferred as MealType,date,isEstimate));else unknown.push(s);
 }return {items,unknown,mode:'local' as const};
}
