import { z } from 'zod';
export const mealTypes = ['breakfast','lunch','dinner','snack'] as const;
export type MealType = typeof mealTypes[number];
export const macros = ['calories','protein','carbs','fat'] as const;
export type Nutrients = Record<typeof macros[number],number>;
const n = z.number().finite().min(0).max(10000);
export const nutritionSchema = z.object({calories:n,protein:n,carbs:n,fat:n});
export const quantityUnit=(value:{unit?:'g'|'ml'})=>value.unit??'g';
// Validate new food data without invalidating existing diaries or cached declarations.
// A volume basis can exceed 100 g of nutrients per 100 ml (for example dense syrups).
// The energy floor uses only protein and fat: carbohydrates can include polyols
// such as zero-calorie erythritol. Fibre, alcohol and rounding also vary by label.
export const foodBasisSchema=nutritionSchema.extend({unit:z.enum(['g','ml']).optional(),fiber:n.optional()}).superRefine((basis,ctx)=>{
 const volume=quantityUnit(basis)==='ml',massLimit=volume?150:100,totalLimit=volume?155:105,energyLimit=volume?1500:1000;
 for(const key of ['protein','carbs','fat','fiber'] as const)if((basis[key]??0)>massLimit)ctx.addIssue({code:z.ZodIssueCode.custom,path:[key],message:`Vrijednost na 100 ${quantityUnit(basis)} prelazi dopuštenu granicu.`});
 if(basis.protein+basis.carbs+basis.fat>totalLimit)ctx.addIssue({code:z.ZodIssueCode.custom,path:['protein'],message:'Zbroj makronutrijenata nije moguć za ovu nutritivnu osnovu.'});
 if(basis.calories>energyLimit)ctx.addIssue({code:z.ZodIssueCode.custom,path:['calories'],message:'Kalorije na 100 jedinica prelaze dopuštenu granicu.'});
 const conservativeEnergy=4*basis.protein+9*basis.fat;
 if(basis.calories<conservativeEnergy*.65-30)ctx.addIssue({code:z.ZodIssueCode.custom,path:['calories'],message:'Kalorije su preniske za navedene makronutrijente. Provjerite deklaraciju.'});
});
const sourceUrlsSchema=z.array(z.string().max(2048).url().refine(value=>/^https?:\/\//.test(value),'Izvor mora biti HTTP ili HTTPS poveznica.')).max(10).optional();
export const foodSchema = nutritionSchema.extend({unit:z.enum(['g','ml']).optional(),id:z.string().max(100),name:z.string().min(1).max(500),brand:z.string().max(100),aliases:z.array(z.string().max(500)).max(20),serving:z.number().positive().max(5000),fiber:n,source:z.string().max(200),sourceUrls:sourceUrlsSchema,verified:z.boolean()});
export type Food = z.infer<typeof foodSchema>;
const timestampSchema=z.string().datetime({offset:true}).nullable();
// Legacy `grams` stores the numeric quantity; `unit` also defines the basis per 100.
// Missing unit remains grams. Never relabel or convert old diary entries implicitly.
export const itemSchema = z.object({unit:z.enum(['g','ml']).optional(),id:z.string().max(100),foodId:z.string().max(100),name:z.string().min(1).max(500),grams:z.number().positive().max(5000),meal:z.enum(mealTypes),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),isEstimate:z.boolean(),basis:nutritionSchema,source:z.string().max(200),sourceUrls:sourceUrlsSchema,loggedAt:timestampSchema.optional().default(null)});
export type Item = z.infer<typeof itemSchema>;
export const targetSchema = nutritionSchema.extend({calories:z.number().min(800).max(8000),protein:z.number().min(0).max(500),carbs:z.number().min(0).max(1200),fat:z.number().min(0).max(500)});
export const profileSchema=z.object({layout:z.enum(['classic','compact']).default('classic'),accentTheme:z.enum(['blue','green','yellow','red','white']).default('blue'),name:z.string().min(1).max(80),sex:z.enum(['male','female']),age:z.number().min(18).max(100),height:z.number().min(100).max(230),weight:z.number().min(35).max(300),goalWeight:z.number().min(35).max(300),activity:z.number().min(1.2).max(1.9),training:z.number().min(0).max(14),goal:z.enum(['mild','moderate','maintain','gain']),targets:targetSchema,targetMode:z.enum(['manual','recommended']).default('manual'),autoAdjustCalories:z.boolean().default(false),weighReminderDays:z.union([z.literal(7),z.literal(14),z.literal(30)]).default(7),notifications:z.object({weighing:z.boolean().default(false),goal:z.boolean().default(false),progress:z.boolean().default(false),plateau:z.boolean().default(false)}).default({}),waterGoalMl:z.number().int().min(500).max(10000).nullable().optional(),waterTrackingEnabled:z.boolean().default(true),showSilhouettes:z.boolean().default(true)});
export type Profile = z.infer<typeof profileSchema>;
export const waterEntrySchema=z.object({id:z.string().min(1).max(100),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),amountMl:z.number().int().min(1).max(20000),loggedAt:timestampSchema}).refine(e=>e.loggedAt!==null||e.id==='legacy-water-'+e.date,{message:'Novi unos vode mora imati vrijeme dodavanja.'});
export type WaterEntry=z.infer<typeof waterEntrySchema>;
const rawStateSchema=z.object({version:z.literal(1),profile:profileSchema,items:z.array(itemSchema).max(20000),foods:z.array(foodSchema).max(2000),favorites:z.array(z.object({id:z.string(),name:z.string().min(1).max(100),items:z.array(itemSchema).max(100)})).max(200),weights:z.array(z.object({date:z.string(),kg:z.number().min(35).max(300)})).max(3000),targets:z.record(targetSchema),waterEntries:z.array(waterEntrySchema).max(20000).optional(),water:z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.number().int().min(0).max(20000)).default({}),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(6000)})).max(200),onboarded:z.boolean(),demo:z.boolean()});
// Explicit entries are authoritative; legacy daily totals are migrated exactly once.
export const stateSchema=rawStateSchema.transform(s=>{
 const waterEntries=s.waterEntries??Object.entries(s.water).filter(([,ml])=>ml>0).map(([date,amountMl])=>({id:'legacy-water-'+date,date,amountMl,loggedAt:null}));
 const water:Record<string,number>=Object.fromEntries(Object.keys(s.water).map(d=>[d,0]));
 for(const entry of waterEntries)water[entry.date]=(water[entry.date]||0)+entry.amountMl;
 return {...s,waterEntries,water};
}).superRefine((s,ctx)=>{
 if(new Set(s.waterEntries.map(e=>e.id)).size!==s.waterEntries.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['waterEntries'],message:'Unosi vode moraju imati različite oznake.'});
 if(Object.values(s.water).some(ml=>ml>20000))ctx.addIssue({code:z.ZodIssueCode.custom,path:['waterEntries'],message:'Dnevni unos vode prelazi 20000 ml.'});
});
export type State=z.infer<typeof stateSchema>;
export const waterTotal=(entries:WaterEntry[],date:string)=>entries.filter(e=>e.date===date).reduce((sum,e)=>sum+e.amountMl,0);
export const waterForDate=(entries:WaterEntry[],date:string)=>entries.filter(e=>e.date===date).sort((a,b)=>(a.loggedAt||'').localeCompare(b.loggedAt||'')||a.id.localeCompare(b.id));
export function makeWaterEntry(amountMl:number,date:string,now=new Date()):WaterEntry{return waterEntrySchema.parse({id:uid(),date,amountMl,loggedAt:now.toISOString()})}
export const withWaterEntries=(s:State,waterEntries:WaterEntry[]):State=>stateSchema.parse({...s,waterEntries});
// Undo only entries touched by this operation, preserving later independent additions.
export function undoWaterChange(current:WaterEntry[],before:WaterEntry[],after:WaterEntry[]):WaterEntry[]{
 const old=new Map(before.map(e=>[e.id,e])),next=new Map(after.map(e=>[e.id,e]));
 const changed=new Set([...old.keys(),...next.keys()].filter(id=>JSON.stringify(old.get(id))!==JSON.stringify(next.get(id))));
 const result=current.flatMap(e=>{if(!changed.has(e.id)||JSON.stringify(e)!==JSON.stringify(next.get(e.id)))return [e];changed.delete(e.id);return old.has(e.id)?[old.get(e.id)!]:[]});
 for(const id of changed)if(old.has(id)&&!next.has(id)&&!result.some(e=>e.id===id))result.push(old.get(id)!);
 return result;
}
export const loggedTime=(timestamp:string)=>new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp));

