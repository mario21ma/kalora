import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,initialState,stateSchema,makeItem,baseFoods,dateKey,makeWaterEntry} from '../lib/domain.ts';
import {AppearanceConflictError,appearanceFromProfile,applyAppearanceChange,createAppearanceDraft,reconcileAppearanceDraft,editAppearanceDraft,resolveAppearanceDraft,hasAppearanceChanges} from '../lib/appearance.ts';

const profile=(changes={})=>({...defaultProfile,targets:{...defaultProfile.targets},...changes});

test('old diary JSON gains the classic default while retaining every existing entry and setting',()=>{
 const state=initialState(false);state.profile=profile({accentTheme:'green',showSilhouettes:false,waterTrackingEnabled:false,waterGoalMl:2750});
 state.items=[makeItem(baseFoods[0],125,'breakfast',dateKey(),false)];state.waterEntries=[makeWaterEntry(250,dateKey())];
 const legacy=JSON.parse(JSON.stringify(state));delete legacy.profile.layout;
 const migrated=stateSchema.parse(legacy);
 assert.equal(migrated.profile.layout,'classic');
 assert.deepEqual(migrated.profile,{...legacy.profile,layout:'classic'});
 assert.deepEqual(migrated.items,state.items);assert.deepEqual(migrated.waterEntries,state.waterEntries);assert.equal(migrated.water[dateKey()],250);
 assert.deepEqual(migrated.foods,state.foods);assert.deepEqual(migrated.weights,state.weights);assert.deepEqual(migrated.favorites,state.favorites);
});

test('compact appearance survives the same JSON export/import and persistence schema as the diary',()=>{
 const state=stateSchema.parse({...initialState(false),profile:profile({layout:'compact',accentTheme:'white',showSilhouettes:false,waterTrackingEnabled:false}),waterEntries:[makeWaterEntry(400,dateKey())]});
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored,state);assert.equal(restored.waterEntries[0].amountMl,400);assert.equal(restored.profile.layout,'compact');
 assert.equal(stateSchema.safeParse({...state,profile:{...state.profile,layout:'unknown'}}).success,false);
});

test('applying an appearance edit changes only its edited fields and preserves the latest personal profile',()=>{
 const original=profile(),baseline=appearanceFromProfile(original);
 const current=profile({name:'Imported latest',weight:95,waterGoalMl:3500,accentTheme:'green',waterTrackingEnabled:false,targets:{calories:2700,protein:180,carbs:300,fat:80}});
 const result=applyAppearanceChange(current,{...baseline,layout:'compact'},baseline);
 assert.deepEqual(result,{...current,layout:'compact'});
 assert.equal(current.layout,'classic');assert.equal(original.weight,75);
});

test('a stale appearance save rejects a different concurrent change to the same field',()=>{
 const baseline=appearanceFromProfile(profile()),current=profile({accentTheme:'red'});
 assert.throws(()=>applyAppearanceChange(current,{...baseline,accentTheme:'green'},baseline),AppearanceConflictError);
 assert.equal(current.accentTheme,'red');
 assert.deepEqual(applyAppearanceChange(current,{...baseline,accentTheme:'red'},baseline),current);
});

test('invalid appearance values are rejected before any current profile field can change',()=>{
 const current=profile(),baseline=appearanceFromProfile(current);
 for(const invalid of [{layout:'unsupported'},{accentTheme:'purple'},{waterTrackingEnabled:'false'},{showSilhouettes:null}]){
  assert.throws(()=>applyAppearanceChange(current,{...baseline,...invalid},baseline));
 }
 assert.deepEqual(current,profile());
});

test('a clean appearance draft follows an imported or synchronized profile',()=>{
 const state=createAppearanceDraft(profile()),incoming=profile({layout:'compact',accentTheme:'yellow',showSilhouettes:false,waterTrackingEnabled:false});
 const result=reconcileAppearanceDraft(state,incoming);
 assert.deepEqual(result.draft,appearanceFromProfile(incoming));assert.deepEqual(result.conflicts,[]);assert.equal(hasAppearanceChanges(result),false);
 assert.equal(reconcileAppearanceDraft(result,profile({...incoming,name:'Personal change'})),result);
});

test('an unsaved layout choice survives disjoint imported appearance fields',()=>{
 let state=editAppearanceDraft(createAppearanceDraft(profile()),{layout:'compact'});
 state=reconcileAppearanceDraft(state,profile({accentTheme:'green',waterTrackingEnabled:false}));
 assert.equal(state.draft.layout,'compact');assert.equal(state.draft.accentTheme,'green');assert.equal(state.draft.waterTrackingEnabled,false);
 assert.deepEqual(state.conflicts,[]);assert.equal(hasAppearanceChanges(state),true);
 const result=applyAppearanceChange(profile({accentTheme:'green',waterTrackingEnabled:false,weight:95}),state.draft,state.source);
 assert.equal(result.layout,'compact');assert.equal(result.accentTheme,'green');assert.equal(result.waterTrackingEnabled,false);assert.equal(result.weight,95);
});

test('overlapping appearance changes keep local choices until an explicit resolution',()=>{
 const dirty=editAppearanceDraft(createAppearanceDraft(profile()),{accentTheme:'green',layout:'compact'});
 let state=reconcileAppearanceDraft(dirty,profile({accentTheme:'yellow'}));
 assert.deepEqual(state.conflicts,['accentTheme']);assert.equal(state.draft.accentTheme,'green');assert.equal(state.draft.layout,'compact');
 state=reconcileAppearanceDraft(state,profile({accentTheme:'yellow',showSilhouettes:false}));
 assert.deepEqual(state.conflicts,['accentTheme']);assert.equal(state.draft.showSilhouettes,false);
 const kept=resolveAppearanceDraft(state,'draft');assert.deepEqual(kept.conflicts,[]);assert.equal(kept.draft.accentTheme,'green');
 const adopted=resolveAppearanceDraft(state,'incoming');assert.deepEqual(adopted.conflicts,[]);assert.equal(adopted.draft.accentTheme,'yellow');assert.equal(adopted.draft.layout,'compact');
 assert.equal(applyAppearanceChange(profile({accentTheme:'yellow',showSilhouettes:false}),kept.draft,kept.source).accentTheme,'green');
});

test('choosing the incoming value resolves only its matching appearance conflict',()=>{
 const dirty=editAppearanceDraft(createAppearanceDraft(profile()),{accentTheme:'green',layout:'compact'});
 const conflicted=reconcileAppearanceDraft(dirty,profile({accentTheme:'red'}));
 const resolved=editAppearanceDraft(conflicted,{accentTheme:'red'});
 assert.deepEqual(resolved.conflicts,[]);assert.equal(resolved.draft.layout,'compact');
});

test('saving one appearance draft acknowledges its echo and a later conflicting color asks again',()=>{
 let state=editAppearanceDraft(createAppearanceDraft(profile()),{layout:'compact',accentTheme:'green'});
 state=reconcileAppearanceDraft(state,profile({layout:'compact',accentTheme:'green'}));
 assert.equal(hasAppearanceChanges(state),false);assert.deepEqual(state.conflicts,[]);
 state=editAppearanceDraft(state,{accentTheme:'yellow'});
 state=resolveAppearanceDraft(reconcileAppearanceDraft(state,profile({layout:'compact',accentTheme:'red'})),'draft');
 state=reconcileAppearanceDraft(state,profile({layout:'compact',accentTheme:'white'}));
 assert.deepEqual(state.conflicts,['accentTheme']);assert.equal(state.draft.accentTheme,'yellow');
});
