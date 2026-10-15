'use client';
import {useState} from 'react';
import {Check} from 'lucide-react';
import type {Profile} from '@/lib/domain';
import {appearanceLabels,createAppearanceDraft,reconcileAppearanceDraft,editAppearanceDraft,resolveAppearanceDraft,hasAppearanceChanges} from '@/lib/appearance';
import type {Appearance} from '@/lib/appearance';

const layouts=[{value:'classic',label:'Klasični',description:'Poznati raspored s velikim dnevnim sažetkom.'},{value:'compact',label:'Kompaktni',description:'Manji sažetak, više obroka uz manje skrolanja.'}] as const;
const colors=[{value:'blue',label:'Plava'},{value:'green',label:'Zelena'},{value:'yellow',label:'Žuta'},{value:'red',label:'Crvena'},{value:'white',label:'Bijela'}] as const;
const toggles=[{key:'showSilhouettes',label:'Prikaži siluete',description:'Siluete uz kalorijski krug u oba rasporeda.'},{key:'waterTrackingEnabled',label:'Praćenje vode',description:'Prikaži vodu i hidrataciju. Isključivanje čuva sve unose i cilj vode.'}] as const;

export function AppearanceSettings({value,onSave}:{value:Profile;onSave:(next:Appearance,baseline:Appearance)=>boolean}){
 const [draftState,setDraftState]=useState(()=>createAppearanceDraft(value));
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const current=reconcileAppearanceDraft(draftState,value);
 if(current!==draftState)setDraftState(current);
 const edit=(changes:Partial<Appearance>)=>{setDraftState(previous=>editAppearanceDraft(reconcileAppearanceDraft(previous,value),changes));setMessage('');setError('')};
 const resolve=(choice:'draft'|'incoming')=>{setDraftState(previous=>resolveAppearanceDraft(reconcileAppearanceDraft(previous,value),choice));setMessage('');setError('')};
 return <form className="appearance-settings" onSubmit={event=>{
  event.preventDefault();setMessage('');setError('');
  const latest=reconcileAppearanceDraft(current,value);
  if(latest.conflicts.length){setDraftState(latest);setError('Odaberi koje vrijednosti želiš zadržati prije spremanja.');return}
  if(onSave({...latest.draft},{...latest.source}))setMessage('Izgled je spremljen.');
  else setError('Izgled nije spremljen. Pregledaj eventualne novije promjene pa pokušaj ponovno.');
 }}>
  <h2>Izgled aplikacije</h2><p className="muted">Odaberi raspored, boju i prikaz. Promjene se primjenjuju nakon spremanja.</p>
  <fieldset className="appearance-section"><legend>Raspored</legend><div className="appearance-layouts">{layouts.map(layout=><button key={layout.value} type="button" className="appearance-layout-choice" aria-pressed={current.draft.layout===layout.value} onClick={()=>edit({layout:layout.value})}>
   <span aria-hidden="true" className={'appearance-layout-preview '+layout.value}><span className="preview-summary"><span className="preview-person"/><span className="preview-ring"/><span className="preview-person"/></span><span className="preview-macros"><i/><i/><i/></span><span className="preview-water"/><span className="preview-lines"><i/><i/></span></span>
   <b>{layout.label}</b><small>{layout.description}</small>
  </button>)}</div></fieldset>
  <fieldset className="appearance-section"><legend>Boja</legend><div className="appearance-colors">{colors.map(color=><button type="button" key={color.value} className="appearance-color-choice" data-color={color.value} aria-pressed={current.draft.accentTheme===color.value} onClick={()=>edit({accentTheme:color.value})}><span className="appearance-color-dot" aria-hidden="true"/>{color.label}</button>)}</div></fieldset>
  <fieldset className="appearance-section"><legend>Prikaz i praćenje</legend>{toggles.map(toggle=><div className="profile-toggle-row" key={toggle.key}><div><b>{toggle.label}</b><p>{toggle.description}</p></div><button type="button" role="switch" aria-label={toggle.label} aria-checked={current.draft[toggle.key]} className="profile-toggle" onClick={()=>edit({[toggle.key]:!current.draft[toggle.key]})}><span/></button></div>)}</fieldset>
  {current.conflicts.length>0&&<div className="notice" role="alert"><p>Izgled je promijenjen dok si uređivao/la ista polja: {current.conflicts.map(field=>appearanceLabels[field]).join(', ')}. Tvoj izbor je sačuvan.</p><div className="button-row"><button type="button" className="secondary" onClick={()=>resolve('draft')}>Zadrži moj izbor</button><button type="button" className="secondary" onClick={()=>resolve('incoming')}>Preuzmi spremljeni izgled</button></div></div>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="button-row"><button type="submit" className="primary" disabled={current.conflicts.length>0||!hasAppearanceChanges(current)}><Check size={18}/>Spremi izgled</button></div>
  <p className="small-note appearance-status" role="status">{message||'Odabir vrijedi za ovaj profil i prenosi se sinkronizacijom dnevnika.'}</p>
 </form>;
}
