'use client';
import type {Profile} from '@/lib/domain';
import {Choice} from '@/components/controls';

export function AutomationSettings({value,onSave}:{value:Profile;onSave:(next:Profile)=>void}){
 const save=(next:Profile)=>onSave(next),enabled=value.autoAdjustCalories&&value.targetMode==='recommended';
 return <section className="card automation-settings"><div className="section-top"><h2>Kalorijski cilj</h2></div>
  <p className="muted">Preporuka se računa iz dobi, spola, visine, težine, aktivnosti i tvog cilja. Promjena od najmanje 50 kcal primjenjuje se od dana vaganja nadalje.</p>
  <div className="profile-toggle-row"><div><b>Način kalorijskog cilja</b><p>Ručni cilj ostaje isti. Preporučeni cilj računa se prema tvojim podacima.</p></div></div>
  <div className="history-range target-mode" role="group" aria-label="Način kalorijskog cilja">{(['manual','recommended'] as const).map(mode=><button type="button" key={mode} className={value.targetMode===mode?'active':''} aria-pressed={value.targetMode===mode} onClick={()=>save(mode==='manual'?{...value,targetMode:mode,autoAdjustCalories:false}:{...value,targetMode:mode})}>{mode==='manual'?'Ručni cilj':'Preporučeni cilj'}</button>)}</div>
  <div className="profile-toggle-row"><div><b>Automatski mijenjaj kalorije nakon vaganja</b><p>{enabled?'Uključeno. Nakon vaganja se cilj preračuna i, ako se promijeni barem 50 kcal, novi cilj vrijedi od tog dana.':'Isključeno. Uključi za automatsku primjenu preporučenog cilja; uključivanje odabire preporučeni način.'}</p></div><button type="button" role="switch" aria-label="Automatski mijenjaj kalorije nakon vaganja" aria-checked={enabled} className="profile-toggle" onClick={()=>save(enabled?{...value,autoAdjustCalories:false}:{...value,targetMode:'recommended',autoAdjustCalories:true})}><span/></button></div>
 </section>
}
