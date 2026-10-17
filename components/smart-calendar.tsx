'use client';
import {useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {dayOffset,fmt} from '@/lib/domain';
import type {State} from '@/lib/domain';
import {calorieDay,periodCalories} from '@/lib/progress';

const dateText=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('hr-HR',{day:'numeric',month:'long'});
const monday=(d:string)=>dayOffset(d,-((new Date(d+'T12:00:00').getDay()+6)%7));
function Day({state,date,selected,otherMonth=false,onSelect}:{state:State;date:string;selected:boolean;otherMonth?:boolean;onSelect:(date:string)=>void}){
 const day=calorieDay(state,date),aboveTarget=day.eligible&&day.calories>day.target,progress=day.eligible?Math.min(day.calories/day.target,1):0,arcLength=2*Math.PI*18*.75,overRatio=aboveTarget?(day.calories-day.target)/day.target:0,overLength=2*Math.PI*22*Math.min(overRatio*270,85)/360;
 const num=Number(date.slice(8));
 return <button type="button" className={`smart-cal-day ${selected?'selected':''} ${day.logged?'logged':''} ${day.underfed?'incomplete':''} ${aboveTarget?'over-target':''} ${otherMonth?'other-month':''}`} onClick={()=>onSelect(date)} aria-label={`${dateText(date)}. ${day.logged?`${fmt(day.calories)} kcal od ${fmt(day.target)}, ${day.underfed?'nedovoljno podataka':aboveTarget?'iznad cilja':day.success?'cilj ostvaren':'cilj nije ostvaren'}`:'bez unosa'}`} aria-pressed={selected}>
  <span className="smart-cal-date">{num}</span><span className="smart-cal-ring" aria-hidden="true"><svg viewBox="0 0 48 48"><path className="ring-track" d="M11.27 36.73 A18 18 0 1 1 36.73 36.73"/><path className="ring-progress" d="M11.27 36.73 A18 18 0 1 1 36.73 36.73" strokeDasharray={`${arcLength*progress} ${arcLength}`}/>{aboveTarget&&<circle className="ring-over-segment" cx="24" cy="24" r="22" strokeDasharray={`${overLength} ${2*Math.PI*22}`}/>}</svg><span className={`ring-center ${day.success&&!aboveTarget?'ring-success':aboveTarget?'ring-over':day.logged?'ring-neutral':'ring-empty'}`}>{day.success&&!aboveTarget?<Check size={13} strokeWidth={3}/>:aboveTarget?<Check size={13} strokeWidth={3}/>:day.logged?<span className="ring-inner-dot"/>:null}</span></span>
  <small>{day.logged?fmt(day.calories):'—'}</small>
 </button>
}

export function SmartCalendar({state,selectedDate,onSelectDate}:{state:State;selectedDate:string;onSelectDate:(date:string)=>void}){
 const [mode,setMode]=useState<'month'|'week'>('month'),[month,setMonth]=useState(selectedDate.slice(0,7));
 const weekStart=monday(selectedDate),weekDays=Array.from({length:7},(_,i)=>dayOffset(weekStart,i));
 const first=month+'-01',count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate(),monthDates=Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
 const gridStart=monday(first),last=monthDates[count-1],gridEnd=dayOffset(monday(last),6),monthGridDates:string[]=[];
 for(let d=gridStart;d<=gridEnd;d=dayOffset(d,1))monthGridDates.push(d);
 const weeks=mode==='week'?[weekDays]:Array.from({length:monthGridDates.length/7},(_,i)=>monthGridDates.slice(i*7,i*7+7));
 const stats=useMemo(()=>periodCalories(state,mode==='week'?weekDays:monthDates),[state,mode,weekStart,month,count]);
 const move=(direction:number)=>{if(mode==='week'){onSelectDate(dayOffset(selectedDate,direction*7));return}const current=new Date(`${month}-01T12:00:00Z`);current.setUTCMonth(current.getUTCMonth()+direction);setMonth(`${current.getUTCFullYear()}-${String(current.getUTCMonth()+1).padStart(2,'0')}`)};
 const title=mode==='week'?`${dateText(weekDays[0])} – ${dateText(weekDays[6])}`:new Date(first+'T12:00:00').toLocaleDateString('hr-HR',{month:'long',year:'numeric'});
 return <section className="card smart-calendar-card" aria-label="Kalendar prehrane">
  <div className="section-top"><h2>Kalendar prehrane</h2><div className="month-controls"><button className="icon-button" aria-label={mode==='week'?'Prethodni tjedan':'Prethodni mjesec'} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><span>{title}</span><button className="icon-button" aria-label={mode==='week'?'Sljedeći tjedan':'Sljedeći mjesec'} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></div>
  <div className="smart-cal-toolbar"><div className="history-range" role="group" aria-label="Prikaz kalendara">{(['month','week'] as const).map(v=><button key={v} type="button" className={mode===v?'active':''} aria-pressed={mode===v} onClick={()=>setMode(v)}>{v==='month'?'Mjesec':'Tjedan'}</button>)}</div><span className="small-note">Krug prikazuje evidentirani unos · <span className="legend-success">✓ cilj</span> · <span className="legend-over">✓ iznad cilja</span></span></div>
  <div className={`smart-cal-grid ${mode}`}><div className="smart-cal-weekdays">{['Pon','Uto','Sri','Čet','Pet','Sub','Ned'].map(d=><b key={d}>{d}</b>)}<b className="smart-cal-week-label">Tjedan</b></div>{weeks.map((week,index)=>{const summary=periodCalories(state,week),tone=summary.balance>0?'over':summary.balance<0?'under':'even';return <div className="smart-cal-week-row" key={`${week[0]}-${index}`}><div className="smart-cal-days">{week.map(date=><Day key={date} state={state} date={date} selected={date===selectedDate} otherMonth={mode==='month'&&date.slice(0,7)!==month} onSelect={d=>{if(mode==='month')setMonth(d.slice(0,7));onSelectDate(d)}}/>)}</div><div className={`smart-cal-week-total ${tone}`} aria-label={`${summary.balance<0?'Ispod cilja':summary.balance>0?'Iznad cilja':'Na cilju'}, ${fmt(Math.abs(summary.balance))} kilokalorija; dovoljno podataka za ${summary.eligibleDays} od 7 dana`}><b>{summary.balance<0?'ISPOD':summary.balance>0?'IZNAD':'NA CILJU'}</b><strong>{summary.eligibleDays?fmt(Math.abs(summary.balance)):'—'}</strong>{summary.eligibleDays>0&&<small>kcal</small>}</div></div>})}</div>
  {mode==='month'&&<div className="month-cal-stats"><span><small>Prosjek unosa</small><b>{stats.average===null?'—':`${fmt(stats.average)} kcal`}</b></span><span><small>Ostvareni ciljevi</small><b>{stats.eligibleDays?`${stats.successes} / ${stats.eligibleDays} · ${Math.round(stats.successes/stats.eligibleDays*100)}%`:'—'}</b></span><span><small>Dovoljno podataka</small><b>{stats.eligibleDays} dana</b></span></div>}
 </section>
}
