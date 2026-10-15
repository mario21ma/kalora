import nodeTest, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initialState, makeItem, baseFoods, dateKey, dayOffset, stateSchema, quantityUnit} from '../lib/domain.ts';
import {
  baseURL, createHarness, seed, switchAccount, localRecord, waitDiary,
  savedRecord, activeAccount, addFood, addWater, undoToast,
} from './support/browser-harness.mjs';

// All accounts, cloud RPCs and AI status are synthetic. No production account
// or external service is contacted; the shared harness rejects external calls.
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser;
const test = (name, run) => nodeTest(name, {timeout: 35_000}, run);
before(async () => {
  const response = await fetch(baseURL);
  assert(response.ok, `Start the local production server before browser tests (${baseURL})`);
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}),
    headless: true,
    args: ['--no-sandbox'],
  });
});
after(async () => {await browser?.close()});

function diary(name, appearance = {}) {
  const state = initialState(false);
  state.profile = {...state.profile, name, ...appearance};
  state.onboarded = true;
  state.items = [makeItem(baseFoods.find(food => food.id === 'banana'), 120, 'breakfast', dateKey(), false)];
  state.waterEntries = [{id: 'existing-water', date: dateKey(), amountMl: 350, loggedAt: '2026-10-15T08:00:00.000Z'}];
  return stateSchema.parse(state);
}
const record = (name, appearance) => ({state: diary(name, appearance), revision: 1});
const preferences = page => page.locator('form.appearance-settings');
const profileTab = page => page.locator('.bottom-nav').getByRole('tab', {name: 'Profil', exact: true}).click();
const todayTab = page => page.locator('.bottom-nav').getByRole('tab', {name: 'Danas', exact: true}).click();
const withoutProfile = state => {const {profile, ...rest} = state; return rest};
const saveAppearance = async page => preferences(page).getByRole('button', {name: 'Spremi izgled', exact: true}).click();
const assertLayout = async (page, layout) => {
  await page.locator('.app-shell.layout-' + layout).waitFor();
  assert.equal(await page.locator('.app-shell.layout-' + (layout === 'classic' ? 'compact' : 'classic')).count(), 0);
};
async function withHarness(records, action) {
  const harness = await createHarness(browser, records);
  try {await action(harness); harness.assertClean()}
  finally {await harness.context.close()}
}

test('legacy profiles default to the classic layout without modifying diary entries', async () => {
  const id = 'appearance-legacy', original = record('Legacy appearance');
  delete original.state.profile.layout;
  await withHarness({[id]: original}, async ({page}) => {
    await seed(page, id, original); await waitDiary(page);
    await assertLayout(page, 'classic');
    assert.equal(await page.locator('.body-silhouette').count(), 2);
    assert.equal(await page.getByLabel('Količina vode (ml)', {exact: true}).count(), 1);
    await profileTab(page);
    assert.equal(await preferences(page).getByRole('button', {name: /^Klasični/}).getAttribute('aria-pressed'), 'true');
    assert.equal(await preferences(page).getByRole('button', {name: 'Spremi izgled', exact: true}).isEnabled(), false);
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
  });
});

test('saving compact layout and color survives reload while preserving food and water', async () => {
  const id = 'appearance-persist', original = record('Appearance persist');
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page); await profileTab(page);
    await preferences(page).getByRole('button', {name: /^Kompaktni/}).click();
    await preferences(page).getByRole('button', {name: 'Zelena', exact: true}).click();
    await assertLayout(page, 'classic');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'blue', 'Appearance is a draft until explicit save');
    await saveAppearance(page); await savedRecord(page, id);
    await assertLayout(page, 'compact');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'green');
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
    assert.equal(cloud[id].state.profile.layout, 'compact');
    assert.equal(cloud[id].state.profile.accentTheme, 'green');
    await page.reload({waitUntil: 'networkidle'}); await waitDiary(page);
    await assertLayout(page, 'compact');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'green');
    assert.equal(await page.locator('.body-silhouette').count(), 2);
    assert.equal(await page.getByLabel('Količina vode (ml)', {exact: true}).count(), 1);
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
    assert.deepEqual(cloud[id].state.items, original.state.items);
    assert.deepEqual(cloud[id].state.waterEntries, original.state.waterEntries);
  });
});

