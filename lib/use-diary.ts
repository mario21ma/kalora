'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type State } from './domain';
import { consumeMagicLink, StaleSessionError, subscribeAuth } from './cloud';
import { DiaryStore } from './diary-store';

export function useDiary() {
  const storeRef = useRef<DiaryStore | null>(null);
  const [view, setView] = useState({ state: null, user: null, status: 'Na ovom uređaju', error: '', ownerKey: '', generation: 0, dirty: false, recovery: null, cloudAvailable: false, backups: [] } as ReturnType<DiaryStore['getView']>);
  useEffect(() => {
    const store = new DiaryStore();
    storeRef.current = store;
    const unsubscribe = store.subscribe(() => setView(store.getView()));
    const auth = subscribeAuth(() => { void store.boot(); });
    void (async () => {
      let magicError = '';
      try { await consumeMagicLink(); } catch (e) { if (!(e instanceof StaleSessionError)) magicError = (e as Error).message; }
      await store.boot();
      if (magicError) store.setError(magicError);
    })();
    return () => { unsubscribe(); auth(); store.dispose(); storeRef.current = null; };
  }, []);
  // Bind every callback to the render's account and generation. A saved toast or
  // async closure remains harmless even before another tab's storage event fires.
  const store = storeRef.current;
  const action = store?.captureAction();
  const update = useCallback((fn: (state: State) => State) => action ? store?.update(fn, action) || false : false, [view.ownerKey, view.generation]);
  const isActionCurrent = useCallback(() => !!action && !!store?.isActionCurrent(action), [view.ownerKey, view.generation]);
  const setError = useCallback((error: string) => { if (action) store?.setError(error, action); }, [view.ownerKey, view.generation]);
  const sync = useCallback(async () => { if (action) await store?.sync(action); }, [view.ownerKey, view.generation]);
  const reloadCloud = useCallback(async () => { if (action) await store?.reloadCloud(action); }, [view.ownerKey, view.generation]);
  useEffect(() => {
    if (!view.state || !view.user || !view.dirty) return;
    const timer = setTimeout(() => { if (action) void store?.sync(action, false).catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, [view.state, view.dirty, view.ownerKey, view.generation]);
  useEffect(() => {
    const online = () => { void sync().catch(() => {}); };
    const visible = () => { if (document.visibilityState === 'visible') online(); };
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', online); window.removeEventListener('focus', online); document.removeEventListener('visibilitychange', visible); };
  }, [sync]);
  const backupCurrent = useCallback((reason: string) => !!action && !!store?.backupCurrent(reason, action), [view.ownerKey, view.generation]);
  const getBackups = useCallback(() => action ? store?.getBackups(action) || [] : [], [view.ownerKey, view.generation]);
  const getRecoveryExport = useCallback((id?: string) => action ? store?.getRecoveryExport(id, action) || null : null, [view.ownerKey, view.generation]);
  const restoreBackup = useCallback((id: string) => !!action && !!store?.restoreBackup(id, action), [view.ownerKey, view.generation]);
  const resetCorruptLocal = useCallback(() => !!action && !!store?.resetCorruptLocal(action), [view.ownerKey, view.generation]);
  return { ...view, update, captureAction: () => update, isActionCurrent, setError, sync, reloadCloud, backupCurrent, getBackups, getRecoveryExport, restoreBackup, resetCorruptLocal };
}
