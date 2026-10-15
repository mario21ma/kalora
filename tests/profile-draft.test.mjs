import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile} from '../lib/domain.ts';
import {createProfileDraft,reconcileProfileDraft,editProfileDraft,resolveProfileDraft,profileDraftForSave,markProfileSubmitted} from '../lib/profile-draft.ts';

const profile=(changes={})=>({...defaultProfile,targets:{...defaultProfile.targets},...changes});
const edit=(state,changes)=>editProfileDraft(state,p=>({...p,...changes}));
const saved=state=>{const result=profileDraftForSave(state);assert.equal(result.success,true);return result.profile};

test('a clean mounted draft adopts a replacement profile instead of saving its initial values',()=>{
 const original=profile({name:'Original'}),incoming=profile({name:'Imported',weight:95,targets:{calories:2700,protein:170,carbs:300,fat:80}});
 const state=reconcileProfileDraft(createProfileDraft(original),incoming);
 assert.equal(state.draft.name,'Imported');assert.equal(state.draft.weight,'95');assert.equal(state.draft.targets.calories,'2700');
 assert.deepEqual(saved(state),{...incoming,waterGoalMl:null});
});

test('disjoint user edits and incoming fields merge independently, including individual targets',()=>{
 let state=edit(createProfileDraft(profile()),{name:'My unsaved name',targets:{calories:'2400',protein:'150',carbs:'250',fat:'70'}});
 state=reconcileProfileDraft(state,profile({weight:95,accentTheme:'green',targets:{calories:2200,protein:180,carbs:300,fat:80}}));
 assert.equal(state.draft.name,'My unsaved name');assert.equal(state.draft.weight,'95');assert.equal(state.draft.targets.calories,'2400');assert.equal(state.draft.targets.protein,'180');
 assert.deepEqual(state.conflicts,[]);
 const result=saved(state);assert.equal(result.name,'My unsaved name');assert.equal(result.targets.calories,2400);assert.equal(result.targets.protein,180);assert.equal(result.accentTheme,'green');
});

test('overlapping replacement preserves the draft and blocks Save until explicitly resolved',()=>{
 const incoming=profile({weight:95,targets:{...defaultProfile.targets,calories:2700}});
 const dirty=edit(createProfileDraft(profile()),{weight:'80',name:'Keep my name'});
 let state=reconcileProfileDraft(dirty,incoming);
 assert.equal(state.draft.weight,'80');assert.deepEqual(state.conflicts,['weight']);assert.deepEqual(profileDraftForSave(state),{success:false,reason:'conflict'});
 state=reconcileProfileDraft(state,{...incoming,targets:{...incoming.targets},accentTheme:'red'});
 assert.deepEqual(state.conflicts,['weight']);assert.equal(state.draft.weight,'80');
 const keep=resolveProfileDraft(state,'draft');assert.equal(saved(keep).weight,80);assert.equal(saved(keep).targets.calories,2700);
 const adopt=resolveProfileDraft(state,'incoming');assert.equal(saved(adopt).weight,95);assert.equal(saved(adopt).name,'Keep my name');
});

test('a later overlapping update needs another decision after keeping local values',()=>{
 let state=edit(createProfileDraft(profile()),{weight:'80'});
 state=resolveProfileDraft(reconcileProfileDraft(state,profile({weight:95})),'draft');
 assert.equal(saved(state).weight,80);
 state=reconcileProfileDraft(state,profile({weight:100}));
 assert.deepEqual(state.conflicts,['weight']);assert.equal(state.draft.weight,'80');
});

test('editing a conflict to the incoming value resolves that field without losing another draft',()=>{
 let state=edit(createProfileDraft(profile()),{weight:'80',name:'Draft name'});
 state=reconcileProfileDraft(state,profile({weight:95}));
 state=edit(state,{weight:'95.0'});
 assert.deepEqual(state.conflicts,[]);assert.equal(saved(state).weight,95);assert.equal(saved(state).name,'Draft name');
});

