'use client';
import {useEffect,useState} from 'react';
import {Bell,Check,Smartphone} from 'lucide-react';
import type {Profile} from '@/lib/domain';
import {Choice} from '@/components/controls';

type NoticeKey=keyof Profile['notifications'];
const options:{key:NoticeKey;title:string;description:string}[]=[
 {key:'weighing',title:'Tjedni podsjetnik za vaganje',description:'Podsjeti me kada prođe tjedan bez novog vaganja.'},
 {key:'goal',title:'Promjena kalorijskog cilja',description:'Obavijesti me kada se izračuna novi prijedlog.'},
 {key:'progress',title:'Značajan napredak',description:'Javi mi kada trend potvrdi pomak prema cilju.'},
 {key:'plateau',title:'Moguća stagnacija',description:'Predloži provjeru cilja nakon dovoljno podataka.'},
];
export function AutomationSettings({value,onSave,onEnablePush,onDisablePush}:{value:Profile;onSave:(next:Profile)=>void;onEnablePush:()=>Promise<void>;onDisablePush:()=>Promise<void>}){
 const [permission,setPermission]=useState('unsupported'),[pushError,setPushError]=useState(''),[pushBusy,setPushBusy]=useState(false);
 useEffect(()=>{setPermission(typeof Notification==='undefined'?'unsupported':Notification.permission)},[]);
 const save=(next:Profile)=>onSave(next);
 const toggleNotice=(key:NoticeKey)=>save({...value,notifications:{...value.notifications,[key]:!value.notifications[key]}});
 return <section className="card automation-settings"><div className="section-top"><h2>Pametni ciljevi i obavijesti</h2><Bell size={20}/></div>
  <p className="muted">Proračun koristi Mifflin–St Jeor i tvoje zadnje vaganje. Promjene manje od 100 kcal ne primjenjujemo automatski.</p>
  <div className="profile-toggle-row"><div><b>Način kalorijskog cilja</b><p>Ručni cilj ostaje nepromijenjen. Automatski prijedlog koristi se samo ako ga izričito odabereš.</p></div></div>
  <div className="history-range target-mode" role="group" aria-label="Način kalorijskog cilja">{(['manual','recommended'] as const).map(mode=><button type="button" key={mode} className={value.targetMode===mode?'active':''} aria-pressed={value.targetMode===mode} onClick={()=>save({...value,targetMode:mode})}>{mode==='manual'?'Ručni cilj':'Preporučeni cilj'}</button>)}</div>
  <div className="profile-toggle-row"><div><b>Automatsko prilagođavanje kalorija</b><p>{value.targetMode==='recommended'?'Nakon novog vaganja primijeni pouzdanu promjenu od najmanje 100 kcal od tog dana nadalje.':'Trenutačni cilj je ručni. Uključi preporučeni način prije automatske primjene.'}</p></div><button type="button" role="switch" aria-label="Automatsko prilagođavanje kalorija" aria-checked={value.autoAdjustCalories} className="profile-toggle" onClick={()=>save({...value,autoAdjustCalories:!value.autoAdjustCalories})}><span/></button></div>
  <h3>Obavijesti</h3><p className="small-note">Podsjetnici rade kada Kalora radi ili se ponovno otvori. Za iPhone obavijesti treba instalirati Kaloru na početni zaslon i dopustiti ih; pozadinske push poruke traže poslužiteljsku push konfiguraciju.</p>
  {value.notifications.weighing&&<Choice label="Razmak između podsjetnika" value={String(value.weighReminderDays)} onChange={v=>save({...value,weighReminderDays:Number(v) as Profile['weighReminderDays']})} options={[{value:'7',label:'Svaki tjedan'},{value:'14',label:'Svaka 2 tjedna'},{value:'30',label:'Svaki mjesec'}]}/>}{options.map(option=><div className="profile-toggle-row" key={option.key}><div><b>{option.title}</b><p>{option.description}</p></div><button type="button" role="switch" aria-label={option.title} aria-checked={value.notifications[option.key]} className="profile-toggle" onClick={()=>toggleNotice(option.key)}><span/></button></div>)}
  {Object.values(value.notifications).some(Boolean)&&permission!=='granted'&&<button type="button" className="secondary notification-permission" disabled={pushBusy||permission==='unsupported'} onClick={async()=>{setPushBusy(true);setPushError('');try{if(typeof Notification==='undefined'){setPermission('unsupported');return}const result=Notification.permission==='granted'?'granted':await Notification.requestPermission();setPermission(result);if(result==='granted')await onEnablePush()}catch(e){setPushError(e instanceof Error?e.message:'Push obavijesti nisu mogle biti uključene.')}finally{setPushBusy(false)}}}><Smartphone size={17}/>{permission==='unsupported'?'Obavijesti nisu podržane u ovom pregledniku':pushBusy?'Povezivanje…':permission==='granted'?'Aktiviraj obavijesti na ovom uređaju':'Dopusti obavijesti na uređaju'}</button>}
  {permission==='granted'&&<button type="button" className="text-button" disabled={pushBusy} onClick={async()=>{setPushBusy(true);setPushError('');try{await onDisablePush()}catch(e){setPushError(e instanceof Error?e.message:'Pretplatu nije moguće ukloniti.')}finally{setPushBusy(false)}}}>Isključi push na ovom uređaju</button>}
  {permission==='granted'&&<p className="notification-ready"><Check size={16}/>Dopuštenje za obavijesti je uključeno na ovom uređaju.</p>}{pushError&&<p className="error" role="alert">{pushError}</p>}
 </section>
}
