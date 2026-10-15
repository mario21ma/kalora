import {profileSchema,suggestWaterGoalMl} from './domain.ts';
import type {Profile} from './domain.ts';

export type DraftProfile={
 name:string;
 sex:''|'male'|'female';
 age:string;
 height:string;
 weight:string;
 goalWeight:string;
 activity:string;
 training:string;
 goal:''|'mild'|'moderate'|'maintain'|'gain';
 waterTrackingEnabled:boolean;
 showSilhouettes:boolean;
 waterMode:'auto'|'manual';
 waterLiters:string;
 targets:{calories:string;protein:string;carbs:string;fat:string};
};

const fields=['name','sex','age','height','weight','goalWeight','activity','training','goal','showSilhouettes','targets.calories','targets.protein','targets.carbs','targets.fat','waterGoal'] as const;
export type ProfileDraftField=typeof fields[number];
export const profileDraftLabels:Record<ProfileDraftField,string>={name:'Ime',sex:'Spol',age:'Dob',height:'Visina',weight:'Trenutna težina',goalWeight:'Ciljana težina',activity:'Aktivnost',training:'Treninzi',goal:'Cilj',showSilhouettes:'Prikaz silueta','targets.calories':'Kalorije','targets.protein':'Proteini','targets.carbs':'Ugljikohidrati','targets.fat':'Masti',waterGoal:'Praćenje i cilj vode'};

export type ProfileDraftState={
 source:Profile;
 baseline:DraftProfile;
 draft:DraftProfile;
 conflicts:ProfileDraftField[];
 onboarding:boolean;
 submitted?:{profile:Profile;draft:DraftProfile;awaiting:ProfileDraftField[]};
};

const copyProfile=(p:Profile):Profile=>({...p,targets:{...p.targets}});
const copyDraft=(p:DraftProfile):DraftProfile=>({...p,targets:{...p.targets}});

export function toProfileDraft(value:Profile,onboarding=false):DraftProfile{
 return {
  name:onboarding?'':value.name,sex:onboarding?'':value.sex,
  age:onboarding?'':String(value.age),height:onboarding?'':String(value.height),
  weight:onboarding?'':String(value.weight),goalWeight:onboarding?'':String(value.goalWeight),
  activity:onboarding?'':String(value.activity),training:onboarding?'':String(value.training),goal:onboarding?'':value.goal,
  waterTrackingEnabled:value.waterTrackingEnabled!==false,showSilhouettes:value.showSilhouettes!==false,
  waterMode:value.waterGoalMl==null?'auto':'manual',waterLiters:String((value.waterGoalMl??suggestWaterGoalMl(value.weight))/1000),
  targets:{calories:String(value.targets.calories),protein:String(value.targets.protein),carbs:String(value.targets.carbs),fat:String(value.targets.fat)}
 };
}

export function createProfileDraft(value:Profile,onboarding=false):ProfileDraftState{
 const draft=toProfileDraft(value,onboarding);
 return {source:copyProfile(value),baseline:copyDraft(draft),draft,conflicts:[],onboarding};
}

function fieldValue(p:DraftProfile,field:ProfileDraftField,source=false):string|boolean{
 if(field==='waterGoal')return JSON.stringify([p.waterTrackingEnabled,p.waterMode,source&&p.waterMode==='auto'?null:p.waterLiters]);
 if(field.startsWith('targets.'))return p.targets[field.slice(8) as keyof DraftProfile['targets']];
 return p[field as keyof Omit<DraftProfile,'targets'|'waterTrackingEnabled'|'waterMode'|'waterLiters'>];
}

function copyField(target:DraftProfile,source:DraftProfile,field:ProfileDraftField){
 if(field==='waterGoal'){
  target.waterTrackingEnabled=source.waterTrackingEnabled;target.waterMode=source.waterMode;target.waterLiters=source.waterLiters;
 }else if(field.startsWith('targets.')){
  const key=field.slice(8) as keyof DraftProfile['targets'];target.targets[key]=source.targets[key];
 }else if(field==='showSilhouettes')target.showSilhouettes=source.showSilhouettes;
 else{
  const key=field as keyof Omit<DraftProfile,'targets'|'waterTrackingEnabled'|'waterMode'|'waterLiters'|'showSilhouettes'>;
  Object.assign(target,{[key]:source[key]});
 }
}

function numericText(text:string,comma=false){
 const cleaned=text.trim();
 if(!(comma?/^\d+(?:[.,]\d+)?$/:/^\d+(?:\.\d+)?$/).test(cleaned))return null;
 const value=Number(comma?cleaned.replace(',','.'):cleaned);
 return Number.isFinite(value)?value:null;
}

// Treat completed numeric formatting as convergence, but retain incomplete input verbatim.
function converges(draft:DraftProfile,incoming:DraftProfile,field:ProfileDraftField){
 if(fieldValue(draft,field)===fieldValue(incoming,field))return true;
 if(field==='waterGoal')return draft.waterTrackingEnabled===incoming.waterTrackingEnabled&&draft.waterMode===incoming.waterMode&&draft.waterMode==='manual'&&numericText(draft.waterLiters,true)!==null&&numericText(draft.waterLiters,true)===numericText(incoming.waterLiters,true);
 if(['age','height','weight','goalWeight','activity','training'].includes(field)||field.startsWith('targets.')){
  const local=numericText(String(fieldValue(draft,field)));
  return local!==null&&local===numericText(String(fieldValue(incoming,field)));
 }
 return false;
}

