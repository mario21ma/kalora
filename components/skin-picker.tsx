'use client';
import {useRef,type CSSProperties} from 'react';
import {Check} from 'lucide-react';
import type {Profile} from '@/lib/domain';

type Skin=Profile['accentTheme'];
const skins:{id:Skin,name:string,description:string,color:string}[]=[
 {id:'blue',name:'Plava',description:'AI · zadana',color:'#48c6ff'},
 {id:'green',name:'Zelena',description:'Danas',color:'#35df9c'},
 {id:'yellow',name:'Žuta',description:'Povijest',color:'#ffdb63'},
 {id:'red',name:'Crvena',description:'Favoriti',color:'#ff8388'},
 {id:'white',name:'Bijela',description:'Minimal',color:'#edf3ff'}
];
export function SkinPicker({value,onChange}:{value:Skin,onChange:(value:Skin)=>void}){
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 return <div className="skin-picker" role="radiogroup" aria-label="Tema akcenata">{skins.map((skin,index)=><button key={skin.id} ref={el=>{buttons.current[index]=el}} type="button" role="radio" aria-checked={skin.id===value} aria-label={`${skin.name} — ${skin.description}`} tabIndex={skin.id===value?0:-1} className="skin-option" style={{'--preview-accent':skin.color} as CSSProperties} onClick={()=>onChange(skin.id)} onKeyDown={e=>{
  let next:number;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(index+1)%skins.length;
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(index+skins.length-1)%skins.length;
  else if(e.key==='Home')next=0;else if(e.key==='End')next=skins.length-1;else return;
  e.preventDefault();onChange(skins[next].id);buttons.current[next]?.focus();
 }}><span className="skin-preview" aria-hidden="true"><i className="skin-preview-ring"/><i className="skin-preview-line"/><i className="skin-preview-button"/></span><span className="skin-option-name">{skin.name}{skin.id===value&&<Check size={15} aria-hidden="true"/>}</span><small>{skin.description}</small></button>)}</div>;
}
