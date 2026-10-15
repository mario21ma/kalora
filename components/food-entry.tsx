'use client';

import {useId, useState} from 'react';
import {Bookmark, Camera, Check, Heart, LoaderCircle, Plus, Search, Sparkles, X} from 'lucide-react';
import {Choice} from '@/components/controls';
import {fmt, mealTypes, norm, nutrition, quantityUnit, sum} from '@/lib/domain';
import type {Food, Item, MealType, State} from '@/lib/domain';
import {t} from '@/lib/i18n';
import {itemProvenance} from '@/lib/item-provenance';
import {parseQuantityDraft} from '@/lib/quantity';

export type FoodEntryProps = {
  meal: MealType;
  onMealChange: (meal: MealType) => void;
  input: string;
  onInputChange: (value: string) => void;
  busy: boolean;
  aiReady: boolean;
  online: boolean;
  canUseAi: boolean;
  unknown: string[];
  preview: Item[];
  previewDrafts: Record<string, string>;
  onQuantityChange: (id: string, raw: string) => void;
  onRemovePreview: (id: string) => void;
  onAnalyze: () => void;
  onSavePreview: () => void;
  foods: Food[];
  search: string;
  onSearchChange: (value: string) => void;
  favorites: State['favorites'];
  onFoodPick: (food: Food) => void;
  onFavoritePick: (favorite: State['favorites'][number]) => void;
  onManualFood: () => void;
  onBarcode: () => void;
  dateLabel?: string;
};

