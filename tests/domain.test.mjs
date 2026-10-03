import test from 'node:test';
import assert from 'node:assert/strict';
import {baseFoods,parseLocal,sum,makeItem,nutrition,stateSchema,initialState,dayOffset,dateKey,suggestTargets,defaultProfile,resolveWaterGoalMl,suggestWaterGoalMl,profileSchema,searchAlias} from '../lib/domain.ts';
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
