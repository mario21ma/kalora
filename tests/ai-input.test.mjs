import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {baseFoods,foodSchema,initialState,makeItem,nutrition,stateSchema} from '../lib/domain.ts';
import {offProduct} from '../lib/off-product.ts';

// Execute the actual handlers/server helpers. Only remote HTTP is simulated;
// no credentials, paid model requests or real user diaries are involved.
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const zodUrl=import.meta.resolve('zod'),domainUrl=new URL('../lib/domain.ts',import.meta.url).href,rateUrl=new URL('../lib/ai-rate-limit.ts',import.meta.url).href;
const serverSource=(await readFile(new URL('../lib/ai-server.ts',import.meta.url),'utf8')).replaceAll("'zod'",JSON.stringify(zodUrl)).replaceAll("'./domain'",JSON.stringify(domainUrl)).replaceAll("'./ai-rate-limit'",JSON.stringify(rateUrl));
const serverUrl=moduleUrl(serverSource);
async function route(name){const source=(await readFile(new URL('../app/api/'+name+'/route.ts',import.meta.url),'utf8')).replaceAll("'zod'",JSON.stringify(zodUrl)).replaceAll("'@/lib/domain'",JSON.stringify(domainUrl)).replaceAll("'@/lib/ai-server'",JSON.stringify(serverUrl));return import(moduleUrl(source))}
const {POST:analyze}=await route('analyze'),{POST:chat}=await route('chat');
const date='2026-10-14';
const standard={foodId:null,name:'Primjer sok',grams:330,unit:'ml',basisUnit:'ml',isEstimate:false,basis:{calories:42,protein:0,carbs:10.6,fat:0},sourceType:'estimate',sourceUrl:null};
const json=(result,annotations=[])=>({type:'message',content:[{type:'output_text',text:JSON.stringify(result),annotations}]});