test('import while typing preserves blank and unfinished numeric input and cannot save stale values',()=>{
 for(const typed of ['', '8.', '9e']){
  const dirty=edit(createProfileDraft(profile()),{weight:typed,name:'Typing'});
  const state=reconcileProfileDraft(dirty,profile({weight:95}));
  assert.equal(state.draft.weight,typed);assert.equal(state.draft.name,'Typing');assert.deepEqual(state.conflicts,['weight']);assert.equal(profileDraftForSave(state).success,false);
 }
});

test('object clones and immediate theme saves keep the same unfinished user draft',()=>{
 const original=profile();let state=edit(createProfileDraft(original),{weight:'8.',name:'Typing'});
 assert.equal(reconcileProfileDraft(state,profile()),state);
 state=reconcileProfileDraft(state,profile({accentTheme:'yellow'}));
 assert.equal(state.draft.weight,'8.');assert.equal(state.draft.name,'Typing');assert.deepEqual(state.conflicts,[]);
});

test('numeric convergence preserves typed formatting while clearing a matching incoming change',()=>{
 const state=reconcileProfileDraft(edit(createProfileDraft(profile()),{weight:'95.0'}),profile({weight:95}));
 assert.equal(state.draft.weight,'95.0');assert.deepEqual(state.conflicts,[]);assert.equal(saved(state).weight,95);
});

test('completed formatting-only edits do not conflict with changed saved values',()=>{
 const weight=reconcileProfileDraft(edit(createProfileDraft(profile()),{weight:'75.0'}),profile({weight:95}));
 assert.deepEqual(weight.conflicts,[]);assert.equal(weight.draft.weight,'95');assert.equal(saved(weight).weight,95);
 const water=reconcileProfileDraft(edit(createProfileDraft(profile({waterGoalMl:2500})),{waterLiters:'2,50'}),profile({waterGoalMl:3000}));
 assert.deepEqual(water.conflicts,[]);assert.equal(water.draft.waterLiters,'3');assert.equal(saved(water).waterGoalMl,3000);
});

test('manual water edits conflict with a replacement mode instead of being silently discarded',()=>{
 let state=edit(createProfileDraft(profile({waterGoalMl:2500})),{waterLiters:'3,25',name:'Draft name'});
 state=reconcileProfileDraft(state,profile({waterGoalMl:null}));
 assert.equal(state.draft.waterMode,'manual');assert.equal(state.draft.waterLiters,'3,25');assert.deepEqual(state.conflicts,['waterGoal']);
 assert.equal(profileDraftForSave(state).success,false);
 assert.equal(saved(resolveProfileDraft(state,'draft')).waterGoalMl,3250);
 const adopted=resolveProfileDraft(state,'incoming');assert.equal(saved(adopted).waterGoalMl,null);assert.equal(saved(adopted).name,'Draft name');
});

test('automatic water suggestions follow a clean imported weight without conflicting with a local manual goal',()=>{
 const original=profile();const incoming=profile({weight:95});
 const clean=reconcileProfileDraft(createProfileDraft(original),incoming);
 assert.notEqual(clean.draft.waterLiters,createProfileDraft(original).draft.waterLiters);assert.deepEqual(clean.conflicts,[]);
 const dirty=edit(createProfileDraft(original),{waterMode:'manual',waterLiters:'3'});
 const merged=reconcileProfileDraft(dirty,incoming);assert.deepEqual(merged.conflicts,[]);assert.equal(saved(merged).waterGoalMl,3000);assert.equal(saved(merged).weight,95);
});

test('water tracking changes cannot hide and discard an unsaved water goal',()=>{
 const original=profile({waterGoalMl:2500});
 const state=reconcileProfileDraft(edit(createProfileDraft(original),{waterLiters:'3'}),profile({waterGoalMl:2500,waterTrackingEnabled:false}));
 assert.equal(state.draft.waterTrackingEnabled,true);assert.equal(state.draft.waterLiters,'3');assert.deepEqual(state.conflicts,['waterGoal']);
 const incoming=resolveProfileDraft(state,'incoming');assert.equal(saved(incoming).waterTrackingEnabled,false);assert.equal(saved(incoming).waterGoalMl,2500);
});

