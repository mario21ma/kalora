import test from 'node:test';
import assert from 'node:assert/strict';
import {baseFoods,parseLocal,sum,makeItem,nutrition,stateSchema,initialState,dayOffset,dateKey,suggestTargets,defaultProfile,resolveWaterGoalMl,suggestWaterGoalMl,profileSchema,searchAlias,foodBasisSchema,quantityUnit,targetSchema} from '../lib/domain.ts';
const date='2026-09-28';
test('long AI meal names can be saved and restored with their cached food',()=>{
 const name='Piletina sa sirom u tortilji s kiselim krastavcima, kukuruzom i tartar umakom';
 const food={id:'ai-tortilja',name,brand:'',aliases:[name.toLowerCase()],serving:350,calories:220,protein:39/3.5,carbs:18,fat:40/3.5,fiber:0,source:'AI procjena nutritivnih vrijednosti; nije provjereno',verified:false};
 const state=initialState(false);state.foods=[food];state.items=[makeItem(food,350,'lunch',date,false)];
 const saved=stateSchema.parse(state);const restored=stateSchema.parse(JSON.parse(JSON.stringify(saved)));
 assert.equal(restored.items[0].name,name);assert.equal(restored.foods[0].aliases[0],name.toLowerCase());assert.equal(sum(restored.items).calories,770);
 assert.equal(nutrition(makeItem(restored.foods[0],175,'dinner',date)).calories,385);assert.deepEqual(restored.waterEntries,[]);
});
test('full product search aliases fit legal names and brands but remain bounded',()=>{
 const state=initialState(false);const food={...baseFoods[0],name:'n'.repeat(150),brand:'b'.repeat(100),aliases:['b'.repeat(100)+' '+'n'.repeat(150)]};
 state.foods=[food];assert.equal(stateSchema.safeParse(state).success,true);
 food.aliases=['x'.repeat(501)];assert.equal(stateSchema.safeParse(state).success,false);
});
test('500-character names save across AI, web and manual sources without losing units or totals',()=>{
 const name=('Dugi naziv obroka sa sastojcima '.repeat(20)).slice(0,500);
 for(const source of ['AI procjena nutritivnih vrijednosti','Web provjerena deklaracija proizvoda','Deklaracija koju je unio korisnik']){
  const food={...baseFoods[0],name,aliases:[searchAlias(name)],brand:'Primjer',unit:'ml',source};
  const state=initialState(false);state.foods=[food];state.items=[makeItem(food,250,'lunch',date,false)];
  const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.foods[0].name,name);assert.equal(restored.items[0].name,name);assert.equal(restored.items[0].unit,'ml');assert.equal(nutrition(restored.items[0]).calories,222.5);
  food.name=name+'x';assert.equal(stateSchema.safeParse({...state,foods:[food]}).success,false);
  assert.equal(stateSchema.safeParse({...state,items:[{...state.items[0],name:name+'x'}]}).success,false);
 }
 assert.equal(searchAlias('한'.repeat(500)).length,500);
});
test('Croatian breakfast with half, spoon and whey',()=>{const r=parseLocal('1 banana, pola avokada, 100 g zobenih i 1 mjerica whey hydro izolata',baseFoods,'breakfast',date);assert.equal(r.items.length,4);assert.deepEqual(r.unknown,[]);assert.equal(r.items.find(i=>i.foodId==='avocado').grams,75);assert.equal(r.items.find(i=>i.foodId==='oats').grams,100);assert.equal(r.items.find(i=>i.foodId==='whey').grams,30)});
test('stuffed peppers, estimated portion, exact bread',()=>{const r=parseLocal('ručak: 3 srednje punjene paprike i oko 60 g bijelog kruha',baseFoods,'snack',date);assert.deepEqual(r.items.map(i=>i.grams),[660,60]);assert.ok(r.items.every(i=>i.meal==='lunch'));assert.ok(r.items.every(i=>i.isEstimate));assert.equal(Math.round(sum(r.items).calories),1018)});
test('unknown items are not fabricated or silently accepted',()=>{const r=parseLocal('banana i plutonijev sendvič',baseFoods,'snack',date);assert.equal(r.items.length,1);assert.deepEqual(r.unknown,['plutonijev sendvic'])});
test('decimal comma and kg conversion',()=>{const r=parseLocal('0,15 kg banane, 50 g pršuta',baseFoods,'snack',date);assert.deepEqual(r.items.map(i=>i.grams),[150,50])});
test('human bread slices and eggs scale correctly',()=>{const r=parseLocal('Pojeo sam 2 jaja, 2 fete kruha, 50 g pršuta i jednu bananu.',baseFoods,'breakfast',date);assert.deepEqual(r.items.map(i=>i.grams),[100,70,50,120]);assert.equal(Math.round(sum(r.items).calories),573)});
test('amount edits scale all nutrients without compounding rounding',()=>{const f=baseFoods.find(f=>f.id==='bread'),i=makeItem(f,60,'lunch',date);assert.equal(nutrition(i).calories,159.6);assert.equal(nutrition({...i,grams:100}).calories,266);assert.equal(nutrition({...i,grams:60}).calories,159.6)});
test('invalid states rejected before persistence',()=>{const s=initialState();assert.ok(stateSchema.safeParse(s).success);s.items[0].grams=-5;assert.equal(stateSchema.safeParse(s).success,false);s.items[0].grams=5001;assert.equal(stateSchema.safeParse(s).success,false)});
test('Zagreb date crosses midnight and DST correctly',()=>{assert.equal(dateKey(new Date('2026-09-28T22:30:00Z')),'2026-09-29');assert.equal(dayOffset('2026-03-29',-1),'2026-03-28');assert.equal(dayOffset('2026-10-25',1),'2026-10-26')});
test('goal formula returns bounded balanced proposal',()=>{const goal=suggestTargets(defaultProfile);assert.ok(goal.calories>=2500&&goal.calories<=3200);assert.ok(Math.abs(goal.protein*4+goal.carbs*4+goal.fat*9-goal.calories)<=4)});