test('appearance saves preserve an unsaved personal profile and its later save preserves appearance', async () => {
  const id = 'appearance-personal-draft', original = record('Personal draft');
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page); await profileTab(page);
    await page.getByLabel('Kako se zoveš?', {exact: true}).fill('My unsaved name');
    await page.getByLabel('Trenutna težina (kg)', {exact: true}).fill('82.5');
    await preferences(page).getByRole('button', {name: /^Kompaktni/}).click();
    await preferences(page).getByRole('button', {name: 'Crvena', exact: true}).click();
    await saveAppearance(page); await savedRecord(page, id);
    assert.equal(await page.getByLabel('Kako se zoveš?', {exact: true}).inputValue(), 'My unsaved name');
    assert.equal(await page.getByLabel('Trenutna težina (kg)', {exact: true}).inputValue(), '82.5');
    assert.equal((await localRecord(page, id)).state.profile.name, original.state.profile.name, 'Appearance save does not submit personal drafts');
    assert.equal((await localRecord(page, id)).state.profile.weight, original.state.profile.weight);
    await page.getByRole('button', {name: 'Spremi profil', exact: true}).click();
    await savedRecord(page, id);
    const profile = (await localRecord(page, id)).state.profile;
    assert.equal(profile.name, 'My unsaved name');
    assert.equal(profile.weight, 82.5);
    assert.equal(profile.layout, 'compact');
    assert.equal(profile.accentTheme, 'red');
    assert.deepEqual(cloud[id].state.profile, profile);
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
  });
});

test('hiding water and silhouettes preserves their records and restoring them restores the display', async () => {
  const id = 'appearance-hide', original = record('Display toggles', {layout: 'compact'});
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page); await profileTab(page);
    await preferences(page).getByRole('switch', {name: 'Prikaži siluete', exact: true}).click();
    await preferences(page).getByRole('switch', {name: 'Praćenje vode', exact: true}).click();
    await saveAppearance(page); await savedRecord(page, id); await todayTab(page);
    assert.equal(await page.locator('.body-silhouette').count(), 0);
    assert.equal(await page.locator('.water-summary').count(), 0);
    assert.equal(await page.getByLabel('Količina vode (ml)', {exact: true}).count(), 0);
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
    assert.deepEqual(cloud[id].state.waterEntries, original.state.waterEntries);
    await page.reload({waitUntil: 'networkidle'}); await waitDiary(page);
    assert.equal(await page.locator('.body-silhouette').count(), 0);
    assert.equal(await page.getByLabel('Količina vode (ml)', {exact: true}).count(), 0);
    await profileTab(page);
    await preferences(page).getByRole('switch', {name: 'Prikaži siluete', exact: true}).click();
    await preferences(page).getByRole('switch', {name: 'Praćenje vode', exact: true}).click();
    await saveAppearance(page); await savedRecord(page, id); await todayTab(page);
    assert.equal(await page.locator('.body-silhouette').count(), 2);
    assert.equal(await page.locator('.water-summary').count(), 1);
    assert.equal(await page.getByLabel('Količina vode (ml)', {exact: true}).count(), 1);
    assert.deepEqual(withoutProfile((await localRecord(page, id)).state), withoutProfile(original.state));
  });
});

test('two-tab account changes discard unsaved appearance choices and save only the selected account', async () => {
  const a = 'appearance-tab-a', b = 'appearance-tab-b';
  const records = {[a]: record('Appearance Alice', {layout: 'compact', accentTheme: 'red'}), [b]: record('Appearance Bruno')};
  await withHarness(records, async harness => {
    const {page, context, cloud, errors} = harness;
    await seed(page, a, records[a]); await waitDiary(page); await profileTab(page);
    const other = await context.newPage(); other.on('pageerror', error => errors.push(error.message));
    await other.goto(baseURL, {waitUntil: 'networkidle'}); await waitDiary(other);
    await preferences(page).getByRole('button', {name: /^Klasični/}).click();
    await preferences(page).getByRole('button', {name: 'Zelena', exact: true}).click();
    await preferences(page).getByRole('switch', {name: 'Praćenje vode', exact: true}).click();
    await switchAccount(other, b, records[b]);
    await Promise.all([activeAccount(page, 'Appearance Bruno'), activeAccount(other, 'Appearance Bruno')]);
    await profileTab(page);
    await assertLayout(page, 'classic');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'blue');
    assert.equal(await preferences(page).getByRole('button', {name: /^Klasični/}).getAttribute('aria-pressed'), 'true');
    assert.equal(await preferences(page).getByRole('button', {name: 'Plava', exact: true}).getAttribute('aria-pressed'), 'true');
    assert.equal(await preferences(page).getByRole('switch', {name: 'Praćenje vode', exact: true}).getAttribute('aria-checked'), 'true');
    assert.equal(await preferences(page).getByRole('button', {name: 'Spremi izgled', exact: true}).isEnabled(), false);
    await preferences(page).getByRole('button', {name: 'Žuta', exact: true}).click();
    await saveAppearance(page); await savedRecord(page, b);
    assert.equal(cloud[b].state.profile.accentTheme, 'yellow');
    assert.equal(cloud[b].state.profile.layout, 'classic');
    assert.equal(cloud[b].state.profile.waterTrackingEnabled, true);
    assert.deepEqual((await localRecord(page, a)).state, records[a].state);
    assert.deepEqual(cloud[a], records[a]);
    assert(harness.requests.filter(request => request.path.endsWith('/save_diary')).every(request => request.id === b && request.body.document.profile.name === 'Appearance Bruno'), 'No stale A draft may be saved in either account');
    await switchAccount(other, a, records[a]);
    await Promise.all([activeAccount(page, 'Appearance Alice'), activeAccount(other, 'Appearance Alice')]);
    await assertLayout(page, 'compact');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'red');
    await profileTab(page);
    assert.equal(await preferences(page).getByRole('button', {name: 'Spremi izgled', exact: true}).isEnabled(), false);
    assert.deepEqual((await localRecord(page, b)).state.profile, cloud[b].state.profile);
  });
});

