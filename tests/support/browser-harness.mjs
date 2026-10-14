import assert from 'node:assert/strict';

// Synthetic auth/RPC only. Real service-worker behavior is tested separately.
export const baseURL = process.env.KALORA_BROWSER_URL || 'http://127.0.0.1:3001';
export const mockSession = id => ({
  access_token: 'beta-mock-access-' + id,
  refresh_token: 'beta-mock-refresh-' + id,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: {id, email: id + '@example.invalid'},
});

export async function createHarness(browser, records, options = {}) {
  const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    isMobile: true,
    serviceWorkers: 'block', // Real worker has a separate unmocked suite.
  });
  context.setDefaultTimeout(8000);
  const cloud = structuredClone(records);
  const requests = [], errors = [], forbiddenExternalRequests = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const id = (request.headers().authorization || '').replace('Bearer beta-mock-access-', '');
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const entry = {id, path: url.pathname, body: request.postDataJSON()};
      requests.push(entry);
      if (options.rpc && await options.rpc({route, request, url, entry, cloud})) return;
      if (url.pathname.endsWith('/load_diary')) return route.fulfill({json: cloud[id] || {state: null, revision: 0}});
      if (url.pathname.endsWith('/save_diary')) {
        if (entry.body.expected_revision !== (cloud[id]?.revision || 0)) return route.fulfill({status: 409, json: {message: 'CONFLICT'}});
        cloud[id] = {state: entry.body.document, revision: entry.body.expected_revision + 1};
        return route.fulfill({json: {revision: cloud[id].revision}});
      }
      return route.fulfill({status: 400, json: {message: 'Unexpected mocked RPC'}});
    }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (options.auth && await options.auth({route, request, url})) return;
      if (url.pathname === '/auth/v1/logout') return route.fulfill({json: {}});
      if (url.pathname === '/auth/v1/user') return route.fulfill({json: mockSession(id).user});
      return route.fulfill({status: 400, json: {message: 'Unexpected mocked authentication'}});
    }
    if (url.pathname === '/api/status') return route.fulfill({json: {ai: !!options.aiEnabled, anonymous: false}});
    if (options.api && await options.api({route, request, url})) return;
    if (url.origin !== new URL(baseURL).origin) {
      forbiddenExternalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return {
    context, page, cloud, requests, errors, forbiddenExternalRequests,
    assertClean() {
      assert.deepEqual(errors, [], 'Browser JavaScript errors');
      assert.deepEqual(forbiddenExternalRequests, [], 'Unexpected external requests');
    },
  };
}

export function deferred() {
  let resolve;
  const promise = new Promise(finish => {resolve = finish});
  return {promise, resolve};
}

export const activeAccount = (page, name) => page.waitForFunction(name => document.querySelector('.user-card b')?.textContent === name, name);
export const savedRecord = (page, id) => page.waitForFunction(id => {
  const record = JSON.parse(localStorage.getItem('kalora-v1-' + id) || 'null');
  return record?.dirty === false;
}, id);

export async function seed(page, id, record, raw = null) {
  await page.addInitScript(({id, session, record, raw}) => {
    if (!sessionStorage.getItem('kalora-browser-test-seeded')) {
      sessionStorage.setItem('kalora-browser-test-seeded', 'yes');
      localStorage.setItem('kalora-session', JSON.stringify(session));
      localStorage.setItem('kalora-v1-' + id, raw ?? JSON.stringify({...record, dirty: false}));
    }
  }, {id, session: mockSession(id), record, raw});
  await page.goto(baseURL, {waitUntil: 'networkidle'});
}

export const localRecord = (page, id) => page.evaluate(id => JSON.parse(localStorage.getItem('kalora-v1-' + id)), id);
export async function switchAccount(page, id, record) {
  await page.evaluate(({id, session, record}) => {
    localStorage.setItem('kalora-v1-' + id, JSON.stringify({...record, dirty: false}));
    localStorage.setItem('kalora-session', JSON.stringify(session));
    window.dispatchEvent(new Event('authchange'));
  }, {id, session: mockSession(id), record});
}
export async function waitDiary(page) {
  await page.getByRole('button', {name: 'Dodaj hranu', exact: true}).waitFor();
}
export async function addFood(page, text) {
  await page.getByRole('button', {name: 'Dodaj hranu', exact: true}).click();
  await page.getByRole('textbox', {name: 'Opis obroka', exact: true}).fill(text);
  await page.getByRole('button', {name: 'Analiziraj', exact: true}).click();
  await page.getByRole('button', {name: 'Dodaj u dnevnik', exact: true}).click();
}
export async function addWater(page, ml) {
  await page.getByLabel('Količina vode (ml)', {exact: true}).fill(String(ml));
  await page.getByRole('button', {name: 'Dodaj vodu', exact: true}).click();
}
export async function undoToast(page, text) {
  const toast = page.locator('[data-sonner-toast]').filter({hasText: text});
  await page.locator('[data-sonner-toast][data-front="true"]').hover();
  await toast.getByRole('button', {name: 'Poništi', exact: true}).click();
}
