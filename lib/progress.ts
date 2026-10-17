import {dayOffset,sum,suggestTargets} from './domain.ts';
import type {Item,Profile,State} from './domain.ts';

export type CalorieDay={date:string;calories:number;target:number;logged:boolean;eligible:boolean;success:boolean;over:boolean;underfed:boolean};

// An empty or very sparsely logged day is unknown, never a success or a deficit.
export function calorieDay(state:Pick<State,'items'|'targets'|'profile'>,date:string):CalorieDay{
 const items=state.items.filter(item=>item.date===date),calories=sum(items).calories,target=(state.targets[date]||state.profile.targets).calories;
 const logged=items.length>0,eligible=logged&&calories>=target*.7;
 const low=state.profile.goal==='mild'||state.profile.goal==='moderate',upper=low?1.08:1.1;
 const underfed=logged&&calories<target*.7;
 const success=eligible&&(low?calories>=target*.85&&calories<=target*upper:calories>=target*.9&&calories<=target*upper);
 return {date,calories,target,logged,eligible,success,over:eligible&&calories>target*upper,underfed};
}

export function periodCalories(state:Pick<State,'items'|'targets'|'profile'>,dates:string[]){
 const days=dates.map(date=>calorieDay(state,date)),eligible=days.filter(day=>day.eligible);
 return {days,loggedDays:days.filter(day=>day.logged).length,eligibleDays:eligible.length,average:eligible.length?eligible.reduce((n,d)=>n+d.calories,0)/eligible.length:null,successes:eligible.filter(day=>day.success).length,
  // Positive is over target; negative is under target. Only adequate logging contributes.
  balance:eligible.reduce((n,d)=>n+d.calories-d.target,0)};
}

export function weightTrend(weights:{date:string;kg:number}[],days:'7'|'30'|'90'|'all',anchor:string){
 const cutoff=days==='all'?'0000-01-01':dayOffset(anchor,1-Number(days));
 return weights.filter(w=>w.date>=cutoff&&w.date<=anchor).sort((a,b)=>a.date.localeCompare(b.date));
}

export function plateauAssessment(state:Pick<State,'items'|'weights'|'targets'|'profile'>,anchor:string){
 const cutoff=dayOffset(anchor,-20),weights=state.weights.filter(w=>w.date>=cutoff&&w.date<=anchor).sort((a,b)=>a.date.localeCompare(b.date));
 const candidateDates=[...new Set(state.items.filter(i=>i.date>=cutoff&&i.date<=anchor).map(i=>i.date))];
 const dates=candidateDates.filter(date=>sum(state.items.filter(i=>i.date===date)).calories>=(state.targets[date]||state.profile.targets).calories*.7);
 const expectedDirection=state.profile.goal==='mild'||state.profile.goal==='moderate'?-1:state.profile.goal==='gain'?1:0;
 if(!expectedDirection||weights.length<4||dayOffset(weights[0].date,14)>weights.at(-1)!.date||dates.length<14)return {reliable:false,plateau:false,weightChange:null,loggedDays:dates.length};
 const weightChange=weights.at(-1)!.kg-weights[0].kg;
 const stalled=expectedDirection<0?weightChange>-.45:weightChange<.45;
 return {reliable:true,plateau:stalled,weightChange,loggedDays:dates.length};
}

export function targetAdjustment(profile:Profile,newWeight:number){
 const candidate={...profile,weight:newWeight};
 const next=suggestTargets(candidate);
 return {previous:profile.targets,next,delta:next.calories-profile.targets.calories};
}

export function applyTargetFromDate(state:State,target:Profile['targets'],date:string):State{
 const snapshots={...state.targets};
 // Freeze the former profile goal for every logged historical date before changing it.
 for(const item of state.items)if(item.date<date&&!snapshots[item.date])snapshots[item.date]=state.profile.targets;
 return {...state,targets:{...snapshots,[date]:target},profile:{...state.profile,targets:target}};
}
