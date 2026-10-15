import test from 'node:test';
import assert from 'node:assert/strict';
import {undoStateChange} from '../lib/undo.ts';
import {initialState,baseFoods,makeItem,stateSchema,withWaterEntries} from '../lib/domain.ts';
const date='2026-10-14';
const item=(id,food='banana')=>({...makeItem(baseFoods.find(f=>f.id===food),120,'breakfast',date),id});
const clone=s=>structuredClone(s);
const state=()=>{const s=initialState(false);s.items=[item('banana')];return s};
const check=s=>assert.equal(stateSchema.safeParse(s).success,true);

test('food delete Undo restores banana while retaining subsequently added bread',()=>{
 const before=state(),after={...before,items:[]},bread=item('bread','bread'),current={...after,items:[bread]};
 const result=undoStateChange(current,before,after);
 assert.deepEqual(result.items,[bread,before.items[0]]);check(result);
});
test('deleted rows return to their original neighbours without rearranging later rows',()=>{
 const before=state();before.items.push(item('original-bread','bread'));const after={...before,items:[before.items[1]]},later=item('later');
 assert.deepEqual(undoStateChange({...after,items:[...after.items,later]},before,after).items,[...before.items,later]);
 assert.deepEqual(undoStateChange(after,before,after).items,before.items);
});
test('food edit Undo preserves later addition and independent meal edit',()=>{
 const before=state(),after={...before,items:[{...before.items[0],grams:240}]},bread=item('bread','bread'),current={...after,items:[{...after.items[0],meal:'dinner'},bread]};
 const result=undoStateChange(current,before,after);
 assert.equal(result.items[0].grams,120);assert.equal(result.items[0].meal,'dinner');assert.deepEqual(result.items[1],bread);check(result);
});
test('Undo does not replace newer edits or resurrect a subsequently deleted edited item',()=>{
 const before=state(),after={...before,items:[{...before.items[0],grams:240}]};
 assert.equal(undoStateChange({...after,items:[{...after.items[0],grams:360}]},before,after).items[0].grams,360);
 assert.deepEqual(undoStateChange({...after,items:[]},before,after).items,[]);
});
test('Undo an estimated-to-explicit quantity edit preserves a newer explicit quantity',()=>{
 const before=state(),after={...before,items:[{...before.items[0],grams:240,isEstimate:false}]},current={...after,items:[{...after.items[0],grams:360}]};
 const result=undoStateChange(current,before,after);
 assert.equal(result.items[0].grams,360);assert.equal(result.items[0].isEstimate,false);check(result);
 assert.equal(undoStateChange(after,before,after).items[0].grams,120);assert.equal(undoStateChange(after,before,after).items[0].isEstimate,true);
});
test('Undo a quantity edit preserves a later estimate metadata edit',()=>{
 const before=state(),after={...before,items:[{...before.items[0],grams:240,isEstimate:false}]},current={...after,items:[{...after.items[0],isEstimate:true,meal:'dinner'}]};
 const result=undoStateChange(current,before,after);
 assert.deepEqual(result.items,current.items);check(result);
});
test('Undo an estimate-only edit remains independent of a later quantity edit',()=>{
 const before=state(),after={...before,items:[{...before.items[0],isEstimate:false}]},current={...after,items:[{...after.items[0],grams:360}]};
 const result=undoStateChange(current,before,after);
 assert.equal(result.items[0].grams,360);assert.equal(result.items[0].isEstimate,true);check(result);
});
test('Undo addition removes its unchanged item but keeps modified and later added items',()=>{
 const before=initialState(false),added=item('added'),bread=item('later','bread'),after={...before,items:[added]};
 assert.deepEqual(undoStateChange({...after,items:[added,bread]},before,after).items,[bread]);
 assert.deepEqual(undoStateChange({...after,items:[{...added,grams:500},bread]},before,after).items,[{...added,grams:500},bread]);
});
test('deleted ID reused later is preserved rather than replaced by old row',()=>{
 const before=state(),after={...before,items:[]},replacement={...before.items[0],grams:500};
 assert.deepEqual(undoStateChange({...after,items:[replacement]},before,after).items,[replacement]);
});
test('favorite deletion Undo preserves subsequently saved favorite',()=>{
 const before=state();before.favorites=[{id:'old',name:'Doručak',items:before.items}];const after={...before,favorites:[]},later={id:'new',name:'Ručak',items:[item('lunch')]};
 assert.deepEqual(undoStateChange({...after,favorites:[later]},before,after).favorites,[later,before.favorites[0]]);
});
test('weight deletion Undo preserves later date and newer same-date replacement',()=>{
 const before=state();before.weights=[{date,kg:75}];const after={...before,weights:[]},later={date:'2026-10-15',kg:74};
 assert.deepEqual(undoStateChange({...after,weights:[later]},before,after).weights,[later,before.weights[0]]);
 assert.deepEqual(undoStateChange({...after,weights:[{date,kg:72},later]},before,after).weights,[{date,kg:72},later]);
});
test('whole-diary import Undo preserves later food, catalog, favorite, weight, target, profile and chat changes',()=>{
 const before=state();before.messages=[{role:'assistant',content:'Ranija poruka'}];before.profile={...before.profile,name:'Prije'};
 const after=initialState(false);after.items=[item('imported')];after.foods=[{...baseFoods[0],id:'imported-food'}];after.profile={...after.profile,name:'Uvezeno'};after.messages=[{role:'assistant',content:'Uvezena poruka'}];
 const current=clone(after),later=item('later','bread');current.items.push(later);current.foods.push({...baseFoods[1],id:'later-food'});current.favorites.push({id:'later-favorite',name:'Kasnije',items:[later]});current.weights.push({date,kg:74});current.targets[date]={...current.profile.targets,calories:2300};current.profile.weight=74;current.messages.push({role:'user',content:'Kasnija poruka'});
 const result=undoStateChange(current,before,after);
 assert.deepEqual(result.items,[later,before.items[0]]);assert.deepEqual(result.foods,[current.foods[1]]);assert.deepEqual(result.favorites,current.favorites);assert.deepEqual(result.weights,current.weights);assert.deepEqual(result.targets,current.targets);assert.equal(result.profile.name,'Prije');assert.equal(result.profile.weight,74);assert.deepEqual(result.messages,[...before.messages,current.messages[1]]);check(result);
});
test('onboarding Undo preserves later water entries and derives totals from retained entries',()=>{
 const before=state(),oldWater={id:'old',date,amountMl:250,loggedAt:'2026-10-14T09:00:00.000Z'};Object.assign(before,withWaterEntries(before,[oldWater]));
 const after={...initialState(false),onboarded:true},later={id:'new',date,amountMl:500,loggedAt:'2026-10-14T10:00:00.000Z'},current=withWaterEntries(after,[later]);
 const result=undoStateChange(current,before,after);assert.deepEqual(result.waterEntries,[later,oldWater]);assert.equal(result.water[date],750);assert.equal(result.onboarded,false);check(result);
});
test('water Undo keeps later independent water and does not restore a stale total',()=>{
 const before=state(),added={id:'added',date,amountMl:250,loggedAt:'2026-10-14T09:00:00.000Z'},later={id:'later',date,amountMl:500,loggedAt:'2026-10-14T10:00:00.000Z'},after=withWaterEntries(before,[added]),current=withWaterEntries(after,[added,later]);
 const result=undoStateChange(current,before,after);assert.deepEqual(result.waterEntries,[later]);assert.equal(result.water[date],500);check(result);
});
test('Undo profile and targets preserves later changed values and independent target dates',()=>{
 const before=state(),after=clone(before);after.profile.name='Uređeno';after.profile.targets.calories=2300;after.targets[date]={...after.profile.targets};
 const current=clone(after);current.profile.name='Kasnije';current.profile.targets.protein=160;current.targets[date].protein=170;current.targets['2026-10-15']={...current.profile.targets};
 const result=undoStateChange(current,before,after);assert.equal(result.profile.name,'Kasnije');assert.equal(result.profile.targets.calories,before.profile.targets.calories);assert.equal(result.profile.targets.protein,160);assert.deepEqual(result.targets,current.targets);check(result);
});
test('chat without stable IDs leaves changed prefixes intact and retains latest messages at limit',()=>{
 const before=state();before.messages=Array.from({length:200},(_,i)=>({role:'assistant',content:'before '+i}));const after={...before,messages:[{role:'assistant',content:'imported'}]},current={...after,messages:[{role:'assistant',content:'changed'},{role:'user',content:'later'}]};
 assert.deepEqual(undoStateChange(current,before,after).messages,current.messages);
 const appended=undoStateChange({...after,messages:[...after.messages,{role:'user',content:'later'}]},before,after);assert.equal(appended.messages.length,200);assert.deepEqual(appended.messages.at(-1),{role:'user',content:'later'});check(appended);
});
test('ambiguous duplicate entity IDs reject Undo instead of dropping user records',()=>{
 const before=state(),after={...before,items:[]};assert.throws(()=>undoStateChange({...before,items:[...before.items,...before.items]},before,after),/različite oznake/);
});
test('food Undo keeps pre-existing duplicates in unrelated collections without trimming data',()=>{
 const before=state(),food={...baseFoods[0],id:'duplicate-food'},favorite={id:'duplicate-favorite',name:'Doručak',items:before.items},weight={date,kg:75},waterEntry={id:'duplicate-water',date,amountMl:250,loggedAt:'2026-10-14T09:00:00.000Z'};
 before.foods=[food,clone(food)];before.favorites=[favorite,clone(favorite)];before.weights=[weight,clone(weight)];before.waterEntries=[waterEntry,clone(waterEntry)];before.water={[date]:500};
 const after={...before,items:[]},current={...clone(after),items:[item('later','bread')]},original=clone(current),result=undoStateChange(current,before,after);
 assert.deepEqual(result.items,[...current.items,...before.items]);
 for(const field of ['foods','favorites','weights','waterEntries'])assert.deepEqual(result[field],current[field]);
 assert.deepEqual(result.water,current.water);assert.deepEqual(current,original);
});
test('profile Undo keeps duplicate items in an untouched diary collection',()=>{
 const before=state();before.items.push(clone(before.items[0]));const after=clone(before);after.profile={...after.profile,name:'Uređeno'};
 const result=undoStateChange(after,before,after);assert.deepEqual(result.items,before.items);assert.equal(result.profile.name,before.profile.name);check(result);
});
for(const [field,duplicate] of [
 ['foods',{...baseFoods[0],id:'duplicate-food'}],
 ['favorites',{id:'duplicate-favorite',name:'Doručak',items:[item('favorite-item')]}],
 ['weights',{date,kg:75}],
 ['waterEntries',{id:'duplicate-water',date,amountMl:250,loggedAt:'2026-10-14T09:00:00.000Z'}],
]){
 test(`Undo still rejects duplicate keys when ${field} is touched`,()=>{
  const before=state();before[field]=[duplicate,clone(duplicate)];const after={...before,[field]:[]},original=clone(before);
  assert.throws(()=>undoStateChange(before,before,after),/različite oznake/);assert.deepEqual(before,original);
 });
}
test('Undo is immutable and restores original state when no subsequent changes exist',()=>{
 const before=state(),after=clone(before);after.items[0].grams=240;after.profile.name='Uređeno';const original=clone(after);
 assert.deepEqual(undoStateChange(after,before,after),before);assert.deepEqual(after,original);
});
test('repeating Undo is idempotent for deleted rows, field edits, and cleared imported chat',()=>{
 const before=state();before.messages=[{role:'assistant',content:'Ranija poruka'}];before.weights=[{date,kg:75}];
 const after=clone(before);after.items=[];after.weights=[];after.profile.name='Uređeno';after.messages=[];
 const current=clone(after);current.items=[item('later','bread')];current.messages=[{role:'user',content:'Kasnije'}];current.weights=[{date:'2026-10-15',kg:74}];
 const once=undoStateChange(current,before,after);assert.deepEqual(undoStateChange(once,before,after),once);check(once);
});
test('Undo never trims food or water entries to fit validation limits',()=>{
 const before=state(),old={id:'old',date,amountMl:15000,loggedAt:'2026-10-14T09:00:00.000Z'};Object.assign(before,withWaterEntries(before,[old]));const after=withWaterEntries(before,[]),later={id:'later',date,amountMl:10000,loggedAt:'2026-10-14T10:00:00.000Z'},current=withWaterEntries(after,[later]);
 const result=undoStateChange(current,before,after);assert.deepEqual(result.waterEntries,[later,old]);assert.equal(result.water[date],25000);assert.equal(stateSchema.safeParse(result).success,false);assert.deepEqual(current.waterEntries,[later]);
});
