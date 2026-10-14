import { clearAccountDiary, isAccountDiaryDeleted, markAccountDiaryDeleted } from './diary-storage.ts';
// Supabase HTTP API: public anon key, with the captured user's JWT.
export const cloudReady = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SESSION_KEY = 'kalora-session';
const IDENTITY_KEY = 'kalora-auth-identity';
export type Session = { access_token: string, refresh_token: string, expires_at: number, user: { id: string, email?: string } };
export type AuthScope = Readonly<{ ownerId: string | null, identity: string }>;
export const SESSION_EXPIRED_MESSAGE = 'Sesija je istekla. Prijavi se ponovno.';
export class SessionExpiredError extends Error {
  constructor() { super(SESSION_EXPIRED_MESSAGE); this.name = 'SessionExpiredError'; }
}
export class StaleSessionError extends Error {
  constructor() { super('Račun je promijenjen. Ponovi radnju u trenutačnom računu.'); this.name = 'StaleSessionError'; }
}
export function sessionRecoveryMessage() { return sessionStorage.getItem('kalora-auth-recovery') || ''; }
function readStoredSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && Number.isFinite(s.expires_at) && typeof s.user?.id === 'string' ? s : null;
  } catch { return null; }
}
export function getSession(): Session | null {
  try {
    const stored = readStoredSession();
    return stored && !isAccountDiaryDeleted(stored.user.id) ? stored : null;
  } catch { return null; }
}
// Identity survives token refresh, but changes on every explicit login/logout. It also
// prevents a pending A request from becoming valid after an A -> B -> A switch.
export function getAuthScope(): AuthScope {
  const ownerId = getSession()?.user.id ?? null;
  return { ownerId, identity: localStorage.getItem(IDENTITY_KEY) || `legacy:${ownerId ?? 'guest'}` };
}
export function isAuthScopeCurrent(scope: AuthScope) {
  const current = getAuthScope();
  return current.ownerId === scope.ownerId && current.identity === scope.identity;
}
export function assertAuthScope(scope: AuthScope) {
  if (!isAuthScopeCurrent(scope)) throw new StaleSessionError();
}
export function authScopeKey(scope: AuthScope) { return JSON.stringify([scope.ownerId, scope.identity]); }
function announceAuthChange() { window.dispatchEvent(new Event('authchange')); }
export function saveSession(s: Session | null) {
  if (s && isAccountDiaryDeleted(s.user.id)) throw new SessionExpiredError();
  localStorage.setItem(IDENTITY_KEY, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  if (s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    sessionStorage.removeItem('kalora-auth-recovery');
  } else localStorage.removeItem(SESSION_KEY);
  announceAuthChange();
}
export function subscribeAuth(listener: () => void) {
  let last = authScopeKey(getAuthScope());
  const changed = () => {
    const next = authScopeKey(getAuthScope());
    if (last !== next) { last = next; listener(); }
  };
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_KEY || event.key === IDENTITY_KEY) changed();
  };
  window.addEventListener('authchange', changed);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener('authchange', changed); window.removeEventListener('storage', storage); };
}
function expireSession(s: Session, scope: AuthScope) {
  if (!isAuthScopeCurrent(scope) || getSession()?.access_token !== s.access_token) return;
  sessionStorage.setItem('kalora-auth-recovery', SESSION_EXPIRED_MESSAGE);
  saveSession(null);
}
function authHeaders() { return { apikey: key, 'Content-Type': 'application/json' }; }
let loginAttempt = 0;
export async function authRequest(path: string, body: object) {
  const scope = getAuthScope(), attempt = ++loginAttempt;
  const r = await fetch(url + '/auth/v1/' + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  const data = await r.json();
  assertAuthScope(scope);
  if (attempt !== loginAttempt) throw new StaleSessionError();
  if (!r.ok) throw new Error(data.msg || data.error_description || data.message || 'Prijava nije uspjela.');
  if (data.access_token) saveSession({ ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in });
  return data;
}
let refreshing: { identity: string, token: string, promise: Promise<Session> } | null = null;
async function refreshSession(s: Session, scope: AuthScope): Promise<Session> {
  assertAuthScope(scope);
  // Another tab/request may already have renewed this same session. Never re-use a
  // rotated refresh token, and never return a different account to an old operation.
  const latest = getSession();
  if (latest && latest.access_token !== s.access_token) return latest;
  if (refreshing?.identity === scope.identity && refreshing.token === s.refresh_token) return refreshing.promise;
  const pending = { identity: scope.identity, token: s.refresh_token, promise: Promise.resolve(s) };
  const refresh = async () => {
    assertAuthScope(scope);
    const before = getSession();
    if (before && before.access_token !== s.access_token) return before;
    const r = await fetch(url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
    const data = await r.json().catch(() => ({}));
    assertAuthScope(scope);
    const after = getSession();
    if (after && after.access_token !== s.access_token) return after;
    if (!r.ok) {
      if ([400, 401, 403].includes(r.status)) { expireSession(s, scope); throw new SessionExpiredError(); }
      throw new Error(data.msg || data.error_description || data.message || 'Oblak nije dostupan. Pokušaj ponovno.');
    }
    if (!data.access_token || !data.refresh_token || data.user?.id !== scope.ownerId || !Number.isFinite(data.expires_in)) {
      expireSession(s, scope); throw new SessionExpiredError();
    }
    const renewed: Session = { ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
    localStorage.setItem(SESSION_KEY, JSON.stringify(renewed));
    sessionStorage.removeItem('kalora-auth-recovery');
    return renewed;
  };
  // Web Locks coordinate refresh-token rotation between browser tabs. The checks
  // above also protect browsers where Web Locks are unavailable.
  pending.promise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('kalora-auth-refresh', refresh);
    return refresh();
  })().finally(() => { if (refreshing === pending) refreshing = null; });
  refreshing = pending;
  return pending.promise;
}
export async function session(scope = getAuthScope()): Promise<Session | null> {
  assertAuthScope(scope);
  const s = getSession();
  if (!s) {
    if (localStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem('kalora-auth-recovery', SESSION_EXPIRED_MESSAGE);
      saveSession(null);
      throw new SessionExpiredError();
    }
    return null;
  }
  return s.expires_at < Date.now() / 1000 + 60 ? refreshSession(s, scope) : s;
}
export async function cloudCall(fn: string, body: object, scope = getAuthScope()) {
  let s = await session(scope);
  assertAuthScope(scope);
  if (!s) throw new SessionExpiredError();
  for (let attempt = 0; attempt < 2; attempt++) {
    assertAuthScope(scope);
    const r = await fetch(url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { ...authHeaders(), Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    assertAuthScope(scope);
    if (r.status === 401) {
      if (attempt === 0) { s = await refreshSession(s, scope); continue; }
      expireSession(s, scope); throw new SessionExpiredError();
    }
    if (!r.ok) throw new Error(d.message || 'Sinkronizacija nije uspjela.');
    return d;
  }
}
export async function consumeMagicLink() {
  const scope = getAuthScope(), attempt = ++loginAttempt;
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('error_description')) throw new Error(p.get('error_description')!);
  const token = p.get('access_token');
  if (!token) return;
  const r = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  const user = await r.json().catch(() => ({}));
  assertAuthScope(scope);
  if (attempt !== loginAttempt) throw new StaleSessionError();
  if (!r.ok || !user.id || !p.get('refresh_token')) throw new Error('Poveznica je istekla. Zatraži novu.');
  saveSession({ access_token: token, refresh_token: p.get('refresh_token')!, expires_at: Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600), user });
  history.replaceState(null, '', location.pathname);
}
export async function signOut() {
  const s = getSession();
  // Invalidate local work immediately; a delayed logout must not clear a new login.
  saveSession(null);
  if (s) await fetch(url + '/auth/v1/logout', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + s.access_token } });
}
export async function deleteAccount() {
  const scope = getAuthScope(), s = await session(scope);
  assertAuthScope(scope);
  if (!s) throw new Error('Za brisanje računa moraš biti prijavljen.');
  const r = await fetch('/api/account/delete', { method: 'DELETE', headers: { Authorization: 'Bearer ' + s.access_token } });
  const d = await r.json().catch(() => ({}));
  if (r.ok) {
    // Deletion applies to the account, even if A was selected again while its
    // request was pending. Invalidate all in-memory A controllers via authchange
    // before enumerating/removing storage, so a concurrent tab cannot recreate
    // a journal during cleanup. Never log out a selected B account.
    // Only a server-confirmed deletion writes this permanent UUID tombstone.
    // It cancels writers that already passed their entry guard before cleanup.
    let invalidatedSelectedOwner = false;
    try { markAccountDiaryDeleted(s.user.id); }
    catch {
      // A full device can make room by clearing this deleted owner's data, then
      // install the small tombstone and repeat cleanup to catch interrupted writes.
      if (readStoredSession()?.user.id === s.user.id) { saveSession(null); invalidatedSelectedOwner = true; }
      clearAccountDiary(s.user.id);
      markAccountDiaryDeleted(s.user.id);
    }
    const deletedOwnerSelected = readStoredSession()?.user.id === s.user.id;
    if (deletedOwnerSelected) saveSession(null);
    clearAccountDiary(s.user.id);
    if (deletedOwnerSelected || invalidatedSelectedOwner) return d;
  }
  assertAuthScope(scope);
  if (r.status === 401) { expireSession(s, scope); throw new SessionExpiredError(); }
  if (!r.ok) throw new Error(d.error || 'Brisanje računa nije uspjelo.');
  saveSession(null);
  return d;
}
export async function aiCall(path: string, body: object, scope = getAuthScope()) {
  const s = await session(scope);
  assertAuthScope(scope);
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.access_token } : {}) }, body: JSON.stringify(body) });
  const d = await r.json();
  assertAuthScope(scope);
  if (r.status === 401 && s) { expireSession(s, scope); throw new SessionExpiredError(); }
  if (!r.ok) throw new Error(d.error || 'Zahtjev nije uspio.');
  return d;
}
