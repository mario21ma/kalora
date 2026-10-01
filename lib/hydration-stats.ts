import type {WaterEntry} from './domain';

/** Missing water logs are unknown, not zero-intake days. */
export function hydrationStats(entries:WaterEntry[],dates:string[]){
 const selected=new Set(dates),logged=new Set<string>();let totalMl=0;
 for(const entry of entries){if(selected.has(entry.date)){totalMl+=entry.amountMl;logged.add(entry.date)}}
 return {loggedDays:logged.size,totalMl,averageMl:logged.size?totalMl/logged.size:null};
}