test('saved food search builds a g/ml preview for the selected day and saves only on confirmation', async () => {
  const id = 'appearance-saved-foods', original = record('Saved food search', {layout: 'compact'}), selectedDate = dayOffset(dateKey(), -1);
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page);
    await page.getByLabel('Odaberi datum', {exact: true}).fill(selectedDate);
    await page.getByRole('button', {name: 'Dodaj hranu', exact: true}).click();
    await page.getByRole('button', {name: 'Spremljeno', exact: true}).click();
    const search = page.getByRole('textbox', {name: 'Pretraži spremljene namirnice', exact: true});
    await search.fill('Mlijeko');
    await page.locator('.entry-food-pick').getByText('Mlijeko 2,8%', {exact: true}).click();
    await page.getByRole('textbox', {name: 'Mililitri za Mlijeko 2,8%', exact: true}).fill('125');
    await search.fill('Banana');
    await page.locator('.entry-food-pick').getByText('Banana', {exact: true}).click();
    await page.getByRole('textbox', {name: 'Grami za Banana', exact: true}).fill('0,5');
    await page.getByRole('combobox', {name: 'Obrok', exact: true}).click();
    await page.getByRole('option', {name: 'Ručak', exact: true}).click();
    assert.equal(await page.locator('.preview-section .provenance-quantity[data-kind="provided"]').count(), 2, 'The quantities entered by the user are marked as provided');
    assert.equal(await page.locator('.preview-section .provenance-data[data-kind="generic"]').count(), 2, 'Providing quantities does not upgrade generic nutrients to a verified source');
    assert.deepEqual((await localRecord(page, id)).state, original.state, 'Selecting and editing foods has not added them to the diary');
    assert.deepEqual(cloud[id].state, original.state);
    await page.getByRole('button', {name: 'Dodaj u dnevnik', exact: true}).click(); await savedRecord(page, id);
    const added = (await localRecord(page, id)).state.items.filter(item => !original.state.items.some(old => old.id === item.id));
    assert.equal(added.length, 2);
    assert(added.every(item => item.date === selectedDate && item.meal === 'lunch' && item.isEstimate === false));
    assert.equal(quantityUnit(added.find(item => item.foodId === 'milk')), 'ml');
    assert.equal(added.find(item => item.foodId === 'milk').grams, 125);
    assert.equal(quantityUnit(added.find(item => item.foodId === 'banana')), 'g');
    assert.equal(added.find(item => item.foodId === 'banana').grams, 0.5);
    assert.deepEqual(cloud[id].state.items, (await localRecord(page, id)).state.items);
    assert.deepEqual(cloud[id].state.waterEntries, original.state.waterEntries);
  });
});

