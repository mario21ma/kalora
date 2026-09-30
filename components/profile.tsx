'use client';
import {useState} from 'react';
import {Profile,profileSchema,suggestTargets,State,macros,fmt,suggestWaterGoalMl} from '@/lib/domain';
import {t} from '@/lib/i18n';
import {Choice} from './controls';
import {Check,ArrowRight} from 'lucide-react';

type DraftProfile={
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

function toDraft(value:Profile,onboarding:boolean):DraftProfile{
 return {
  name:onboarding?'':value.name,
  sex:onboarding?'':value.sex,
  age:onboarding?'':String(value.age),
  height:onboarding?'':String(value.height),
  weight:onboarding?'':String(value.weight),
  goalWeight:onboarding?'':String(value.goalWeight),
  activity:onboarding?'':String(value.activity),
  training:onboarding?'':String(value.training),
  goal:onboarding?'':value.goal,
  waterTrackingEnabled:value.waterTrackingEnabled!==false,
  showSilhouettes:value.showSilhouettes!==false,
  waterMode:value.waterGoalMl==null?'auto':'manual',
  waterLiters:String((value.waterGoalMl??suggestWaterGoalMl(value.weight))/1000),
  targets:{
   calories:String(value.targets.calories),
   protein:String(value.targets.protein),
   carbs:String(value.targets.carbs),
   fat:String(value.targets.fat)
  }
 };
}

function parseDraft(p:DraftProfile,savedWaterGoalMl?:number|null){
 return profileSchema.safeParse({
  name:p.name.trim(),
  sex:p.sex,
  age:Number(p.age),
  height:Number(p.height),
  weight:Number(p.weight),
  goalWeight:Number(p.goalWeight),
  activity:Number(p.activity),
  training:Number(p.training),
  goal:p.goal,
  waterTrackingEnabled:p.waterTrackingEnabled,
  showSilhouettes:p.showSilhouettes,
  waterGoalMl:!p.waterTrackingEnabled?savedWaterGoalMl:p.waterMode==='auto'?null:Math.round(Number(p.waterLiters.trim().replace(',','.'))*1000),
  targets:{
   calories:Number(p.targets.calories),
   protein:Number(p.targets.protein),
   carbs:Number(p.targets.carbs),
   fat:Number(p.targets.fat)
  }
 });
}

export function ProfileForm({value,onSave,onboarding=false,waterWeightKg}:{value:Profile,onSave:(p:Profile)=>void,onboarding?:boolean,waterWeightKg?:number}){
 const [p,setP]=useState<DraftProfile>(()=>toDraft(value,onboarding));
 const [step,setStep]=useState(0);
 const [error,setError]=useState('');

 const update=(key:keyof Omit<DraftProfile,'targets'|'waterTrackingEnabled'|'showSilhouettes'>,v:string)=>setP(prev=>({...prev,[key]:v}));
 const field=(key:'height'|'weight'|'age'|'goalWeight'|'training',label:string,min:number,max:number)=><label className="field">{label}<input required type="number" inputMode={key==='weight'||key==='goalWeight'?'decimal':'numeric'} step={key==='weight'||key==='goalWeight'?'.1':'1'} min={min} max={max} value={p[key]} onChange={e=>update(key,e.target.value)}/></label>;

 const stepValid=()=>{
  if(step===0)return p.name.trim().length>0;
  if(step===1)return p.sex!==''&&p.height!==''&&Number(p.height)>=100&&Number(p.height)<=230;
  if(step===2)return p.weight!==''&&p.goalWeight!==''&&Number(p.weight)>=35&&Number(p.weight)<=300&&Number(p.goalWeight)>=35&&Number(p.goalWeight)<=300;
  if(step===3)return p.age!==''&&Number(p.age)>=18&&Number(p.age)<=100;
  if(step===4)return p.activity!==''&&p.training!==''&&Number(p.activity)>=1.2&&Number(p.activity)<=1.9&&Number(p.training)>=0&&Number(p.training)<=14;
  if(step===5)return p.goal!=='';
  return true;
 };

 const displayControls=<section className="profile-display-settings"><h3>Prikaz i praćenje</h3><p className="small-note">Promjene potvrdi gumbom „Spremi profil”.</p>{([{key:'waterTrackingEnabled',label:'Praćenje vode',description:'Prikaži vodu, unos vode i karticu Hidratacija. Gašenje čuva unesene podatke.'},{key:'showSilhouettes',label:'Prikaži siluete',description:'Prikaži ljudske siluete uz kalorijski krug. Praćenje unosa radi i bez njih.'}] as const).map(setting=><div className="profile-toggle-row" key={setting.key}><div><b>{setting.label}</b><p>{setting.description}</p></div><button type="button" role="switch" aria-label={setting.label} aria-checked={p[setting.key]} className="profile-toggle" onClick={()=>setP(prev=>({...prev,[setting.key]:!prev[setting.key]}))}><span/></button></div>)}</section>;
 const waterControls=<section className="profile-water-target"><h3>Dnevni cilj vode</h3><p className="muted">Okvirni prijedlog prema težini. Automatski cilj prati zadnju zabilježenu težinu; možeš postaviti i vlastiti cilj.</p><Choice label="Način određivanja cilja vode" value={p.waterMode} onChange={v=>update('waterMode',v)} options={[{value:'auto',label:'Automatski izračun'},{value:'manual',label:'Ručni cilj'}]}/>{p.waterMode==='manual'?<label className="field">Dnevni cilj vode (L)<input required type="text" inputMode="decimal" value={p.waterLiters} onChange={e=>update('waterLiters',e.target.value)} aria-label="Dnevni cilj vode (L)" aria-describedby="water-goal-hint"/><small id="water-goal-hint">Od 0,5 do 10 L. Možeš upisati decimalni zarez.</small></label>:<p className="water-goal-preview">Automatski cilj: <b>{fmt(suggestWaterGoalMl(waterWeightKg??(Number(p.weight)||value.weight))/1000,2)} L dnevno</b></p>}<button type="button" className="text-button" onClick={()=>{const weight=Number(p.weight);if(!p.weight||!Number.isFinite(weight)||weight<35||weight>300){setError('Najprije unesi težinu između 35 i 300 kg.');return}setP(prev=>({...prev,waterMode:'manual',waterLiters:String(suggestWaterGoalMl(weight)/1000)}));setError('')}}>Izračunaj prijedlog vode</button></section>;
 const sections=[
  <div key="name"><div className="welcome-mark">K<span>•</span></div><h2>Manje tipkanja.<br/>Više ravnoteže.</h2><p className="muted">Tvoj dnevnik prehrane, tvoj tempo. Postavimo okvirni dnevni cilj.</p><label className="field">Kako se zoveš?<input required maxLength={80} autoComplete="name" value={p.name} onChange={e=>update('name',e.target.value)}/></label></div>,
  <div key="height">{field('height','Visina (cm)',100,230)}<label className="field">Spol za izračun<Choice label="Spol" value={p.sex} onChange={v=>update('sex',v)} options={[{value:'male',label:'Muški'},{value:'female',label:'Ženski'}]}/></label></div>,
  <div key="weight">{field('weight','Trenutna težina (kg)',35,300)}{field('goalWeight','Ciljana težina (kg)',35,300)}</div>,
  <div key="age">{field('age','Dob (godine)',18,100)}<p className="muted">Izračun je namijenjen odraslima.</p></div>,
  <div key="activity"><label className="field">Ukupna dnevna aktivnost<Choice label="Aktivnost" value={p.activity} onChange={v=>update('activity',v)} options={[{value:'1.2',label:'Pretežno sjedeći dan'},{value:'1.375',label:'Lagano aktivan'},{value:'1.55',label:'Umjereno aktivan'},{value:'1.725',label:'Vrlo aktivan'},{value:'1.9',label:'Iznimno aktivan'}]}/></label>{field('training','Treninzi tjedno',0,14)}<p className="muted">Aktivnost uključuje i treninge; ne dodajemo ih ponovno.</p></div>,
  <div key="goal"><label className="field">Tvoj cilj<Choice label="Cilj" value={p.goal} onChange={v=>update('goal',v)} options={[{value:'mild',label:'Blagi deficit · −250 kcal'},{value:'moderate',label:'Umjeren deficit · −400 kcal'},{value:'maintain',label:'Održavanje težine'},{value:'gain',label:'Blagi suficit · +200 kcal'}]}/></label></div>,
  <div key="targets"><p className="eyebrow">TVOJ DNEVNI PLAN</p><h2>{p.targets.calories?fmt(Number(p.targets.calories)):0} <small>kcal</small></h2><p className="muted">Procjena formulom Mifflin–St Jeor i faktorom aktivnosti. Sve ciljeve možeš prilagoditi.</p><div className="form-grid">{macros.map(k=><label className="field" key={k}>{t(k)} {k==='calories'?'(kcal)':'(g)'}<input type="number" inputMode="decimal" required min={k==='calories'?800:0} max={k==='calories'?8000:k==='carbs'?1200:500} value={p.targets[k]} onChange={e=>setP(prev=>({...prev,targets:{...prev.targets,[k]:e.target.value}}))}/></label>)}</div><button type="button" className="text-button" onClick={()=>{const parsed=parseDraft(p,value.waterGoalMl);if(!parsed.success){setError('Najprije ispuni osobne podatke.');return}const targets=suggestTargets(parsed.data);setP(prev=>({...prev,targets:{calories:String(targets.calories),protein:String(targets.protein),carbs:String(targets.carbs),fat:String(targets.fat)}}));setError('')}}>Ponovno izračunaj prijedlog</button>{displayControls}{p.waterTrackingEnabled&&waterControls}</div>
 ];

 return <form onSubmit={e=>{
  e.preventDefault();
  setError('');
  if(onboarding&&step<6){
   if(!stepValid()){setError('Ispuni sva polja na ovom koraku.');return}
   if(step===5){
    const parsed=parseDraft(p,value.waterGoalMl);
    if(!parsed.success){setError('Provjeri unesene podatke.');return}
    const targets=suggestTargets(parsed.data);
    setP(prev=>({...prev,targets:{calories:String(targets.calories),protein:String(targets.protein),carbs:String(targets.carbs),fat:String(targets.fat)}}));
   }
   setStep(step+1);
   return;
  }
  const parsed=parseDraft(p,value.waterGoalMl);
  if(!parsed.success){setError('Provjeri sva polja i dopuštene raspone.');return}
  onSave(parsed.data);
 }}>
  {onboarding?<><div className="steps">{sections.map((_,i)=><span key={i} className={i<=step?'done':''}/>)}</div>{sections[step]}</>:<div className="profile-fields">{sections}</div>}
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="button-row">{onboarding&&step>0&&<button type="button" className="secondary" onClick={()=>{setError('');setStep(step-1)}}>Natrag</button>}<button className="primary" type="submit">{onboarding?(step===6?'Moj plan je spreman':'Nastavi'):'Spremi profil'}{onboarding&&step<6?<ArrowRight size={18}/>:<Check size={18}/>}</button></div>
 </form>;
}

export function exportData(state:State){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kalora-dnevnik.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