export const dateKey=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const dayOffset=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return dateKey(d)};
export const uid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
export const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const searchAlias=(s:string)=>norm(s).slice(0,500);
export const nutrition=(i:Item):Nutrients=>Object.fromEntries(macros.map(k=>[k,i.basis[k]*i.grams/100])) as Nutrients;
export const sum=(items:Item[]):Nutrients=>items.reduce((s,i)=>{const a=nutrition(i);for(const k of macros)s[k]+=a[k];return s},{calories:0,protein:0,carbs:0,fat:0});
export const fmt=(n:number,d=0)=>n.toLocaleString('hr-HR',{maximumFractionDigits:d});
export function makeItem(food:Food,grams:number,meal:MealType,date:string,isEstimate=true):Item{return {id:uid(),foodId:food.id,name:(food.brand?`${food.name} · ${food.brand}`:food.name).slice(0,500),grams,...(food.unit?{unit:food.unit}:{}),meal,date,isEstimate,basis:{calories:food.calories,protein:food.protein,carbs:food.carbs,fat:food.fat},source:food.source,...(food.sourceUrls?{sourceUrls:food.sourceUrls}:{}),loggedAt:new Date().toISOString()}}
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
].map(([id,name,aliases,serving,calories,protein,carbs,fat,fiber])=>({id,name,aliases,serving,calories,protein,carbs,fat,fiber,...(id==='milk'?{unit:'ml' as const}:{}),brand:'',source:id==='pepper'?'Generički recept; ovisi o mesu, riži i umaku':'Generička referentna procjena; provjerite deklaraciju',verified:false} as Food));
export const defaultProfile:Profile={layout:'classic',accentTheme:'blue',waterTrackingEnabled:true,showSilhouettes:true,targetMode:'manual',autoAdjustCalories:false,weighReminderDays:7,notifications:{weighing:false,goal:false,progress:false,plateau:false},name:'Korisnik',sex:'male',age:30,height:175,weight:75,goalWeight:75,activity:1.55,training:3,goal:'maintain',targets:{calories:2200,protein:150,carbs:250,fat:70}};
export function initialState(demo=true):State{const date=dateKey();return {version:1,profile:defaultProfile,items:demo?[['banana',120,'breakfast'],['avocado',75,'breakfast'],['oats',100,'breakfast'],['whey',30,'breakfast'],['cocoa',5,'breakfast'],['pepper',660,'lunch'],['bread',60,'lunch']].map(([f,g,m])=>makeItem(baseFoods.find(x=>x.id===f)!,Number(g),m as MealType,date, !['oats','bread'].includes(String(f)))):[],foods:[],favorites:[],weights:demo?[{date,kg:84.5}]:[],targets:{},water:{},waterEntries:[],messages:[],onboarded:false,demo}}
export function suggestWaterGoalMl(weightKg:number){return Math.min(6000,Math.max(1500,Math.round((weightKg*35)/250)*250))}
export function resolveWaterGoalMl(p:Profile,weightKg=p.weight){return p.waterGoalMl??suggestWaterGoalMl(weightKg)}
export function suggestTargets(p:Profile):Nutrients{
 const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161);
 const calories=Math.min(8000,Math.max(1200,Math.round((bmr*p.activity+({mild:-250,moderate:-400,maintain:0,gain:200}[p.goal]))/50)*50));
 const fat=Math.min(500,Math.round(calories*.27/9));
 const protein=Math.min(500,Math.round(p.weight*2),Math.floor((calories-fat*9)/4));
 const carbs=Math.min(1200,Math.max(0,Math.round((calories-protein*4-fat*9)/4)));
 return targetSchema.parse({calories,protein,fat,carbs});
}
// Interpret explicit quantities before splitting the list: e.g. "dvadeset i dva"
// and "jedan i pol" describe one amount, rather than two independent foods.
const countWords:Record<string,number>={nula:0,jedan:1,jedna:1,jedno:1,jednu:1,dva:2,dvije:2,dvoje:2,tri:3,cetiri:4,cetvero:4,pet:5,sest:6,sedam:7,osam:8,devet:9,deset:10,jedanaest:11,dvanaest:12,trinaest:13,cetrnaest:14,petnaest:15,sesnaest:16,sedamnaest:17,osamnaest:18,devetnaest:19,dvadeset:20,trideset:30,cetrdeset:40,pedeset:50,sezdeset:60,sedamdeset:70,osamdeset:80,devedeset:90,sto:100,stotinu:100,dvjesto:200,dvjesta:200,tristo:300,trista:300,tisucu:1000};
const unicodeFractions:Record<string,number>={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3};
const amountUnits:Record<string,{unit:'g'|'ml',factor:number}>={kg:{unit:'g',factor:1000},kilograma:{unit:'g',factor:1000},g:{unit:'g',factor:1},gram:{unit:'g',factor:1},grama:{unit:'g',factor:1},grami:{unit:'g',factor:1},gr:{unit:'g',factor:1},ml:{unit:'ml',factor:1},mililitar:{unit:'ml',factor:1},mililitra:{unit:'ml',factor:1},mililitara:{unit:'ml',factor:1},cl:{unit:'ml',factor:10},dl:{unit:'ml',factor:100},l:{unit:'ml',factor:1000},litra:{unit:'ml',factor:1000},litre:{unit:'ml',factor:1000},litara:{unit:'ml',factor:1000}};
const quantityNumber='(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const amountPattern=new RegExp('(?<![\\w.])('+quantityNumber+')\\s*('+Object.keys(amountUnits).join('|')+')\\b');
const quantityPattern=new RegExp('(?<![\\w.])'+quantityNumber+'(?![\\d.])','g');
const countPattern=new RegExp('(?<![\\w.])('+quantityNumber+')(?![\\w.])');
const percentagePattern=new RegExp('(?<![\\w.])'+quantityNumber+'\\s*%','g');
// Recognize measure words even when their amount/unit is unsupported. A cup,
// bottle or unparsed mass unit must not become the food's default serving.
const measurePattern=new RegExp('\\b(?:'+Object.keys(amountUnits).join('|')+'|(?:kilo|mili|mikro)?gram[a-z]*|(?:mili|centi|deci)?lit(?:ar|r)[a-z]*|mg|ug|mcg|dag|dkg|oz|lb|ounce[a-z]*|pound[a-z]*|cup[a-z]*|(?:salic|cas|boc|bocic|sak)(?:a|e|i|u|om|ama)|paket[a-z]*|pakiranj[a-z]*|vrecic[a-z]*|zdjel[a-z]*|tanjur[a-z]*|porcij[a-z]*)\\b');
const numberWords=(accept:(value:number)=>boolean)=>Object.keys(countWords).filter(word=>accept(countWords[word])).join('|');
const onesWords=numberWords(value=>value>0&&value<10),tensWords=numberWords(value=>value>=20&&value<100&&value%10===0),hundredWords=numberWords(value=>value>=100&&value<1000),underHundredWords=numberWords(value=>value>0&&value<100);
function normalizeQuantities(text:string){
 return norm(text).replace(/(\d),(\d)/g,'$1.$2')
  .replace(/(\d+)\s*([½¼¾⅓⅔])/g,(_,whole,fraction)=>String(Number(whole)+unicodeFractions[fraction]))
  .replace(/[½¼¾⅓⅔]/g,fraction=>String(unicodeFractions[fraction]))
  .replace(/\b(\d+)\s+(\d+)\s*\/\s*(\d+)\b/g,(original,whole,numerator,denominator)=>Number(denominator)>0?String(Number(whole)+Number(numerator)/Number(denominator)):original)
  .replace(/\b(\d+)\s*\/\s*(\d+)\b/g,(original,numerator,denominator)=>Number(denominator)>0?String(Number(numerator)/Number(denominator)):original)
  .replace(new RegExp('\\b('+hundredWords+')\\s+(?:i\\s+)?('+tensWords+')\\s+(?:i\\s+)?('+onesWords+')\\b','g'),(_,hundreds,tens,ones)=>String(countWords[hundreds]+countWords[tens]+countWords[ones]))
  .replace(new RegExp('\\b('+hundredWords+')\\s+(?:i\\s+)?('+underHundredWords+')\\b','g'),(_,hundreds,rest)=>String(countWords[hundreds]+countWords[rest]))
  .replace(new RegExp('\\b('+tensWords+')\\s+(?:i\\s+)?('+onesWords+')\\b','g'),(_,tens,ones)=>String(countWords[tens]+countWords[ones]))
  .replace(new RegExp('\\b('+Object.keys(countWords).join('|')+')\\b','g'),word=>String(countWords[word]))
  .replace(/\b(\d+)\s+i\s+(?:pol|pola)\b/g,(_,whole)=>String(Number(whole)+.5))
  .replace(/\b(?:pol|pola|polovic[a-z]*)\b/g,'0.5');
}
export function parseLocal(text:string,foods:Food[],meal:MealType,date:string){
 const normalized=normalizeQuantities(text);
 const inferred=normalized.includes('doruc')?'breakfast':normalized.includes('rucak')?'lunch':normalized.includes('vecer')?'dinner':meal;
 // An unresolved conjunction between two amounts is one ambiguous quantity,
 // whereas a conjunction after a named food still separates meal items.
 const chunks=normalized.replace(/\b(po jeo|pojeo sam|dodaj|dorucak|rucak|vecera)\s*:?/g,'')
  .replace(new RegExp('(?<![\\w.])('+quantityNumber+')\\s*(?:i|\\+)\\s*(?='+quantityNumber+')','g'),'$1 ')
  .split(/[,;+]|\s+i\s+/).map(s=>s.trim()).filter(Boolean);
 const unknown:string[]=[],items:Item[]=[];
 for(const s of chunks){
  const food=[...foods].sort((a,b)=>Math.max(...b.aliases.map(x=>x.length),b.name.length)-Math.max(...a.aliases.map(x=>x.length),a.name.length)).find(f=>[norm(f.name),...f.aliases.map(norm)].some(a=>s.includes(a)));
  // Do not silently turn malformed or unresolved explicit quantities into one serving.
  // Percentages describe the product; digits inside names such as B12 are not
  // amounts. Keep the original chunk for food matching and clarification.
  const quantityText=s.replace(percentagePattern,''),quantities=quantityText.match(quantityPattern)||[];
  const unresolved=/\/|\p{No}|(?:^|\s)[-−–]\s*(?:\d|\.)|\d\s*[-–]\s*\d|\d*\.\d*\.\d|\b(?:minus|nekoliko|par|vise|manje|mnogo|puno|malo|nekolicina|cetvrt[a-z]*|trecin[a-z]*|osmin[a-z]*|polovin[a-z]*|petsto|sesto|sedamsto|osamsto|devetsto|[a-z]*desetak|[a-z]*stotin[a-z]*|[a-z]*tisuc[a-z]*|[a-z]*cetir[a-z]*)\b/u.test(quantityText)||quantities.length>1||(!quantities.length&&/(?<!\w)(?:\d|\.\d)/.test(quantityText));
  if(!food||unresolved){unknown.push(s);continue}
  const amount=quantityText.match(amountPattern),count=quantityText.match(countPattern);
  if(measurePattern.test(amount?quantityText.replace(amount[0],''):quantityText)||(!amount&&quantities.length>0&&!count)){unknown.push(s);continue}
  let grams=food.serving,isEstimate=true;
  if(amount){
   const {unit,factor}=amountUnits[amount[2]];
   if(unit!==quantityUnit(food)){unknown.push(s);continue}
   grams=Number(amount[1])*factor;isEstimate=/oko|otprilike/.test(s);
  }else{
   const number=count?Number(count[1]):1;
   grams*=number;
   if(/velik/.test(s))grams*=1.25;
   if(/mal[oa]/.test(s))grams*=.7;
   if(/zlicic/.test(s))grams=5*number;else if(/zlic/.test(s))grams=15*number;
  }
  if(grams>0&&grams<=5000)items.push(makeItem(food,grams,inferred as MealType,date,isEstimate));else unknown.push(s);
 }
 return {items,unknown,mode:'local' as const};
}