export function EntryProvenance({item}: {item: Item}) {
  const provenance = itemProvenance(item);
  return <div className="entry-provenance">
    <span className="provenance-quantity" data-kind={provenance.quantity.kind}>{provenance.quantity.label}</span>
    <span className="provenance-data" data-kind={provenance.data.kind} title={provenance.data.note}>Podaci: {provenance.data.label}</span>
    {provenance.links.length > 0 && <div className="provenance-links">{provenance.links.map((link, index) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">Izvor {index + 1}: {link.hostname}</a>)}</div>}
  </div>;
}

function Totals({items}: {items: Item[]}) {
  const total = sum(items);
  return <div className="mini-totals"><b>{fmt(total.calories)} kcal</b><span><strong>P</strong> {fmt(total.protein)} g</span><span><strong>UH</strong> {fmt(total.carbs)} g</span><span><strong>M</strong> {fmt(total.fat)} g</span></div>;
}

/** Presentational entry modes share the parent's preview and explicit save. */
export function FoodEntry(props: FoodEntryProps) {
  const [mode, setMode] = useState<'describe' | 'saved'>('describe');
  const quantityErrorId = useId();
  const previewValid = props.preview.length > 0 && props.preview.every(item => parseQuantityDraft(props.previewDrafts[item.id] ?? String(item.grams)) !== null);
  const aiAvailable = props.aiReady && props.online && props.canUseAi;
  const normalizedSearch = norm(props.search.trim());
  const favorites = props.favorites.filter(favorite => norm(favorite.name).includes(normalizedSearch));
  const foods = props.foods.slice(0, mode === 'describe' ? 4 : props.search ? 20 : 7);

  const foodChoices = <div className="quick-foods">{foods.map(food => <button className="entry-food-pick" type="button" key={food.id} disabled={props.busy} onClick={() => props.onFoodPick(food)}><span>{food.name}{food.brand && <small>{food.brand}</small>}</span><span>{fmt(food.serving, 2)} {quantityUnit(food)}</span><Plus size={15}/></button>)}</div>;

  return <div className="food-entry">
    <div className="add-mode-tabs" role="group" aria-label="Način dodavanja hrane">
      <button className={mode === 'describe' ? 'active' : ''} type="button" aria-pressed={mode === 'describe'} onClick={() => setMode('describe')}><Sparkles size={18}/>Opiši</button>
      <button type="button" disabled={props.busy} onClick={props.onBarcode}><Camera size={18}/>Barkod</button>
      <button className={mode === 'saved' ? 'active' : ''} type="button" aria-pressed={mode === 'saved'} onClick={() => setMode('saved')}><Bookmark size={18}/>Spremljeno</button>
    </div>

    <Choice value={props.meal} onChange={value => props.onMealChange(value as MealType)} label="Obrok" options={mealTypes.map(meal => ({value: meal, label: t(meal)}))}/>
    {props.dateLabel && <p className="small-note entry-date">Dodavanje za {props.dateLabel}.</p>}

    {mode === 'describe' ? <div className="entry-mode-panel">
      <label className="field entry-description">Što si jeo/la?<textarea autoFocus rows={3} maxLength={2000} value={props.input} onChange={event => props.onInputChange(event.target.value)} placeholder="npr. 150 g grčkog jogurta i jedna banana" aria-label="Opis obroka"/></label>
      <button className="primary full" type="button" disabled={props.busy || !props.input.trim()} onClick={props.onAnalyze}>{props.busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {props.busy ? 'Procjenjujem obrok…' : aiAvailable ? 'Procijeni s AI' : 'Analiziraj'}</button>
      <p className="small-note entry-ai-note">{aiAvailable ? 'Navedi količinu ako je znaš. Prije spremanja provjeri procjenu, izvor i g/ml.' : !props.online ? 'Izvanmrežno si. Poznate namirnice možeš analizirati lokalno; AI i barkod trebaju internet.' : props.aiReady && !props.canUseAi ? 'Za AI procjenu prijavi se. Poznate namirnice možeš analizirati i lokalno.' : 'Koristi se lokalna procjena poznatih namirnica. Količinu provjeri prije spremanja.'}</p>
      {foods.length > 0 && <section className="entry-common-foods" aria-label="Brzi odabir namirnice"><div className="entry-section-heading"><h3>{props.search ? 'Namirnice iz pretrage' : 'Često jedeš'}</h3><button className="text-button" type="button" onClick={() => setMode('saved')}>Pretraži sve</button></div>{foodChoices}</section>}
    </div> : <div className="entry-mode-panel">
      <label className="search-field"><Search size={18}/><input value={props.search} onChange={event => props.onSearchChange(event.target.value)} placeholder="Namirnica ili omiljeni obrok…" aria-label="Pretraži spremljene namirnice"/></label>
      <section className="entry-common-foods"><div className="entry-section-heading"><h3>{props.search ? 'Namirnice' : 'Često jedeš'}</h3><button className="text-button" type="button" disabled={props.busy} onClick={props.onManualFood}>Točna deklaracija</button></div>{foodChoices}{!foods.length && <p className="small-note entry-empty">Nema namirnice s tim nazivom. Opiši je ili dodaj podatke s deklaracije.</p>}</section>
      <section className="saved-favorites"><h3><Heart size={16}/>Omiljeni obroci</h3>{favorites.length > 0 ? <div className="saved-favorite-grid">{favorites.map(favorite => <button className="saved-favorite" type="button" key={favorite.id} disabled={props.busy} onClick={() => props.onFavoritePick(favorite)}><span><b>{favorite.name}</b><small>{favorite.items.length} stavki · {fmt(sum(favorite.items).calories)} kcal</small></span><Plus size={17}/></button>)}</div> : <p className="small-note entry-empty">{props.search ? 'Nema omiljenog obroka s tim nazivom.' : 'Obrok možeš spremiti među favorite iz svojeg dnevnika.'}</p>}</section>
    </div>}

    {props.unknown.length > 0 && <div className="notice" role="alert">Nisam siguran za: {props.unknown.join(', ')}. Navedi vrstu hrane i jasnu količinu pa pokušaj ponovno.</div>}

    {props.preview.length > 0 && <section className="preview-section" aria-label="Pregled obroka">
      <h3>Provjeri obrok <span className="small-pill">{props.preview.length} {props.preview.length === 1 ? 'STAVKA' : 'STAVKI'}</span></h3>
      <p className="small-note">Količina i podrijetlo nutritivnih podataka označeni su zasebno.</p>
      {props.preview.map(item => {
        const draft = props.previewDrafts[item.id] ?? String(item.grams);
        const invalid = parseQuantityDraft(draft) === null;
        return <div className="preview-row" key={item.id}><div><b>{item.name}</b><small>{fmt(nutrition(item).calories)} kcal za ovu količinu</small><EntryProvenance item={item}/></div><label><input type="text" inputMode="decimal" aria-label={(quantityUnit(item) === 'ml' ? 'Mililitri za ' : 'Grami za ') + item.name} value={draft} aria-invalid={invalid} aria-describedby={invalid ? quantityErrorId : undefined} onChange={event => props.onQuantityChange(item.id, event.target.value)}/><span>{quantityUnit(item)}</span></label><button className="icon-button" type="button" aria-label={'Ukloni ' + item.name + ' iz pregleda'} disabled={props.busy} onClick={() => props.onRemovePreview(item.id)}><X size={16}/></button></div>;
      })}
      {!previewValid && <p id={quantityErrorId} role="alert" className="notice error">Upiši valjanu količinu veću od 0 i najviše 5000 za svaku stavku.</p>}
      <Totals items={props.preview}/>
      <p className="small-note">Provjeri količine i približne nutritivne vrijednosti prije dodavanja.</p>
      <button className="primary full" type="button" disabled={!previewValid || props.busy} onClick={props.onSavePreview}><Check size={19}/>Dodaj u dnevnik</button>
    </section>}
  </div>;
}