test('legacy diaries keep an automatic water goal without losing data',()=>{const old=initialState();delete old.profile.waterGoalMl;const parsed=stateSchema.parse(old);assert.equal(parsed.items.length,old.items.length);assert.equal(resolveWaterGoalMl(parsed.profile,84.5),suggestWaterGoalMl(84.5))});
test('manual water goal survives export/import and overrides weight changes',()=>{const s=initialState();s.profile.waterGoalMl=3500;const restored=stateSchema.parse(JSON.parse(JSON.stringify(s)));assert.equal(restored.profile.waterGoalMl,3500);assert.equal(resolveWaterGoalMl(restored.profile,100),3500);restored.profile.waterGoalMl=null;assert.equal(resolveWaterGoalMl(restored.profile,100),suggestWaterGoalMl(100))});
test('water targets reject invalid persisted values and accept valid bounds',()=>{for(const waterGoalMl of [0,499,10001,NaN,Infinity,1250.5])assert.equal(profileSchema.safeParse({...defaultProfile,waterGoalMl}).success,false);for(const waterGoalMl of [null,500,3000,10000])assert.equal(profileSchema.safeParse({...defaultProfile,waterGoalMl}).success,true)});

test('old profiles default to water and silhouettes enabled',()=>{const s=initialState();delete s.profile.waterTrackingEnabled;delete s.profile.showSilhouettes;const restored=stateSchema.parse(s);assert.equal(restored.profile.waterTrackingEnabled,true);assert.equal(restored.profile.showSilhouettes,true)});
test('display toggles round-trip independently without removing water or goals',()=>{for(const waterTrackingEnabled of [true,false])for(const showSilhouettes of [true,false]){const s=initialState();s.profile.waterTrackingEnabled=waterTrackingEnabled;s.profile.showSilhouettes=showSilhouettes;s.profile.waterGoalMl=3500;s.water[date]=1250;s.waterEntries=[{id:'toggle-water',date,amountMl:1250,loggedAt:'2026-09-28T10:00:00.000Z'}];const restored=stateSchema.parse(JSON.parse(JSON.stringify(s)));assert.equal(restored.profile.waterTrackingEnabled,waterTrackingEnabled);assert.equal(restored.profile.showSilhouettes,showSilhouettes);assert.equal(restored.water[date],1250);assert.equal(restored.profile.waterGoalMl,3500)}});