async function fixture(run){
 const originalFetch=globalThis.fetch;
 const variables=['OPENAI_API_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ALLOW_ANONYMOUS_AI','AI_GLOBAL_PER_DAY'];
 const originalEnv=Object.fromEntries(variables.map(name=>[name,process.env[name]]));
 Object.assign(process.env,{OPENAI_API_KEY:'test-openai',NEXT_PUBLIC_SUPABASE_URL:'https://database.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',ALLOW_ANONYMOUS_AI:'true'});delete process.env.AI_GLOBAL_PER_DAY;
 let result={meal:'lunch',items:[standard],unknown:[]},annotations=[],toolOutput=[],requestBody,authState=null;
 const requests=[];
 globalThis.fetch=async(url,options={})=>{
  requests.push(String(url));
  if(String(url).endsWith('/consume_ai_request_quota'))return Response.json({allowed:true,retry_after:0});
  if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001'});
  if(String(url).endsWith('/load_diary'))return Response.json({state:authState,revision:1});
  assert.equal(url,'https://api.openai.com/v1/responses');requestBody=JSON.parse(options.body);
  return Response.json({status:'completed',output:[...toolOutput,json(result,annotations)]});
 };
 const request=body=>new Request('https://kalora.test/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...(authState?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify(body)});
 const api={
  set(item,{tools=[],citations=[]}={}){result={meal:'lunch',items:[{...standard,...item}],unknown:[]};toolOutput=tools;annotations=citations},
  setChat(value){result=value;toolOutput=[];annotations=[]},
  authenticate(state){authState=state},
  async analyze(extra={}){const response=await analyze(request({text:'330 ml Primjer sok',meal:'lunch',date,...extra}));return {status:response.status,body:await response.json()}},
  async chat(extra={}){const state=initialState(false);const response=await chat(request({text:'Promijeni sok na 500 ml',date,context:{items:[],target:state.profile.targets,last7:[],history:[]},...extra}));return {status:response.status,body:await response.json()}},
  get upstream(){return requestBody},get requests(){return requests}
 };
 try{await run(api)}finally{globalThis.fetch=originalFetch;for(const [name,value] of Object.entries(originalEnv))if(value===undefined)delete process.env[name];else process.env[name]=value}
}

test('AI new drinks preserve quantity and nutrition per 100 ml across reload and favorites',async()=>fixture(async api=>{
 const response=await api.analyze();assert.equal(response.status,200);const item=response.body.items[0];
 assert.equal(item.unit,'ml');assert.equal(item.grams,330);assert.equal(nutrition(item).calories,138.6);
 const state=initialState(false);state.items=[item];state.favorites=[{id:'fav',name:'Sok',items:[item]}];
 const saved=stateSchema.parse(JSON.parse(JSON.stringify(state)));assert.equal(saved.items[0].unit,'ml');assert.equal(saved.favorites[0].items[0].unit,'ml');
 const shape=api.upstream.text.format.schema.properties.items.items;
 for(const field of ['unit','basisUnit','sourceUrl'])assert.ok(shape.required.includes(field));
 assert.equal(api.upstream.max_output_tokens,3000);assert.equal(api.upstream.max_tool_calls,1);
 api.set({unit:'g',basisUnit:'g',name:'Primjer jelo'});assert.equal((await api.analyze()).body.items[0].unit,'g');
 api.set({unit:'g',basisUnit:'g'});const massId=(await api.analyze()).body.items[0].foodId;
 assert.notEqual(massId,item.foodId,'The same name with a different unit must not overwrite a cached basis');
 api.set({basisUnit:'g'});const mismatch=await api.analyze();assert.equal(mismatch.status,400);assert.match(mismatch.body.error,/Jedinica/);
}));

test('catalog nutrition and units remain authoritative over generated values',async()=>fixture(async api=>{
 const food=foodSchema.parse({id:'catalog-drink',name:'Primjer sok',brand:'',aliases:['sok'],serving:250,unit:'ml',calories:42,protein:0,carbs:10.6,fat:0,fiber:0,source:'Open Food Facts',verified:false});
 api.set({foodId:food.id,sourceType:'catalog',unit:'ml',basisUnit:'ml',basis:{calories:9000,protein:150,carbs:150,fat:150}});
 const response=await api.analyze({foods:[food]});assert.equal(response.status,200);const item=response.body.items[0];
 assert.equal(item.unit,'ml');assert.equal(item.basis.calories,42);assert.equal(item.basis.protein,0);assert.equal(nutrition(item).calories,138.6);
 for(const units of [{unit:'g',basisUnit:'g'},{unit:'g',basisUnit:'ml'},{unit:'ml',basisUnit:'g'}]){
  api.set({foodId:food.id,sourceType:'catalog',...units});const mismatch=await api.analyze({foods:[food]});assert.equal(mismatch.status,400);assert.match(mismatch.body.error,/Jedinica/);
 }
 api.set({foodId:'invented'});assert.equal((await api.analyze()).status,400);
 api.set({foodId:null,sourceType:'catalog'});assert.equal((await api.analyze()).status,400);
 // New baseline milk is ml, but stored legacy custom milk remains on its g
 // basis. Catalog changes must not convert or discard historical definitions.
 const legacy=foodSchema.parse({...baseFoods.find(food=>food.id==='milk'),unit:undefined,calories:61});
 api.set({foodId:'milk',sourceType:'catalog',unit:'g',basisUnit:'g'});
 const restored=await api.analyze({text:'330 g mlijeko',foods:[legacy]});assert.equal(restored.status,200);assert.equal(restored.body.items[0].unit,undefined);assert.equal(restored.body.items[0].basis.calories,61);
}));

test('AI web claims stay estimates; sources require a completed tool and real HTTP citations',async()=>fixture(async api=>{
 const url='https://manufacturer.test/product';
 const citation={type:'url_citation',url},tool={type:'web_search_call',status:'completed',action:{type:'search',sources:[{type:'url',url}]}};
 for(const evidence of [{},{citations:[citation]},{tools:[{...tool,status:'failed'}],citations:[citation]}]){
  api.set({sourceType:'web',sourceUrl:url},evidence);const response=await api.analyze();assert.equal(response.status,200);
  assert.match(response.body.items[0].source,/AI procjena/);assert.ok(!response.body.items[0].source.includes('Web provjerena'));assert.equal(response.body.items[0].sourceUrls,undefined);
 }
 api.set({sourceType:'web',sourceUrl:url},{tools:[tool],citations:[citation]});let response=await api.analyze();
 assert.deepEqual(response.body.items[0].sourceUrls,[url]);assert.match(response.body.items[0].source,/nije neovisno provjeren/);
 assert.deepEqual(api.upstream.include,['web_search_call.action.sources']);
 const state=initialState(false);state.items=response.body.items;assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(state))).items[0].sourceUrls,[url]);
 api.set({sourceType:'web',sourceUrl:'https://invented.test/product'},{tools:[tool],citations:[citation]});assert.equal((await api.analyze()).body.items[0].sourceUrls,undefined);
 for(const invalid of ['javascript:alert(1)','file:///secret','https://user:secret@manufacturer.test/product']){
  api.set({sourceType:'web',sourceUrl:invalid},{tools:[{...tool,action:{sources:[{url:invalid}]}}],citations:[{type:'url_citation',url:invalid}]});assert.equal((await api.analyze()).body.items[0].sourceUrls,undefined);
 }
}));

