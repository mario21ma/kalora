'use client';
import {useState} from 'react';
import {Profile,profileSchema,suggestTargets,State,macros,fmt} from '@/lib/domain';
import {t} from '@/lib/i18n';
import {Choice} from './controls';
import {Check,ArrowRight,Download,Cloud,Smartphone,Moon} from 'lucide-react';
export function ProfileForm({
 value,
 onSave,
 onboarding=false
}:{
 value:Profile,
 onSave:(p:Profile)=>void,
 onboarding?:boolean
}){
 const [p,setP]=useState<Profile>(()=>
  onboarding
   ?{
     ...value,
     name:'',
     sex:'' as Profile['sex'],
     age:Number.NaN,
     height:Number.NaN,
     weight:Number.NaN,
     goalWeight:Number.NaN,
     activity:Number.NaN,
     training:Number.NaN,
     goal:'' as Profile['goal']
    }
   :value
 );

 const [step,setStep]=useState(0);
 const [error,setError]=useState('');

 const update=(key:keyof Profile,v:unknown)=>
  setP({...p,[key]:v});

 const field=(
  key:'height'|'weight'|'age'|'goalWeight'|'training',
  label:string,
  min:number,
  max:number
 )=>
  <label className="field">
   {label}
   <input
    required
    type="number"
    inputMode="decimal"
    step={key==='weight'||key==='goalWeight'?'.1':'1'}
    min={min}
    max={max}
    value={Number.isFinite(p[key])?p[key]:''}
    onChange={e=>
     update(
      key,
      e.target.value==='' ? Number.NaN : Number(e.target.value)
     )
    }
   />
  </label>;

 const sections=[
  <div key="name">
   <div className="welcome-mark">K<span>•</span></div>
   <h2>Manje tipkanja.<br/>Više ravnoteže.</h2>
   <p className="muted">
    Tvoj dnevnik prehrane, tvoj tempo. Postavimo okvirni dnevni cilj.
   </p>

   <label className="field">
    Kako se zoveš?
    <input
     required
     maxLength={80}
     autoComplete="name"
     value={p.name}
     onChange={e=>update('name',e.target.value)}
    />
   </label>
  </div>,

  <div key="height">
   {field('height','Visina (cm)',100,230)}

   <label className="field">
    Spol za izračun
    <Choice
     label="Spol"
     value={p.sex||''}
     onChange={v=>update('sex',v)}
     options={[
      {value:'male',label:'Muški'},
      {value:'female',label:'Ženski'}
     ]}
    />
   </label>
  </div>,

  <div key="weight">
   {field('weight','Trenutna težina (kg)',35,300)}
   {field('goalWeight','Ciljana težina (kg)',35,300)}
  </div>,

  <div key="age">
   {field('age','Dob (godine)',18,100)}
   <p className="muted">
    Izračun je namijenjen odraslima.
   </p>
  </div>,

  <div key="activity">
   <label className="field">
    Ukupna dnevna aktivnost

    <Choice
     label="Aktivnost"
     value={Number.isFinite(p.activity)?String(p.activity):''}
     onChange={v=>update('activity',Number(v))}
     options={[
      {value:'1.2',label:'Pretežno sjedeći dan'},
      {value:'1.375',label:'Lagano aktivan'},
      {value:'1.55',label:'Umjereno aktivan'},
      {value:'1.725',label:'Vrlo aktivan'},
      {value:'1.9',label:'Iznimno aktivan'}
     ]}
    />
   </label>

   {field('training','Treninzi tjedno',0,14)}

   <p className="muted">
    Aktivnost uključuje i treninge; ne dodajemo ih ponovno.
   </p>
  </div>,

  <div key="goal">
   <label className="field">
    Tvoj cilj

    <Choice
     label="Cilj"
     value={p.goal||''}
     onChange={v=>update('goal',v)}
     options={[
      {value:'mild',label:'Blagi deficit · −250 kcal'},
      {value:'moderate',label:'Umjeren deficit · −400 kcal'},
      {value:'maintain',label:'Održavanje težine'},
      {value:'gain',label:'Blagi suficit · +200 kcal'}
     ]}
    />
   </label>
  </div>,

  <div key="targets">
   <p className="eyebrow">TVOJ DNEVNI PLAN</p>

   <h2>
    {fmt(p.targets.calories)} <small>kcal</small>
   </h2>

   <p className="muted">
    Procjena formulom Mifflin–St Jeor i faktorom aktivnosti.
    Sve ciljeve možeš prilagoditi.
   </p>

   <div className="form-grid">
    {macros.map(k=>
     <label className="field" key={k}>
      {t(k)} {k==='calories'?'(kcal)':'(g)'}

      <input
       type="number"
       required
       min={k==='calories'?800:0}
       max={k==='calories'?8000:k==='carbs'?1200:500}
       value={Number.isFinite(p.targets[k])?p.targets[k]:''}
       onChange={e=>
        setP({
         ...p,
         targets:{
          ...p.targets,
          [k]:e.target.value===''
           ?Number.NaN
           :Number(e.target.value)
         }
        })
       }
      />
     </label>
    )}
   </div>

   <button
    type="button"
    className="text-button"
    onClick={()=>setP({...p,targets:suggestTargets(p)})}
   >
    Ponovno izračunaj prijedlog
   </button>
  </div>
 ];

 return (
  <form
   onSubmit={e=>{
    e.preventDefault();
    setError('');

    if(onboarding&&step<6){

     if(step===1&&!p.sex){
      setError('Odaberi spol.');
      return;
     }

     if(step===4&&!Number.isFinite(p.activity)){
      setError('Odaberi razinu aktivnosti.');
      return;
     }

     if(step===5&&!p.goal){
      setError('Odaberi cilj.');
      return;
     }

     if(step===5){
      setP({...p,targets:suggestTargets(p)});
     }

     setStep(step+1);
     return;
    }

    const parsed=profileSchema.safeParse(p);

    if(!parsed.success){
     setError('Provjeri sva polja i dopuštene raspone.');
     return;
    }

    onSave(parsed.data);
   }}
  >

   {onboarding
    ?<>
      <div className="steps">
       {sections.map((_,i)=>
        <span
         key={i}
         className={i<=step?'done':''}
        />
       )}
      </div>

      {sections[step]}
     </>
    :<div className="profile-fields">
      {sections}
     </div>
   }

   {error&&
    <p role="alert" className="error">
     {error}
    </p>
   }

   <div className="button-row">

    {onboarding&&step>0&&
     <button
      type="button"
      className="secondary"
      onClick={()=>{
       setError('');
       setStep(step-1);
      }}
     >
      Natrag
     </button>
    }

    <button className="primary" type="submit">
     {onboarding
      ?step===6
       ?'Moj plan je spreman'
       :'Nastavi'
      :'Spremi profil'
     }

     {onboarding&&step<6
      ?<ArrowRight size={18}/>
      :<Check size={18}/>
     }
    </button>

   </div>
  </form>
 );
}m>
}
export function exportData(state:State){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kalora-dnevnik.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