function profileKey(p:Profile){
 return JSON.stringify([toProfileDraft(p),p.accentTheme,p.waterGoalMl]);
}

function savedFieldsMatch(a:Profile,b:Profile){
 const aa=toProfileDraft(a),bb=toProfileDraft(b);
 return fields.every(field=>fieldValue(aa,field,true)===fieldValue(bb,field,true));
}

export function reconcileProfileDraft(state:ProfileDraftState,incoming:Profile,onboarding=state.onboarding):ProfileDraftState{
 if(onboarding!==state.onboarding)return createProfileDraft(incoming,onboarding);
 const acknowledged=state.submitted&&savedFieldsMatch(state.submitted.profile,incoming);
 if(!acknowledged&&profileKey(state.source)===profileKey(incoming))return state;
 // A save echo acknowledges only the submitted snapshot; text typed after Save stays dirty.
 const baseline=copyDraft(acknowledged?state.submitted!.draft:state.baseline);
 const draft=copyDraft(state.draft),previous=toProfileDraft(acknowledged?state.submitted!.profile:state.source),next=toProfileDraft(incoming);
 const conflicts=new Set(acknowledged?[]:state.conflicts);
 const submitted=state.submitted&&toProfileDraft(state.submitted.profile);
 const accepted=state.submitted?.awaiting.filter(field=>submitted&&fieldValue(submitted,field,true)===fieldValue(next,field,true))??[];
 for(const field of fields){
  // An echo may also contain an independent change; acknowledge saved fields separately.
  if(!acknowledged&&accepted.includes(field)){
   copyField(baseline,state.submitted!.draft,field);copyField(previous,submitted!,field);conflicts.delete(field);
  }
  const remoteChanged=fieldValue(previous,field,true)!==fieldValue(next,field,true);
  const dirty=!converges(draft,baseline,field);
  // The hidden automatic water suggestion follows weight only while its controls are clean.
  const refreshedWaterSuggestion=field==='waterGoal'&&fieldValue(baseline,field)!==fieldValue(next,field);
  if(!dirty&&(remoteChanged||refreshedWaterSuggestion)){
   copyField(draft,next,field);copyField(baseline,next,field);conflicts.delete(field);
  }else if(dirty&&remoteChanged){
   copyField(baseline,next,field);
   if(converges(draft,next,field)){copyField(baseline,draft,field);conflicts.delete(field)}
   else conflicts.add(field);
  }else if(conflicts.has(field)&&converges(draft,next,field)){
   copyField(baseline,draft,field);conflicts.delete(field);
  }
 }
 const awaiting=state.submitted?.awaiting.filter(field=>!accepted.includes(field));
 return {...state,source:copyProfile(incoming),baseline,draft,conflicts:[...conflicts],submitted:acknowledged||awaiting?.length===0?undefined:state.submitted&&{...state.submitted,awaiting:awaiting!}};
}

export function editProfileDraft(state:ProfileDraftState,update:(p:DraftProfile)=>DraftProfile):ProfileDraftState{
 const draft=copyDraft(update(copyDraft(state.draft))),baseline=copyDraft(state.baseline);
 const conflicts=state.conflicts.filter(field=>{
  if(!converges(draft,toProfileDraft(state.source),field))return true;
  copyField(baseline,draft,field);return false;
 });
 return {...state,draft,baseline,conflicts};
}

export function resolveProfileDraft(state:ProfileDraftState,choice:'draft'|'incoming'):ProfileDraftState{
 const draft=copyDraft(state.draft),baseline=copyDraft(state.baseline),incoming=toProfileDraft(state.source);
 for(const field of state.conflicts){
  if(choice==='incoming')copyField(draft,incoming,field);
  copyField(baseline,incoming,field);
 }
 return {...state,draft,baseline,conflicts:[]};
}

export function parseProfileDraft(p:DraftProfile,savedWaterGoalMl?:number|null){
 return profileSchema.safeParse({
  name:p.name.trim(),sex:p.sex,age:Number(p.age),height:Number(p.height),weight:Number(p.weight),goalWeight:Number(p.goalWeight),activity:Number(p.activity),training:Number(p.training),goal:p.goal,
  waterTrackingEnabled:p.waterTrackingEnabled,showSilhouettes:p.showSilhouettes,
  waterGoalMl:!p.waterTrackingEnabled?savedWaterGoalMl:p.waterMode==='auto'?null:Math.round(Number(p.waterLiters.trim().replace(',','.'))*1000),
  targets:{calories:Number(p.targets.calories),protein:Number(p.targets.protein),carbs:Number(p.targets.carbs),fat:Number(p.targets.fat)}
 });
}

export function profileDraftForSave(state:ProfileDraftState):{success:true;profile:Profile}|{success:false;reason:'conflict'|'invalid'}{
 if(state.conflicts.length)return {success:false,reason:'conflict'};
 const parsed=parseProfileDraft(state.draft,state.source.waterGoalMl);
 return parsed.success?{success:true,profile:{...parsed.data,accentTheme:state.source.accentTheme}}:{success:false,reason:'invalid'};
}

export function markProfileSubmitted(state:ProfileDraftState,profile:Profile):ProfileDraftState{
 const before=toProfileDraft(state.source),after=toProfileDraft(profile);
 const awaiting=fields.filter(field=>fieldValue(before,field,true)!==fieldValue(after,field,true));
 return {...state,submitted:{profile:copyProfile(profile),draft:copyDraft(state.draft),awaiting}};
}
