import type {ReactNode} from 'react';

type FoodKind =
  | 'banana' | 'avocado' | 'apple' | 'citrus' | 'berries' | 'grape' | 'watermelon' | 'pineapple' | 'dates'
  | 'tomato' | 'pepper' | 'carrot' | 'potato' | 'broccoli' | 'leafy' | 'mushroom'
  | 'chicken' | 'steak' | 'bacon' | 'sausage' | 'fish' | 'shrimp' | 'egg'
  | 'dairy' | 'cheese' | 'oats' | 'bread' | 'rice' | 'pasta' | 'pizza' | 'tortilla' | 'protein'
  | 'nuts' | 'chocolate' | 'honey' | 'dessert' | 'coffee' | 'juice' | 'soup' | 'generic';

function normalizeFoodName(value:string){
  return value
    .toLocaleLowerCase('hr-HR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function foodKind(name:string):FoodKind{
  const n=normalizeFoodName(name);
  const has=(...terms:string[])=>terms.some(term=>n.includes(term));

  if(has('banana')) return 'banana';
  if(has('avok')) return 'avocado';
  if(has('jabuk','apple')) return 'apple';
  if(has('naranc','mandarin','klementin','limun','grejp','orange','lemon')) return 'citrus';
  if(has('jagod','borov','malin','kupin','ribiz','berry')) return 'berries';
  if(has('grozd','grozde','grape')) return 'grape';
  if(has('luben','melon')) return 'watermelon';
  if(has('ananas','pineapple')) return 'pineapple';
  if(has('datul','date')) return 'dates';

  if(has('rajc','paradaj','tomat')) return 'tomato';
  if(has('paprik','pepper')) return 'pepper';
  if(has('mrkv','carrot')) return 'carrot';
  if(has('krump','batat','potato')) return 'potato';
  if(has('brokul','broccoli','cvjetac','karfiol')) return 'broccoli';
  if(has('salat','spinac','rukol','kelj','blitv','kupus','lettuce','cabbage')) return 'leafy';
  if(has('gljiv','sampinjon','mushroom')) return 'mushroom';

  if(has('pilet','pilec','pure','turkey','chicken')) return 'chicken';
  if(has('junet','goved','telet','biftek','steak','beef','svinjet','pork')) return 'steak';
  if(has('prsut','sunka','slanina','pancet','bacon','ham')) return 'bacon';
  if(has('kobasic','hrenov','sausage','hot dog')) return 'sausage';
  if(has('tuna','losos','srdin','orada','brancin','oslic','bakalar','riba','fish','salmon')) return 'fish';
  if(has('kozic','skamp','lignj','hobotnic','shrimp','prawn','squid')) return 'shrimp';
  if(has('jaj','egg')) return 'egg';

  if(has('sir','cheese','mozzarella','parmezan','gauda','gouda','feta')) return 'cheese';
  if(has('mlijeko','jogurt','skyr','kefir','vrhnje','milk','yogurt')) return 'dairy';
  if(has('zob','muesli','musli','granola','oat')) return 'oats';
  if(has('kruh','toast','peciv','baget','lepinj','bread','croissant')) return 'bread';
  if(has('riz','rice')) return 'rice';
  if(has('tjesten','spag','makaron','pasta','noodle')) return 'pasta';
  if(has('pizza')) return 'pizza';
  if(has('tortil','wrap','burrito')) return 'tortilla';
  if(has('whey','protein','hydroizolat','izolat','casein','protein shake')) return 'protein';

  if(has('badem','orah','ljesnj','kikirik','pistacij','indijski orah','nut')) return 'nuts';
  if(has('kakao','cokolad','chocolate')) return 'chocolate';
  if(has('med','honey')) return 'honey';
  if(has('keks','kolac','torta','sladoled','puding','cookie','cake','ice cream','dessert')) return 'dessert';
  if(has('kava','espresso','macchiato','cappuccino','coffee')) return 'coffee';
  if(has('sok','juice','smoothie')) return 'juice';
  if(has('juha','soup','varivo','gulas','goulash')) return 'soup';

  return 'generic';
}

const G=({children}:{children:ReactNode})=><g fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">{children}</g>;
const A=({children}:{children:ReactNode})=><g fill="var(--food-accent)" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</g>;

function Glyph({kind}:{kind:FoodKind}){
  switch(kind){
    case 'banana': return <G><path d="M12 16c5 16 17 22 28 13-11 4-20-3-23-16"/><path d="M15 13l4-2"/><path d="M39 28l2 3"/></G>;
    case 'avocado': return <><A><path d="M24 6c-7 10-13 15-13 24a13 13 0 0 0 26 0c0-9-6-14-13-24Z"/></A><circle cx="24" cy="29" r="6" fill="var(--food-spot)" stroke="currentColor" strokeWidth="1.7"/></>;
    case 'apple': return <><A><path d="M24 16c-4-5-12-4-14 4-3 12 7 21 14 21s17-9 14-21c-2-8-10-9-14-4Z"/></A><G><path d="M24 16c0-5 2-8 6-10"/><path d="M28 8c5-2 8 0 9 4-5 1-8 0-9-4Z"/></G></>;
    case 'citrus': return <><circle cx="24" cy="24" r="15" fill="var(--food-accent)" stroke="currentColor" strokeWidth="2"/><G><path d="M24 9v30M9 24h30M13 13l22 22M35 13 13 35"/></G></>;
    case 'berries': return <><A><circle cx="18" cy="24" r="7"/><circle cx="29" cy="25" r="7"/><circle cx="24" cy="34" r="7"/></A><G><path d="M24 17c0-5 4-8 8-8M24 17c-2-5-6-7-10-7"/></G></>;
    case 'grape': return <><A>{[[20,18],[28,18],[16,25],[24,25],[32,25],[20,32],[28,32],[24,39]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4.5"/>)}</A><G><path d="M24 13c2-5 5-7 10-7"/><path d="M26 11c-5-3-8-2-11 1"/></G></>;
    case 'watermelon': return <><A><path d="M9 34 24 9l15 25Z"/></A><G><path d="M12 31h24"/><path d="m20 21 1 1m7 1 1 1m-5 5 1 1"/></G></>;
    case 'pineapple': return <><A><path d="M16 18c2-5 14-5 16 0l3 17c1 6-21 6-20 0Z"/></A><G><path d="m18 19 13 18m0-18L18 37M15 28h19M24 17V7m0 5-7-5m7 5 7-5"/></G></>;
    case 'dates': return <><A><ellipse cx="18" cy="26" rx="6" ry="10"/><ellipse cx="29" cy="29" rx="6" ry="10"/><ellipse cx="25" cy="17" rx="5" ry="8"/></A><G><path d="M24 10c2-5 6-7 11-7"/></G></>;
    case 'tomato': return <><A><circle cx="24" cy="27" r="14"/></A><G><path d="m24 13 3 6 7-2-4 5 5 4-7-1-4 6-1-7-7 2 5-5-5-4 7 1Z"/></G></>;
    case 'pepper': return <><A><path d="M24 15c-2 0-5-3-9 0-8 6-6 25 0 27 4 1 7-3 9-3s5 4 9 3c6-2 8-21 0-27-4-3-7 0-9 0Z"/></A><G><path d="M24 15c0-5 2-8 6-9"/></G></>;
    case 'carrot': return <><A><path d="M17 17c7-4 15-2 18 3L24 42Z"/></A><G><path d="M20 16c-2-6 0-10 3-12m3 12c1-6 4-9 8-10m-11 9c-4-4-8-5-11-3"/></G></>;
    case 'potato': return <><A><path d="M11 26c0-10 6-17 15-17 11 0 15 8 12 19-2 10-8 15-18 13-7-1-9-7-9-15Z"/></A><G><path d="M18 19h1m10 3h1m-7 9h1m8 3h1"/></G></>;
    case 'broccoli': return <><A><circle cx="16" cy="20" r="7"/><circle cx="24" cy="16" r="8"/><circle cx="32" cy="21" r="7"/></A><G><path d="M21 23 17 41h14l-4-18"/></G></>;
    case 'leafy': return <><A><path d="M37 9C20 10 10 21 12 38c17 2 28-8 25-29Z"/></A><G><path d="M15 35c7-8 13-14 20-22M22 27l-7-4m13-2 5 4"/></G></>;
    case 'mushroom': return <><A><path d="M10 24c1-10 7-15 14-15s13 5 14 15Z"/></A><G><path d="M20 24c0 8-2 12-5 16h18c-3-4-5-8-5-16"/><path d="M16 17h1m8-3h1m6 5h1"/></G></>;
    case 'chicken': return <><A><path d="M15 15c6-5 13-2 17 3 5 7 3 14-3 17-7 3-15-1-16-8-1-4 0-9 2-12Z"/></A><G><path d="m31 33 6 6m-1-1 4-1m-4 1 1 4"/></G></>;
    case 'steak': return <><A><path d="M9 27c0-11 12-18 24-13 10 4 10 18 1 24-9 6-25 2-25-11Z"/></A><G><path d="M16 27c4-6 10-8 17-6m-12 12c5 2 10 1 14-3"/></G></>;
    case 'bacon': return <G><path d="M11 11c7 5 7 10 0 15s-7 10 0 15M20 7c7 5 7 10 0 15s-7 10 0 15m9-30c7 5 7 10 0 15s-7 10 0 15m9-30c7 5 7 10 0 15s-7 10 0 15"/></G>;
    case 'sausage': return <><A><path d="M11 31c-4-4-4-10 0-14l6-6c4-4 10-4 14 0l6 6c4 4 4 10 0 14l-6 6c-4 4-10 4-14 0Z"/></A><G><path d="m10 17-4-4m32 18 4 4"/></G></>;
    case 'fish': return <><A><path d="M8 24c7-10 18-12 27-5l6-6v22l-6-6c-9 7-20 5-27-5Z"/></A><circle cx="29" cy="21" r="1.5" fill="currentColor"/></>;
    case 'shrimp': return <G><path d="M37 15c-7-6-18-3-23 4-5 8 0 17 8 18 7 1 13-3 13-9 0-5-4-8-9-8-4 0-7 3-7 6 0 4 4 6 8 5"/><path d="m35 14 6-4m-4 6 6 1m-23 19-3 5m9-4v5"/></G>;
    case 'egg': return <><path d="M24 7c-7 0-14 13-14 22 0 8 6 13 14 13s14-5 14-13C38 20 31 7 24 7Z" fill="var(--food-accent)" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="29" r="6" fill="var(--food-spot)"/></>;
    case 'dairy': return <G><path d="M16 11h16l4 8v22H12V19Z"/><path d="M16 11l4-5h8l4 5M12 19h24M20 6v5"/></G>;
    case 'cheese': return <><A><path d="M8 32 24 10l16 10v18H8Z"/></A><g fill="var(--food-spot)"><circle cx="24" cy="27" r="2.5"/><circle cx="33" cy="31" r="2"/><circle cx="17" cy="34" r="2"/></g></>;
    case 'oats': return <><G><path d="M10 22h28c0 11-5 18-14 18s-14-7-14-18Z"/><path d="M13 18c7-5 15-5 22 0"/></G><g fill="var(--food-accent)"><ellipse cx="18" cy="16" rx="2" ry="4"/><ellipse cx="25" cy="14" rx="2" ry="4"/><ellipse cx="31" cy="17" rx="2" ry="4"/></g></>;
    case 'bread': return <><A><path d="M10 22c0-8 6-13 14-13s14 5 14 13v18H10Z"/></A><G><path d="M17 18c2-3 4-4 7-4m1 6c2-3 4-4 7-4"/></G></>;
    case 'rice': return <><G><path d="M9 23h30c0 11-5 17-15 17S9 34 9 23Z"/></G><g fill="var(--food-accent)">{[[14,20],[19,17],[24,19],[29,16],[34,20],[22,13],[27,12]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="2.1" ry="3.4" transform={`rotate(${i%2?28:-28} ${x} ${y})`}/>)}</g></>;
    case 'pasta': return <G><path d="M9 26h30c-1 9-6 14-15 14S10 35 9 26Z"/><path d="M14 23c0-8 5-8 5-14m4 14c0-8 5-8 5-14m4 14c0-8 5-8 5-14"/></G>;
    case 'pizza': return <><A><path d="M24 7 8 39h32Z"/></A><G><path d="M12 32h24"/></G><g fill="var(--food-spot)"><circle cx="23" cy="22" r="2.5"/><circle cx="29" cy="29" r="2.5"/><circle cx="18" cy="30" r="2"/></g></>;
    case 'tortilla': return <><A><path d="M12 13h24l-4 28H16Z"/></A><G><path d="m15 18 9 9 9-9M18 31h12"/></G></>;
    case 'protein': return <G><path d="M17 10h14l4 8-3 23H16l-3-23Z"/><path d="M17 10V6h14v4M14 19h20M19 27h10m-8 6h6"/></G>;
    case 'nuts': return <G><path d="M18 9c-7 4-9 12-4 17 3 3 3 6 1 9-2 4 2 8 7 7 6-1 8-7 5-11-2-3-1-5 2-8 5-5 1-14-5-15-2 0-4 0-6 1Z"/><path d="M19 15c3 2 4 5 3 8m-2 9c2 1 3 3 2 5"/></G>;
    case 'chocolate': return <><A><rect x="11" y="8" width="26" height="32" rx="3"/></A><G><path d="M20 8v32m8-32v32M11 19h26M11 29h26"/></G></>;
    case 'honey': return <><A><path d="M15 14h18l3 7-3 20H15l-3-20Z"/></A><G><path d="M15 14h18M18 8h12v6M19 25h10M24 22v8"/></G></>;
    case 'dessert': return <><A><path d="M14 18c0-7 5-11 10-11s10 4 10 11c0 5-4 8-10 8s-10-3-10-8Z"/></A><G><path d="m18 26 6 16 6-16M20 32h8m-7 5h6"/></G></>;
    case 'coffee': return <G><path d="M10 17h25v14c0 7-5 10-12 10S10 38 10 31Z"/><path d="M35 21h4c6 0 6 9 0 9h-4M17 12c-3-3 2-5 0-8m8 8c-3-3 2-5 0-8"/></G>;
    case 'juice': return <G><path d="M14 12h20l3 29H11Z"/><path d="M14 12h20l-4-6H18Zm13-6 8-3m-3 1 4 10"/><circle cx="24" cy="27" r="6"/></G>;
    case 'soup': return <G><path d="M8 24h32c0 10-6 17-16 17S8 34 8 24Z"/><path d="M15 18c-3-3 2-5 0-9m9 9c-3-3 2-5 0-9m9 9c-3-3 2-5 0-9"/></G>;
    default: return <G><circle cx="24" cy="24" r="13"/><path d="M8 9v11m4-11v11M10 9v31m27-31v31m-4-31h4"/></G>;
  }
}

export function FoodIcon({name}:{name:string}){
  const kind=foodKind(name);
  return <span className={`food-thumb food-icon food-icon-${kind}`} aria-hidden="true" title={name}>
    <svg viewBox="0 0 48 48" focusable="false"><Glyph kind={kind}/></svg>
  </span>;
}
