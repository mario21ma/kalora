'use client';
import {useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {dayOffset,fmt} from '@/lib/domain';
import type {State} from '@/lib/domain';
import {calorieDay,periodCalories} from '@/lib/progress';

const dateText=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('hr-HR',{day:'numeric',month:'long'});
const monday=(d:string)=>dayOffset(d,-((new Date(d+'T12:00:00').getDay()+6)%7));
function Day({state,date,selected,onSelect}:{state:State;date:string;selected:boolean;onSelect:(date:string)=>void}){
 const day=calorieDay(state,date),value=day.eligible?Math.min(day.calories/day.target*100,100):0,overValue=day.over?Math.min((day.calories-day.target)/day.target,1)*360:0;
 const ringColor=day.success?'var(--success)':day.over?'var(--danger)':day.underfed?'var(--muted)':'var(--skin-color)';
 const num=Number(date.slice(8));
 return <button type="button" className={`smart-cal-day ${selected?'selected':''} ${day.logged?'logged':''} ${day.underfed?'incomplete':''}`} onClick={()=>onSelect(date)} aria-label={`${dateText(date)}. ${day.logged?`${fmt(day.calories)} kcal od ${fmt(day.target)}, ${day.success?'cilj ostvaren':day.over?'iznad cilja':day.underfed?'nedovoljno podataka':'cilj nije ostvaren'}`:'bez unosa'}`} aria-pressed={selected}>
  <span className="smart-cal-date">{num}</span><span className="smart-cal-ring" style={{'--ring-color':ringColor,'--ring-fill':`${value*3.6}deg`,'--ring-over':`${overValue}deg`} as React.CSSProperties}>{day.success?<Check size={15}/>:day.over?<span className="ring-over-mark">!</span>:day.underfed?<span className="ring-over-mark">·</span>:<span className="ring-inner-dot"/>}</span>
  <small>{day.logged?fmt(day.calories):'—'}</small>
 </button>
}

export function SmartCalendar({state,selectedDate,onSelectDate}:{state:State;selectedDate:string;onSelectDate:(date:string)=>void}){
 const [mode,setMode]=useState<'month'|'week'>('month'),[month,setMonth]=useState(selectedDate.slice(0,7));
 const weekStart=monday(selectedDate),weekDays=Array.from({length:7},(_,i)=>dayOffset(weekStart,i));
 const first=month+'-01',count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate(),pad=(new Date(first+'T12:00:00').getDay()+6)%7;
 const dates=mode==='week'?weekDays:[...Array.from({length:pad},()=>''),...Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))];
 const stats=useMemo(()=>periodCalories(state,mode==='week'?weekDays:Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))),[state,mode,weekStart,month,count]);
 const move=(direction:number)=>{if(mode==='week'){onSelectDate(dayOffset(selectedDate,direction*7));return}const current=new Date(`${month}-01T12:00:00Z`);current.setUTCMonth(current.getUTCMonth()+direction);setMonth(`${current.getUTCFullYear()}-${String(current.getUTCMonth()+1).padStart(2,'0')}`)};
 const title=mode==='week'?`${dateText(weekDays[0])} – ${dateText(weekDays[6])}`:new Date(first+'T12:00:00').toLocaleDateString('hr-HR',{month:'long',year:'numeric'});
 const balance=mode==='week'?periodCalories(state,weekDays):null;
 const balanceLabel=balance?.balance===undefined?'':balance.balance<0?'ispod cilja':balance.balance>0?'iznad cilja':'na cilju';
 return <section className="card smart-calendar-card" aria-label="Kalendar prehrane">
  <div className="section-top"><h2>Kalendar prehrane</h2><div className="month-controls"><button className="icon-button" aria-label={mode==='week'?'Prethodni tjedan':'Prethodni mjesec'} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><span>{title}</span><button className="icon-button" aria-label={mode==='week'?'Sljedeći tjedan':'Sljedeći mjesec'} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></div>
  <div className="smart-cal-toolbar"><div className="history-range" role="group" aria-label="Prikaz kalendara">{(['month','week'] as const).map(v=><button key={v} type="button" className={mode===v?'active':''} aria-pressed={mode===v} onClick={()=>setMode(v)}>{v==='month'?'Mjesec':'Tjedan'}</button>)}</div><span className="small-note">Krug prikazuje evidentirani unos · <span className="legend-success">✓ cilj</span> · <span className="legend-over">! iznad</span></span></div>
  <div className={`smart-cal-grid ${mode}`}><div className="smart-cal-weekdays">{['Pon','Uto','Sri','Čet','Pet','Sub','Ned'].map(d=><b key={d}>{d}</b>)}</div><div className="smart-cal-days">{dates.map((date,i)=>date?<Day key={date} state={state} date={date} selected={date===selectedDate} onSelect={d=>{if(mode==='month')setMonth(d.slice(0,7));onSelectDate(d)}}/>:<span key={`pad-${i}`} className="smart-cal-pad"/>)}</div></div>
  {mode==='week'&&balance&&<div className={`week-cal-balance ${balance.balance>0?'over':''}`}><div><b>{balance.balance<0?'ISPOD CILJA':balance.balance>0?'IZNAD CILJA':'NA CILJU'}</b><strong>{balance.balance>0?'+':''}{fmt(balance.balance)} kcal</strong></div><small>{balance.eligibleDays} od 7 dana s dovoljno unosa za izračun. Dnevni ciljevi uzeti su iz povijesti.</small></div>}
  {mode==='month'&&<div className="month-cal-stats"><span><small>Prosjek unosa</small><b>{stats.average===null?'—':`${fmt(stats.average)} kcal`}</b></span><span><small>Ostvareni ciljevi</small><b>{stats.eligibleDays?`${stats.successes} / ${stats.eligibleDays} · ${Math.round(stats.successes/stats.eligibleDays*100)}%`:'—'}</b></span><span><small>Dovoljno podataka</small><b>{stats.eligibleDays} dana</b></span></div>}
 </section>
}
