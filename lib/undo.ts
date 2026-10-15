import type {State} from './domain';

const missing=Symbol('missing');
type Value=unknown|typeof missing;
type ObjectValue=Record<string,unknown>;
const isObject=(v:Value):v is ObjectValue=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function equal(a:Value,b:Value):boolean{
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
 if(isObject(a)&&isObject(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]))}
 return false;
}

function index(values:unknown[],key:string){
 const result=new Map<string,ObjectValue>();
 for(const value of values){if(!isObject(value)||typeof value[key]!=='string')throw new Error('Poništavanje zahtijeva valjane oznake unosa.');const id=value[key] as string;if(result.has(id))throw new Error('Poništavanje zahtijeva različite oznake unosa.');result.set(id,value)}
 return result;
}

/** Reverse one operation, never replacing independent changes made afterwards. */
function undoList(current:unknown[],before:unknown[],after:unknown[],key:string,path:string):unknown[]{
 const old=index(before,key),next=index(after,key),present=index(current,key),result:unknown[]=[];
 for(const value of current){const id=(value as ObjectValue)[key] as string;const previous=old.get(id)??missing,following=next.get(id)??missing;
  const restored=undoValue(value,previous,following,path+'.'+id);
  if(restored!==missing)result.push(restored);
 }
 // A deleted entity is restored only if its ID has not been re-used.
 type Node={value:unknown,previous:Node|null,next:Node|null};
 let first:Node|null=null,last:Node|null=null;
 const positions=new Map<string,Node>();
 for(const value of result){const node:Node={value,previous:last,next:null};if(last)last.next=node;else first=node;last=node;positions.set((value as ObjectValue)[key] as string,node)}
 // Indexed neighbours keep restoration linear even for large imported diaries.
 const nextAnchor:(Node|null)[]=new Array(before.length);let anchor:Node|null=null;
 for(let i=before.length-1;i>=0;i--){nextAnchor[i]=anchor;anchor=positions.get((before[i] as ObjectValue)[key] as string)??anchor}
 let previous:Node|null=null;
 for(let i=0;i<before.length;i++){const value=before[i],id=(value as ObjectValue)[key] as string;
  if(present.has(id)||next.has(id)){previous=positions.get(id)??previous;continue}
  const following=nextAnchor[i],preceding=following?following.previous:previous??last;
  const node:Node={value,previous:preceding,next:following??preceding?.next??null};
  if(node.previous)node.previous.next=node;else first=node;if(node.next)node.next.previous=node;else last=node;
  positions.set(id,node);previous=node;
 }
 const restored:unknown[]=[];let cursor:Node|null=first;while(cursor){restored.push(cursor.value);cursor=cursor.next}return restored;
}

function undoValue(current:Value,before:Value,after:Value,path:string):Value{
 if(equal(before,after))return current;
 // Do not partially delete an entity that has been edited since it was added.
 if(before===missing||after===missing)return equal(current,after)?before:current;
 if(isObject(current)&&isObject(before)&&isObject(after)){
  const result={...current};
  // Quantity edits also describe whether that quantity was estimated. Restore
  // the pair only while both still match, preserving later edits to either.
  const quantityChanged=typeof before.grams==='number'&&typeof after.grams==='number'&&typeof before.isEstimate==='boolean'&&typeof after.isEstimate==='boolean'&&!equal(before.grams,after.grams);
  if(quantityChanged&&equal(current.grams,after.grams)&&equal(current.isEstimate,after.isEstimate)){result.grams=before.grams;result.isEstimate=before.isEstimate}
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(quantityChanged&&(key==='grams'||key==='isEstimate'))continue;
   const value=undoValue(Object.hasOwn(current,key)?current[key]:missing,Object.hasOwn(before,key)?before[key]:missing,Object.hasOwn(after,key)?after[key]:missing,path?path+'.'+key:key);
   if(value===missing)delete result[key];else result[key]=value;
  }
  return result;
 }
 if(Array.isArray(current)&&Array.isArray(before)&&Array.isArray(after)){
  const field=path.split('.').at(-1),key=field==='weights'?'date':['items','foods','favorites','waterEntries'].includes(field??'')?'id':null;
  if(key)return undoList(current,before,after,key,path);
  // Chat rows have no IDs; only undo a known prefix and retain later appends.
  if(path==='messages'){
   // A restored longer prefix must not be prepended again by a repeated Undo.
   if(before.length>after.length&&before.every((v,i)=>equal(v,current[i])))return current;
   if(after.length<=current.length&&after.every((v,i)=>equal(v,current[i])))return [...before,...current.slice(after.length)].slice(-200);
  }
 }
 return equal(current,after)?before:current;
}

export function undoStateChange(current:State,before:State,after:State):State{
 // Changed keyed collections reject ambiguity in undoList; untouched
 // collections retain every record, including pre-existing duplicates.
 const result=undoValue(current,before,after,'') as State;
 const water:Record<string,number>=Object.fromEntries(Object.keys(current.water).map(date=>[date,0]));
 for(const entry of result.waterEntries)water[entry.date]=(water[entry.date]??0)+entry.amountMl;
 return {...result,water};
}