test('legacy AI web cache is reused without repeating unsupported verification claims',async()=>fixture(async api=>{
 const food=foodSchema.parse({id:'ai-old-declaration',name:'Primjer sok',brand:'',aliases:['sok'],serving:250,calories:43,protein:0,carbs:10.7,fat:0,fiber:0,source:'Web provjerena deklaracija proizvoda',verified:true});
 const before=JSON.stringify(food);
 api.set({foodId:food.id,sourceType:'catalog',unit:'g',basisUnit:'g'});
 const response=await api.analyze({foods:[food]});assert.equal(response.status,200);
 const item=response.body.items[0];assert.equal(item.grams,330);assert.equal(item.unit,undefined);assert.equal(item.basis.calories,43);assert.equal(item.basis.carbs,10.7);
 assert.match(item.source,/AI procjena.*nije neovisno provjeren/);assert.ok(!item.source.includes('Web provjerena'));
 assert.equal(JSON.stringify(food),before,'Stored food and historical entries must not be rewritten');
 const manual={...food,id:'manual-declaration'};api.set({foodId:manual.id,sourceType:'catalog',unit:'g',basisUnit:'g'});
 assert.equal((await api.analyze({foods:[manual]})).body.items[0].source,manual.source);
}));

test('new AI/OFF nutrient bases reject impossible values without rejecting historical diaries',async()=>fixture(async api=>{
 for(const basis of [{calories:42,protein:150,carbs:10.6,fat:0},{calories:42,protein:0,carbs:-1,fat:0},{calories:42,protein:60,carbs:60,fat:0},{calories:20,protein:0,carbs:0,fat:100}]){
  api.set({unit:'g',basisUnit:'g',basis});assert.equal((await api.analyze()).status,400);
 }
 const product={product_name:'Primjer',nutrition_data_per:'100g',nutriments:{'energy-kcal_100g':42,proteins_100g:150,carbohydrates_100g:10.6,fat_100g:0}};
 assert.throws(()=>offProduct(product),/nisu valjani/);
 assert.equal(offProduct({...product,nutriments:{'energy-kcal_100g':0,proteins_100g:0,carbohydrates_100g:0,fat_100g:0}}).calories,0);
 // Pure oil and alcoholic beverages are valid despite rounding/non-macro energy.
 api.set({name:'Ulje',unit:'g',basisUnit:'g',basis:{calories:884,protein:0,carbs:0,fat:100}});assert.equal((await api.analyze()).status,200);
 api.set({name:'Vino',basis:{calories:85,protein:0,carbs:2.6,fat:0}});assert.equal((await api.analyze()).status,200);
 // EU declarations count erythritol as carbohydrate with zero food energy.
 const erythritol={calories:0,protein:0,carbs:100,fat:0};
 api.set({name:'Eritritol',unit:'g',basisUnit:'g',basis:erythritol});assert.equal((await api.analyze()).status,200);
 assert.equal(offProduct({...product,product_name:'Eritritol',nutriments:{'energy-kcal_100g':0,proteins_100g:0,carbohydrates_100g:100,fat_100g:0}}).carbs,100);
 const old=initialState(false);const historical=makeItem(baseFoods[0],120,'lunch',date,false);historical.basis.protein=150;old.items=[historical];
 assert.equal(stateSchema.parse(old).items[0].basis.protein,150);
}));

test('chat validates edit units and quantities and only returns confirmation proposals',async()=>fixture(async api=>{
 const food=foodSchema.parse({id:'drink',name:'Sok',brand:'',aliases:['sok'],serving:250,unit:'ml',calories:42,protein:0,carbs:10.6,fat:0,fiber:0,source:'OFF',verified:false});
 const item=makeItem(food,330,'lunch',date,false),state=initialState(false);state.items=[item];api.authenticate(state);
 const before=JSON.stringify(state),proposal={reply:'Predlažem 500 ml. Potvrdi izmjenu.',action:'edit',itemId:item.id,grams:500,unit:'ml',foodText:null};
 api.setChat(proposal);const response=await api.chat();assert.equal(response.status,200);assert.equal(response.body.action,'edit');assert.equal(response.body.grams,500);assert.equal(response.body.unit,'ml');
 assert.equal(JSON.stringify(state),before);assert.ok(!api.requests.some(url=>/save_diary|delete/.test(url)));
 api.setChat({...proposal,unit:'g'});assert.equal((await api.chat()).status,400);
 api.setChat({...proposal,itemId:'invented'});assert.equal((await api.chat()).status,400);
 for(const grams of [0,-1,5001]){api.setChat({...proposal,grams});assert.equal((await api.chat()).status,400)}
}));