test('disabled water tracking preserves the latest saved goal and unrelated local edits',()=>{
 const state=reconcileProfileDraft(edit(createProfileDraft(profile({waterTrackingEnabled:false,waterGoalMl:2500})),{name:'Draft'}),profile({waterTrackingEnabled:false,waterGoalMl:3500}));
 assert.deepEqual(state.conflicts,[]);assert.equal(saved(state).waterGoalMl,3500);assert.equal(saved(state).name,'Draft');
});

test('onboarding starts blank and retains typed steps during object clones and theme changes',()=>{
 const original=profile();let state=createProfileDraft(original,true);
 for(const field of ['name','sex','age','height','weight','goalWeight','activity','training','goal'])assert.equal(state.draft[field],'');
 state=edit(state,{name:'New user',height:'180'});
 assert.equal(reconcileProfileDraft(state,profile(),true),state);
 state=reconcileProfileDraft(state,profile({accentTheme:'green'}),true);
 assert.equal(state.draft.name,'New user');assert.equal(state.draft.height,'180');assert.equal(state.draft.weight,'');assert.deepEqual(state.conflicts,[]);
 const replaced=reconcileProfileDraft(state,profile({name:'Imported'}),true);assert.equal(replaced.draft.name,'New user');assert.deepEqual(replaced.conflicts,['name']);
});

test('save acknowledgment uses its snapshot and preserves text entered before the prop echo',()=>{
 let state=edit(createProfileDraft(profile()),{weight:'80.0'});
 const submission=saved(state);state=markProfileSubmitted(state,submission);
 state=edit(state,{weight:'81.',name:'Typed after Save'});
 state=reconcileProfileDraft(state,{...submission,targets:{...submission.targets}});
 assert.equal(state.draft.weight,'81.');assert.equal(state.draft.name,'Typed after Save');assert.deepEqual(state.conflicts,[]);
 state=reconcileProfileDraft(state,profile({...submission,weight:95}));
 assert.deepEqual(state.conflicts,['weight']);assert.equal(state.draft.weight,'81.');
});

test('a save echo with an independent incoming edit preserves newer typing without a false conflict',()=>{
 let state=edit(createProfileDraft(profile()),{weight:'80'});
 const submission=saved(state);state=edit(markProfileSubmitted(state,submission),{weight:'81.'});
 state=reconcileProfileDraft(state,{...submission,name:'Independent saved name'});
 assert.equal(state.draft.weight,'81.');assert.equal(state.draft.name,'Independent saved name');assert.deepEqual(state.conflicts,[]);assert.equal(state.submitted,undefined);
 state=reconcileProfileDraft(state,{...submission,name:'Independent saved name',weight:95});
 assert.deepEqual(state.conflicts,['weight']);assert.equal(state.draft.weight,'81.');
});

test('a successful weight save refreshes a clean automatic water suggestion',()=>{
 let state=edit(createProfileDraft(profile()),{weight:'95'});
 const submission=saved(state);state=reconcileProfileDraft(markProfileSubmitted(state,submission),submission);
 assert.equal(state.draft.waterLiters,createProfileDraft(submission).draft.waterLiters);assert.deepEqual(state.conflicts,[]);
});

test('no-op Save does not acknowledge unsaved data and snapshots resist caller mutation',()=>{
 const original=profile();let state=edit(createProfileDraft(original),{weight:'80'});
 const submission=saved(state);state=markProfileSubmitted(state,submission);
 submission.weight=95;submission.targets.calories=3000;original.targets.calories=4000;
 const unchanged=reconcileProfileDraft(state,profile());assert.equal(unchanged,state);assert.equal(state.source.targets.calories,2200);assert.equal(state.submitted.profile.weight,80);assert.equal(state.submitted.profile.targets.calories,2200);
 const replaced=reconcileProfileDraft(state,profile({weight:100}));assert.deepEqual(replaced.conflicts,['weight']);assert.equal(replaced.draft.weight,'80');
});
