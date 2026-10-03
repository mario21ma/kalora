// OFF's normalized *_100g fields mean per 100 ml for liquids.
// https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/
const numeric=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;
function measure(text:unknown,unit:'g'|'ml'){
 const value=String(text??'').toLowerCase().replace(/,/g,'.');
 // Prefer an explicit metric amount, including parentheses after "1 bottle".
 const match=value.match(unit==='ml'?/(\d+(?:\.\d+)?)\s*(ml|cl|dl|l)\b/:/(\d+(?:\.\d+)?)\s*(kg|g)\b/);
 if(!match)return null;
 const amount=Number(match[1])*({ml:1,cl:10,dl:100,l:1000,g:1,kg:1000}[match[2]]??1);
 return amount>=1&&amount<=5000?amount:null;
}
export function offProduct(p:Record<string,any>){
 const tags:Array<string>=Array.isArray(p.categories_tags)?p.categories_tags:[];
 const dry=tags.some(t=>/powder|dried|dehydrated|preparation|syrup|concentrate/.test(t));
 const drink=!dry&&tags.some(t=>['en:beverages','en:milks','en:plant-based-milks','en:beers','en:fruit-juices','en:waters','en:soft-drinks'].includes(t));
 const unit:'g'|'ml'=p.nutrition_data_per==='100ml'||(drink&&(measure(p.quantity,'ml')!==null||measure(p.serving_size,'ml')!==null))?'ml':'g';
 const nut=p.nutriments??{};
 const read=(key:string)=>numeric(unit==='ml'&&nut[key+'_100ml']!==undefined?nut[key+'_100ml']:nut[key+'_100g']);
 let calories=read('energy-kcal');
 if(!Number.isFinite(calories)){const kj=Number.isFinite(read('energy-kj'))?read('energy-kj'):read('energy');if(Number.isFinite(kj))calories=kj/4.184;}
 const protein=read('proteins'),carbs=read('carbohydrates'),fat=read('fat'),fiber=read('fiber');
 if(!p.product_name)throw new Error('Proizvod postoji, ali nema upisan naziv.');
 if(![calories,protein,carbs,fat].every(v=>Number.isFinite(v)&&v>=0&&v<=10000))throw new Error('Proizvod postoji, ali nutritivni podaci nisu dovoljno potpuni.');
 // For drinks offer the bottle/can amount. Do not multiply a multipack.
 const multi=/\d+\s*[x×]/i.test(String(p.quantity??''));
 const serving=(unit==='ml'&&!multi?measure(p.quantity,unit):null)??measure(p.serving_size,unit)??(unit==='ml'?250:100);
 return {name:String(p.product_name).slice(0,500),brand:String(p.brands??'').split(',')[0].trim().slice(0,100),unit,serving,calories,protein,carbs,fat,fiber:Number.isFinite(fiber)&&fiber>=0&&fiber<=10000?fiber:0};
}
