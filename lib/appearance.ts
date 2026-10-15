import {profileSchema} from './domain.ts';
import type {Profile} from './domain.ts';

export const appearanceFields=['layout','accentTheme','showSilhouettes','waterTrackingEnabled'] as const;
export type AppearanceField=typeof appearanceFields[number];
export type Appearance=Pick<Profile,AppearanceField>;
const appearanceSchema=profileSchema.pick({layout:true,accentTheme:true,showSilhouettes:true,waterTrackingEnabled:true});
export const appearanceLabels:Record<AppearanceField,string>={layout:'Raspored',accentTheme:'Boja',showSilhouettes:'Siluete',waterTrackingEnabled:'Praćenje vode'};

export function appearanceFromProfile(profile:Appearance):Appearance{
 return appearanceSchema.parse(profile);
}

export class AppearanceConflictError extends Error{
 constructor(){super('Izgled je u međuvremenu promijenjen. Pregledaj spremljene vrijednosti i ponovno potvrdi svoj izbor.');this.name='AppearanceConflictError'}
}

// Apply only fields edited by this form. A newer unrelated setting or personal
// profile edit must survive even if React has not rendered that update yet.
export function applyAppearanceChange(current:Profile,next:Appearance,baseline:Appearance):Profile{
 const parsed=appearanceSchema.parse(next),before=appearanceFromProfile(baseline),latest=appearanceFromProfile(current);
 const changes:Partial<Appearance>={};
 for(const field of appearanceFields){
  if(parsed[field]===before[field])continue;
  if(latest[field]!==before[field]&&latest[field]!==parsed[field])throw new AppearanceConflictError();
  Object.assign(changes,{[field]:parsed[field]});
 }
 return {...current,...changes};
}

export type AppearanceDraftState={source:Appearance;baseline:Appearance;draft:Appearance;conflicts:AppearanceField[]};
const same=(a:Appearance,b:Appearance)=>appearanceFields.every(field=>a[field]===b[field]);
export function createAppearanceDraft(value:Appearance):AppearanceDraftState{
 const source=appearanceFromProfile(value);
 return {source,baseline:{...source},draft:{...source},conflicts:[]};
}
export function reconcileAppearanceDraft(state:AppearanceDraftState,value:Appearance):AppearanceDraftState{
 const source=appearanceFromProfile(value);
 if(same(state.source,source))return state;
 const draft={...state.draft},baseline={...state.baseline},conflicts=new Set(state.conflicts);
 for(const field of appearanceFields){
  const dirty=draft[field]!==baseline[field],changed=source[field]!==state.source[field];
  if(!dirty){Object.assign(draft,{[field]:source[field]});Object.assign(baseline,{[field]:source[field]});conflicts.delete(field)}
  else if(changed){
   Object.assign(baseline,{[field]:source[field]});
   if(draft[field]===source[field])conflicts.delete(field);else conflicts.add(field);
  }else if(draft[field]===source[field])conflicts.delete(field);
 }
 return {source,baseline,draft,conflicts:[...conflicts]};
}
export function editAppearanceDraft(state:AppearanceDraftState,changes:Partial<Appearance>):AppearanceDraftState{
 const draft=appearanceSchema.parse({...state.draft,...changes});
 return {...state,draft,conflicts:state.conflicts.filter(field=>draft[field]!==state.source[field])};
}
export function resolveAppearanceDraft(state:AppearanceDraftState,choice:'draft'|'incoming'):AppearanceDraftState{
 const draft={...state.draft},baseline={...state.baseline};
 for(const field of state.conflicts){
  if(choice==='incoming')Object.assign(draft,{[field]:state.source[field]});
  Object.assign(baseline,{[field]:state.source[field]});
 }
 return {...state,draft,baseline,conflicts:[]};
}
export const hasAppearanceChanges=(state:AppearanceDraftState)=>!same(state.draft,state.source);
