import test from 'node:test';
import assert from 'node:assert/strict';
import {baseFoods,defaultProfile,initialState,makeItem,dayOffset,stateSchema} from '../lib/domain.ts';
import {applyTargetFromDate,calorieDay,periodCalories,plateauAssessment,targetAdjustment,weightTrend} from '../lib/progress.ts';

const food=baseFoods.find(x=>x.id==='banana');
test('calendar does not count empty or very low intake days as success or deficit',()=>{
 const state=initialState(false);state.profile={...defaultProfile,targets:{...defaultProfile.targets,calories:2000}};
 assert.equal(calorieDay(state,'2026-10-01').eligible,false);
 state.items=[makeItem(food,100,'lunch','2026-10-01')];
 const day=calorieDay(state,'2026-10-01');assert.equal(day.underfed,true);assert.equal(day.success,false);assert.equal(periodCalories(state,['2026-10-01']).eligibleDays,0);
});
test('calendar honors the actual historical target and goal-specific completion range',()=>{
 const state=initialState(false);state.profile={...defaultProfile,goal:'moderate',targets:{...defaultProfile.targets,calories:2000}};
 state.targets['2026-10-01']={...state.profile.targets,calories:2500};
 state.items=[makeItem(food,2600,'lunch','2026-10-01')];
 const day=calorieDay(state,'2026-10-01');assert.equal(day.target,2500);assert.equal(day.success,true);
 const week=periodCalories(state,['2026-10-01']);assert.ok(Math.abs(week.balance+186)<1);assert.equal(week.successes,1);
});
test('target changes freeze logged historical days and write a new effective-day target',()=>{
 const state=initialState(false);state.items=[makeItem(food,100,'breakfast','2026-10-01'),makeItem(food,100,'breakfast','2026-10-03')];
 const former=state.profile.targets,next={...former,calories:2100};const updated=applyTargetFromDate(state,next,'2026-10-03');
 assert.equal(updated.targets['2026-10-01'].calories,former.calories);assert.equal(updated.targets['2026-10-03'].calories,2100);assert.equal(updated.profile.targets.calories,2100);assert.equal(state.targets['2026-10-01'],undefined);
});
test('target recommendation uses the established formula and reports transparent delta',()=>{
 const result=targetAdjustment({...defaultProfile,weight:80,targets:{...defaultProfile.targets,calories:2200}},78);
 assert.equal(result.previous.calories,2200);assert.equal(result.delta,result.next.calories-2200);assert.ok(result.next.calories>=1200);
});
test('weight trend supports 7, 30, 90 and full history ranges',()=>{
 const weights=Array.from({length:100},(_,i)=>({date:dayOffset('2026-10-17',i-99),kg:90-i*.1}));
 assert.equal(weightTrend(weights,'7','2026-10-17').length,7);assert.equal(weightTrend(weights,'30','2026-10-17').length,30);assert.equal(weightTrend(weights,'90','2026-10-17').length,90);assert.equal(weightTrend(weights,'all','2026-10-17').length,100);
});
test('plateau requires enough weigh-ins and logged days over a multi-week period',()=>{
 const state=initialState(false);state.profile={...defaultProfile,goal:'moderate'};
 state.weights=[0,7,14,20].map(i=>({date:dayOffset('2026-10-17',i-20),kg:80-i*.01}));
 state.items=Array.from({length:14},(_,i)=>makeItem(food,2000,'lunch',dayOffset('2026-10-17',i-20)));
 const result=plateauAssessment(state,'2026-10-17');assert.equal(result.reliable,true);assert.equal(result.plateau,true);assert.ok(Math.abs(result.weightChange+.2)<1e-9);assert.equal(result.loggedDays,14);
 state.weights=state.weights.slice(0,2);assert.equal(plateauAssessment(state,'2026-10-17').reliable,false);
});
test('legacy state defaults to manual targets and disabled notifications',()=>{
 const state=initialState(false);delete state.profile.targetMode;delete state.profile.autoAdjustCalories;delete state.profile.notifications;
 const parsed=stateSchema.parse(JSON.parse(JSON.stringify(state)));
 assert.equal(parsed.profile.targetMode,'manual');assert.equal(parsed.profile.autoAdjustCalories,false);assert.equal(parsed.profile.weighReminderDays,7);assert.deepEqual(parsed.profile.notifications,{weighing:false,goal:false,progress:false,plateau:false});
});
