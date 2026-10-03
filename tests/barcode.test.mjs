import test from 'node:test';
import assert from 'node:assert/strict';
import {offProduct} from '../lib/off-product.ts';
import {foodSchema,makeItem,initialState,stateSchema,quantityUnit,nutrition,parseLocal} from '../lib/domain.ts';
import ts from 'typescript';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const nut={'energy-kcal_100g':42,proteins_100g:0,carbohydrates_100g:10.6,fat_100g:0};
const product={product_name:'Sok',brands:'Primjer',categories_tags:['en:beverages'],quantity:'500 ml',serving_size:'250 ml',nutriments:nut};
test('drink volumes use OFF normalized per-100ml values, not mass conversion',()=>{
 const p=offProduct(product);assert.equal(p.unit,'ml');assert.equal(p.serving,500);
 const f=foodSchema.parse({...p,id:'drink',aliases:['sok'],source:'Open Food Facts',verified:false});
 const i=makeItem(f,330,'lunch','2026-10-03',false);assert.equal(i.unit,'ml');assert.equal(nutrition(i).calories,138.6);assert.equal(nutrition({...i,grams:500}).calories,210);
 const s=initialState(false);s.foods=[f];s.items=[i];s.favorites=[{id:'fav',name:'Sok',items:[i]}];const reload=stateSchema.parse(JSON.parse(JSON.stringify(s)));
 assert.equal(reload.foods[0].unit,'ml');assert.equal(reload.items[0].unit,'ml');assert.equal(reload.favorites[0].items[0].unit,'ml');assert.deepEqual(reload.waterEntries,[]);
 assert.equal(parseLocal('0,5 l sok',[f],'lunch','2026-10-03').items[0].grams,500);
 assert.equal(parseLocal('250 g sok',[f],'lunch','2026-10-03').items.length,0);
});
test('volume parsing, multipacks and fallback servings are bounded',()=>{
 for(const [quantity,expected] of [['0,5 L',500],['33 cl',330],['2 dl',200],['500 ml',500]])assert.equal(offProduct({...product,quantity}).serving,expected);
 assert.equal(offProduct({...product,quantity:'6 x 330 ml',serving_size:'330 ml'}).serving,330);
 assert.equal(offProduct({...product,quantity:'20 L',serving_size:''}).serving,100);
 assert.equal(offProduct({...product,quantity:'500 ml',serving_size:'1 bottle (500 ml)'}).serving,500);
});
test('solids, powders, oil and unknown products are not silently converted to ml',()=>{
 for(const p of [ {...product,categories_tags:['en:biscuits'],quantity:'200 g',serving_size:'25 g'}, {...product,categories_tags:['en:beverages','en:drink-powders'],quantity:'500 g',serving_size:'30 g'}, {...product,categories_tags:['en:olive-oils'],quantity:'500 ml',serving_size:'15 ml'}, {...product,categories_tags:[]}])assert.equal(offProduct(p).unit,'g');
 const food=offProduct({...product,categories_tags:['en:biscuits'],quantity:'200 g',serving_size:'25 g'});assert.equal(food.serving,25);
 const legacy=initialState(false);assert.equal(quantityUnit(legacy.items[0]??{}),'g');assert.equal(stateSchema.parse(legacy).version,1);
});
test('explicit 100ml, kJ fallback and missing versus zero nutrients',()=>{
 const ml=offProduct({...product,categories_tags:[],nutrition_data_per:'100ml',nutriments:{'energy-kcal_100ml':10,proteins_100ml:0,carbohydrates_100ml:2.5,fat_100ml:0}});assert.equal(ml.unit,'ml');assert.equal(ml.calories,10);
 assert.equal(offProduct({...product,nutriments:{...nut,'energy-kcal_100g':undefined,'energy-kj_100g':175.728}}).calories,42);
 for(const invalid of [null,undefined,'',-1,'NaN'])assert.throws(()=>offProduct({...product,nutriments:{...nut,proteins_100g:invalid}}),/nisu dovoljno potpuni/);
 assert.equal(offProduct({...product,nutriments:{...nut,'energy-kcal_100g':0}}).calories,0);
});
test('barcode endpoint requests unit metadata and rejects incomplete products',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./barcode-route-',import.meta.url)));
 const original=globalThis.fetch;
 try{
  const source=(await readFile(new URL('../app/api/barcode/route.ts',import.meta.url),'utf8')).replace("@/lib/off-product",'../../lib/off-product.ts');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  await writeFile(dir+'/route.mjs',output);const {GET}=await import(pathToFileURL(dir+'/route.mjs').href);
  let response={status:1,product};let status=200;
  globalThis.fetch=async url=>{const fields=new URL(url).searchParams.get('fields');for(const f of ['quantity','categories_tags','nutrition_data_per'])assert.ok(fields.includes(f));return Response.json(response,{status})};
  const req=()=>new Request('https://kalora.test/api/barcode?code=5901234123457');
  let r=await GET(req());assert.equal(r.status,200);assert.equal((await r.json()).unit,'ml');
  response={status:1,product:{...product,nutriments:{...nut,proteins_100g:null}}};assert.equal((await GET(req())).status,422);
  response={status:0};assert.equal((await GET(req())).status,404);
  status=429;assert.equal((await GET(req())).status,502);
  assert.equal((await GET(new Request('https://kalora.test/api/barcode?code=abc'))).status,400);
 }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