test('explicit volume cannot silently reuse a gram food basis',()=>{
 for(const text of ['250 ml maslinovog ulja','1 l banana','1 dl avokada']){
  const result=parseLocal(text,baseFoods,'snack',date);
  assert.deepEqual(result.items,[],text);assert.equal(result.unknown.length,1,text);
 }
 const grams=parseLocal('250 g maslinovog ulja',baseFoods,'snack',date);
 assert.equal(grams.items[0].grams,250);assert.equal(quantityUnit(grams.items[0]),'g');
});

test('new milk entries preserve millilitres and volume conversions',()=>{
 for(const [text,amount] of [['250 ml mlijeka',250],['2.5 dl mlijeka',250],['0,25 l mlijeka',250],['25 cl mlijeka',250],['0,25 litre mlijeka',250]]){
  const result=parseLocal(text,baseFoods,'breakfast',date);
  assert.deepEqual(result.unknown,[],text);assert.equal(result.items[0].grams,amount,text);assert.equal(result.items[0].unit,'ml',text);assert.equal(nutrition(result.items[0]).calories,145,text);
 }
 const incompatible=parseLocal('250 g mlijeka',baseFoods,'breakfast',date);
 assert.deepEqual(incompatible.items,[]);assert.equal(incompatible.unknown.length,1);
});

test('saved implicit gram milk and its history are never relabelled by the new catalog',()=>{
 const legacyMilk={...baseFoods.find(food=>food.id==='milk')};delete legacyMilk.unit;
 const state=initialState(false);state.foods=[legacyMilk];state.items=[makeItem(legacyMilk,250,'breakfast',date)];
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.foods[0].unit,undefined);assert.equal(restored.items[0].unit,undefined);
 assert.equal(quantityUnit(restored.items[0]),'g');assert.deepEqual(restored.items[0].basis,state.items[0].basis);assert.equal(nutrition(restored.items[0]).calories,145);
 const parsed=parseLocal('250 ml mlijeka',restored.foods,'breakfast',date);assert.deepEqual(parsed.items,[]);assert.equal(parsed.unknown.length,1);
});

test('ASCII and Unicode fractions produce the intended portion rather than the numerator',()=>{
 for(const text of ['1/2 avokada','1 / 2 avokada','½ avokada','pola avokada']){
  const result=parseLocal(text,baseFoods,'snack',date);assert.deepEqual(result.unknown,[],text);
  assert.equal(result.items[0].grams,75,text);assert.equal(nutrition(result.items[0]).calories,120,text);
 }
 for(const [text,grams] of [['1 1/2 avokada',225],['1½ avokada',225],['¼ avokada',37.5],['3/4 avokada',112.5],['1/2 kg banana',500],['pola žlice ulja',7.5],['½ žličice ulja',2.5]]){
  const result=parseLocal(text,baseFoods,'snack',date);assert.deepEqual(result.unknown,[],text);assert.equal(result.items[0].grams,grams,text);
 }
});

test('Croatian count words use the same quantities as digits',()=>{
 for(const [word,count] of [['jedno',1],['dvije',2],['tri',3],['četiri',4],['pet',5],['šest',6],['sedam',7],['osam',8],['devet',9],['deset',10],['jedanaest',11],['dvadeset dva',22],['dvadeset i dva',22]]){
  const result=parseLocal(word+' jaja',baseFoods,'breakfast',date);assert.deepEqual(result.unknown,[],word);
  assert.equal(result.items[0].grams,50*count,word);assert.equal(nutrition(result.items[0]).calories,77.5*count,word);
 }
 const half=parseLocal('jedna i pol banana',baseFoods,'breakfast',date);assert.deepEqual(half.unknown,[]);assert.equal(half.items[0].grams,180);
});