test('adding a favorite preserves the existing preview, invalid draft and chosen g/ml day/meal', async () => {
  const id = 'appearance-saved-favorite', original = record('Saved favorite'), selectedDate = dayOffset(dateKey(), -2);
  const oldDate = dayOffset(dateKey(), -10);
  original.state.favorites = [{id: 'milk-banana-favorite', name: 'Moj doručak', items: [
    makeItem(baseFoods.find(food => food.id === 'milk'), 125, 'breakfast', oldDate, false),
    makeItem(baseFoods.find(food => food.id === 'banana'), 80, 'breakfast', oldDate, false),
  ]}];
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page);
    await page.getByLabel('Odaberi datum', {exact: true}).fill(selectedDate);
    await page.getByRole('button', {name: 'Dodaj hranu', exact: true}).click();
    await page.getByRole('combobox', {name: 'Obrok', exact: true}).click();
    await page.getByRole('option', {name: 'Večera', exact: true}).click();
    await page.getByRole('textbox', {name: 'Opis obroka', exact: true}).fill('12 g kruha');
    await page.getByRole('button', {name: 'Analiziraj', exact: true}).click();
    await page.getByRole('textbox', {name: 'Grami za Bijeli kruh', exact: true}).fill('0');
    await page.getByRole('button', {name: 'Spremljeno', exact: true}).click();
    await page.getByRole('textbox', {name: 'Pretraži spremljene namirnice', exact: true}).fill('Moj doručak');
    await page.locator('.saved-favorite').getByText('Moj doručak', {exact: true}).click();
    await page.getByRole('textbox', {name: 'Mililitri za Mlijeko 2,8%', exact: true}).waitFor();
    assert.equal(await page.getByRole('textbox', {name: 'Grami za Banana', exact: true}).inputValue(), '80');
    assert.equal(await page.getByRole('textbox', {name: 'Grami za Bijeli kruh', exact: true}).inputValue(), '0', 'Selecting a favorite retains earlier visible quantity drafts');
    assert.equal(await page.getByRole('button', {name: 'Dodaj u dnevnik', exact: true}).isEnabled(), false);
    await page.getByRole('textbox', {name: 'Grami za Bijeli kruh', exact: true}).fill('0,5');
    assert.deepEqual((await localRecord(page, id)).state, original.state);
    assert.deepEqual(cloud[id].state, original.state);
    await page.getByRole('button', {name: 'Dodaj u dnevnik', exact: true}).click(); await savedRecord(page, id);
    const state = (await localRecord(page, id)).state;
    const added = state.items.filter(item => !original.state.items.some(old => old.id === item.id));
    assert.equal(added.length, 3);
    assert(added.every(item => item.date === selectedDate && item.meal === 'dinner'));
    assert(added.every(item => !original.state.favorites[0].items.some(old => old.id === item.id)), 'A favorite copy receives new entry IDs');
    assert.deepEqual(added.map(item => [item.foodId, item.grams, quantityUnit(item)]), [['bread', 0.5, 'g'], ['milk', 125, 'ml'], ['banana', 80, 'g']]);
    assert.deepEqual(state.favorites, original.state.favorites);
    assert.deepEqual(cloud[id].state.items, state.items);
  });
});

test('compact layout food Undo preserves later food and water entries', async () => {
  const id = 'appearance-compact-undo', original = record('Compact undo', {layout: 'compact'});
  await withHarness({[id]: original}, async ({page, cloud}) => {
    await seed(page, id, original); await waitDiary(page); await assertLayout(page, 'compact');
    await page.getByRole('button', {name: /^Doručak/}).click();
    await page.getByRole('button', {name: 'Uredi Banana', exact: true}).click();
    await page.getByRole('button', {name: 'Obriši', exact: true}).click();
    await addFood(page, '100 g kruha'); await addWater(page, 500);
    const later = (await localRecord(page, id)).state, bread = later.items.find(item => item.foodId === 'bread');
    assert(bread);
    await undoToast(page, 'Stavka je obrisana'); await savedRecord(page, id);
    const restored = (await localRecord(page, id)).state;
    assert(restored.items.some(item => item.id === original.state.items[0].id));
    assert.deepEqual(restored.items.find(item => item.id === bread.id), bread);
    assert.deepEqual(restored.waterEntries.map(item => item.amountMl), [350, 500]);
    assert.equal(restored.profile.layout, 'compact');
    assert.deepEqual(cloud[id].state.items, restored.items);
    assert.deepEqual(cloud[id].state.waterEntries, restored.waterEntries);
  });
});

test('compact water controls fit 320 px without stretching and remain usable with larger text', async () => {
  const id='appearance-small-screen',original=record('Small compact',{layout:'compact'});
  await withHarness({[id]:original},async({page})=>{
    await page.setViewportSize({width:320,height:844});await seed(page,id,original);await waitDiary(page);
    const dimensions=await page.locator('.water-amount-control').evaluate(element=>({height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width}));
    assert(dimensions.height>=44&&dimensions.height<80,'The narrow flex layout must not turn its width basis into a 176 px height');
    assert.equal(await page.getByLabel('Količina vode (ml)',{exact:true}).count(),1);
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('.body-silhouette').count(),2);
      for(const name of ['Smanji količinu vode za 50 ml','Povećaj količinu vode za 50 ml','Dodaj vodu']){
        const box=await page.getByRole('button',{name,exact:true}).boundingBox();assert(box.width>=44&&box.height>=44);
      }
    }
    await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='24px');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByLabel('Količina vode (ml)',{exact:true}).fill('125');await page.getByRole('button',{name:'Dodaj vodu',exact:true}).click();
    assert.deepEqual((await localRecord(page,id)).state.waterEntries.map(entry=>entry.amountMl),[350,125]);
  });
});