test('malformed and unresolved explicit quantities require clarification instead of one portion',()=>{
 for(const text of ['1/0 avokada','1/2/3 avokada','-1 banana','2-3 jaja','2 3 jaja','nekoliko jaja','par banana','tridesetak jaja','četiristo jaja','nula banana']){
  const result=parseLocal(text,baseFoods,'snack',date);assert.deepEqual(result.items,[],text);assert.equal(result.unknown.length,1,text);
 }
});

test('new food validation rejects impossible macros and energy while legacy snapshots remain readable',()=>{
 for(const basis of [
  {calories:42,protein:150,carbs:0,fat:0},
  {calories:42,protein:100,carbs:0,fat:0},
  {calories:500,protein:50,carbs:50,fat:50},
  {calories:1001,protein:0,carbs:0,fat:0},
  {calories:50,protein:-1,carbs:0,fat:0},
  {calories:50,protein:0,carbs:0,fat:0,fiber:101}
 ])assert.equal(foodBasisSchema.safeParse(basis).success,false,JSON.stringify(basis));
 const legacyFood={...baseFoods[0],calories:42,protein:150,carbs:0,fat:0};
 const state=initialState(false);state.foods=[legacyFood];state.items=[makeItem(legacyFood,100,'snack',date)];
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)));assert.equal(restored.foods[0].protein,150);assert.equal(restored.items[0].basis.protein,150);
});

test('new food validation permits fibre, alcohol, rounded labels and dense volume declarations',()=>{
 for(const basis of [
  {calories:228,protein:19.6,carbs:57.9,fat:13.7,fiber:37},
  {calories:90,protein:0,carbs:3,fat:0},
  {calories:884,protein:0,carbs:0,fat:100},
  {calories:0,protein:0,carbs:.2,fat:0},
  {unit:'ml',calories:560,protein:0,carbs:140,fat:0}
 ])assert.equal(foodBasisSchema.safeParse(basis).success,true,JSON.stringify(basis));
 assert.equal(foodBasisSchema.safeParse({unit:'g',calories:560,protein:0,carbs:140,fat:0}).success,false);
 assert.equal(foodBasisSchema.safeParse({unit:'ml',calories:700,protein:0,carbs:156,fat:0}).success,false);
});

test('suggested targets remain valid and balanced for all allowed profile boundary combinations',()=>{
 for(const sex of ['male','female'])for(const age of [18,100])for(const height of [100,230])for(const weight of [35,250,251,300])for(const activity of [1.2,1.9])for(const goal of ['mild','moderate','maintain','gain']){
  const profile=profileSchema.parse({...defaultProfile,sex,age,height,weight,activity,goal});
  const targets=suggestTargets(profile);assert.equal(targetSchema.safeParse(targets).success,true,JSON.stringify(profile));
  assert.equal(profileSchema.safeParse({...profile,targets}).success,true);assert.ok(Math.abs(targets.protein*4+targets.carbs*4+targets.fat*9-targets.calories)<=4);
 }
 const previousFailure=suggestTargets({...defaultProfile,weight:300,height:230,age:18,activity:1.9,goal:'gain'});
 assert.equal(previousFailure.calories,8000);assert.equal(previousFailure.protein,500);
});

test('verified source links survive food and item persistence without permitting unsafe URLs',()=>{
 const food={...baseFoods[0],sourceUrls:['https://example.com/declaration']};
 const state=initialState(false);state.foods=[food];state.items=[makeItem(food,100,'snack',date)];
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.foods[0].sourceUrls,food.sourceUrls);assert.deepEqual(restored.items[0].sourceUrls,food.sourceUrls);
 food.sourceUrls=['javascript:alert(1)'];assert.equal(stateSchema.safeParse({...state,foods:[food]}).success,false);
});
