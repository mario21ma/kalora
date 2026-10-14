import { type State, initialState, stateSchema } from './domain.ts';
import { type AuthScope, type Session, SessionExpiredError, StaleSessionError, authScopeKey, cloudCall, getAuthScope, getSession, isAuthScopeCurrent, session, sessionRecoveryMessage } from './cloud.ts';

import { type DiaryRecord, type DiaryBackup, type RecoveryExport, diaryStorageKey, getDiaryBackups, getDiaryBackupRecord, getDiaryRecoveryExport, parseDiaryRecord, preserveDiaryBackup, writeDiaryJournal, clearDiaryJournal, isDiaryJournalUnresolved, settleDiaryJournals, isAccountDiaryDeleted, writeDiaryRecord } from './diary-storage.ts';
export type DiaryAction = Readonly<{ scope: AuthScope, generation: number }>;
export type DiaryView = { state: State | null, user: Session | null, status: string, error: string, ownerKey: string, generation: number, dirty: boolean, recovery: 'corrupt' | 'conflict' | null, cloudAvailable: boolean, backups: DiaryBackup[] };
function cloudRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Oblak je vratio nevaljanu reviziju dnevnika. Lokalni podaci su sačuvani.');
  return value;
}
const conflictMessage = 'Dnevnik je promijenjen na drugom uređaju. Izvezi lokalnu kopiju, zatim učitaj oblak.';

// The controller binds storage, requests and mutations to one account incarnation.
// React only subscribes to its view; the same controller is exercised by tests.
export class DiaryStore {
  private disposed = false;
  private listeners = new Set<() => void>();
  private record: DiaryRecord | null = null;
  private storedRaw: string | null | undefined;
  private readonly writerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  private scope = getAuthScope();
  private generation = 0;
  private busy: { generation: number, promise: Promise<void> } | null = null;
  private blocked = false;
  private syncError: string | null = null;
  private view: DiaryView = { state: null, user: null, status: 'Na ovom uređaju', error: '', ownerKey: authScopeKey(this.scope), generation: 0, dirty: false, recovery: null, cloudAvailable: false, backups: [] };
  dispose() { this.disposed = true; this.generation++; this.listeners.clear(); }
  getView = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<DiaryView>) {
    this.view = { ...this.view, ...change };
    this.listeners.forEach(listener => listener());
  }
  captureAction(): DiaryAction { return { scope: this.scope, generation: this.generation }; }
  isActionCurrent(action: DiaryAction) {
    return !this.disposed && action.generation === this.generation && !isAccountDiaryDeleted(action.scope.ownerId) && isAuthScopeCurrent(action.scope);
  }
  setError = (error: string, action = this.captureAction()) => {
    if (this.isActionCurrent(action)) this.publish({ error });
  };
  private localKey(action = this.captureAction()) { return diaryStorageKey(action.scope.ownerId); }
  private persist(record: DiaryRecord, action: DiaryAction): 'saved' | 'memory' | 'conflict' | 'stale' {
    if (!this.isActionCurrent(action)) return 'stale';
    try {
      const raw = JSON.stringify(record), current = localStorage.getItem(this.localKey(action));
      if (!this.isActionCurrent(action)) return 'stale';
      let journalSaved = false;
      if (record.dirty) {
        try { writeDiaryJournal(action.scope.ownerId, this.writerId, raw, this.record && JSON.stringify(this.record)); journalSaved = true; }
        catch {
          if (!this.isActionCurrent(action)) return 'stale';
          // Refuse a main write when its write-ahead protection cannot be saved.
          if (current === this.storedRaw) {
            this.publish({ error: 'Spremanje na uređaj nije uspjelo. Izvezi kopiju prije zatvaranja aplikacije.' });
            return 'memory';
          }
        }
      }
      if (!this.isActionCurrent(action)) return 'stale';
      // Another tab can edit the same owner's main record without changing auth.
      // Archive both branches, including this new operation, before refusing to
      // overwrite that tab. Cloud revision checks alone do not protect local data.
      const latest = localStorage.getItem(this.localKey(action));
      if (!this.isActionCurrent(action)) return 'stale';
      if (this.storedRaw !== undefined && latest !== this.storedRaw && latest !== raw) {
        let preserved = true;
        try {
          // The journal already contains the latest operation. Freeze the original
          // local branch once, and retain the other tab's current main unchanged.
          for (const branch of new Set([latest, !this.blocked && this.record ? JSON.stringify(this.record) : null, !journalSaved ? raw : null])) {
            if (!this.isActionCurrent(action)) return 'stale';
            if (branch !== null) preserveDiaryBackup(action.scope.ownerId, branch, 'tab-conflict');
          }
        } catch { preserved = false; }
        if (!this.isActionCurrent(action)) return 'stale';
        this.blocked = true;
        this.publish({ recovery: 'conflict', backups: getDiaryBackups(action.scope.ownerId), status: 'Sukob lokalnih kopija', error: preserved
          ? 'Dnevnik je promijenjen u drugoj kartici. Obje kopije su sačuvane. Izvezi ili vrati sigurnosnu kopiju prije zamjene dnevnika.'
          : 'Dnevnik je promijenjen u drugoj kartici, a sigurnosnu kopiju nije moguće spremiti. Izvezi trenutačni dnevnik prije zatvaranja aplikacije.' });
        return 'conflict';
      }
      if (!this.isActionCurrent(action)) return 'stale';
      writeDiaryRecord(action.scope.ownerId, raw);
      if (!this.isActionCurrent(action)) return 'stale';
      this.storedRaw = raw;
      if (journalSaved) this.publish({ backups: getDiaryBackups(action.scope.ownerId) });
      return 'saved';
    } catch {
      if (!this.isActionCurrent(action)) return 'stale';
      this.publish({ error: 'Spremanje na uređaj nije uspjelo. Izvezi kopiju prije zatvaranja aplikacije.' }); return 'memory';
    }
  }
  private install(record: DiaryRecord, action: DiaryAction) {
    const result = this.persist(record, action);
    if (result === 'stale' || !this.isActionCurrent(action)) return 'stale';
    this.record = result === 'conflict' ? { ...record, dirty: true } : record;
    this.publish({ state: this.record.state, dirty: this.record.dirty });
    return result;
  }
  update = (fn: (state: State) => State, action = this.captureAction()) => {
    if (!this.record || !this.isActionCurrent(action)) return false;
    const next = stateSchema.parse(fn(this.record.state));
    // A mutation callback must not switch auth and then write into another account.
    if (!this.isActionCurrent(action)) return false;
    if (this.install({ ...this.record, state: next, dirty: true }, action) === 'stale') return false;
    if (!this.blocked) this.publish({ status: action.scope.ownerId ? 'Čeka spremanje' : 'Spremljeno na uređaju' });
    return true;
  };
  boot = async () => {
    if (this.disposed) return;
    this.scope = getAuthScope();
    this.generation++;
    this.record = null;
    this.storedRaw = undefined;
    this.blocked = false;
    this.syncError = null;
    const action = this.captureAction();
    this.publish({ state: null, user: getSession(), ownerKey: authScopeKey(action.scope), generation: action.generation, dirty: false, recovery: null, cloudAvailable: false, backups: getDiaryBackups(action.scope.ownerId), error: sessionRecoveryMessage() });
    try { if (navigator.onLine) await session(action.scope); }
    catch (e) {
      if (!this.isActionCurrent(action)) return;
      if (!(e instanceof SessionExpiredError)) this.publish({ error: (e as Error).message });
    }
    if (!this.isActionCurrent(action)) return;
    this.publish({ user: getSession() });
    let local: DiaryRecord | null = null;
    const raw = localStorage.getItem(this.localKey(action));
    if (!this.isActionCurrent(action)) return;
    this.storedRaw = raw;
    if (raw) {
      try {
        local = parseDiaryRecord(raw);
      } catch {
        this.blocked = true;
        try { preserveDiaryBackup(action.scope.ownerId, raw, 'corrupt'); }
        catch { /* The main raw record remains untouched even when storage is full. */ }
        if (!this.isActionCurrent(action)) return;
        this.publish({ recovery: 'corrupt', error: 'Lokalna kopija nije čitljiva. Izvorni zapis je sačuvan. Preuzmi ga ili izričito učitaj dnevnik iz oblaka.', backups: getDiaryBackups(action.scope.ownerId) });
      }
    }
    // An interrupted or simultaneous tab write can leave a branch that differs
    // from the main diary. Preserve it and require explicit recovery, not a merge.
    const pendingBranches = getDiaryBackups(action.scope.ownerId).filter(backup => backup.readable && isDiaryJournalUnresolved(action.scope.ownerId, backup.id));
    if (!this.isActionCurrent(action)) return;
    if (this.view.recovery !== 'corrupt' && pendingBranches.some(backup => {
      try {
        const branch = getDiaryBackupRecord(action.scope.ownerId, backup.id);
        return !local || JSON.stringify(branch.state) !== JSON.stringify(local.state);
      } catch { return false; } // Another tab may just have confirmed and removed it.
    })) {
      this.blocked = true;
      if (raw) this.preserveRaw(raw, 'tab-conflict', action);
      if (!this.isActionCurrent(action)) return;
      this.publish({ recovery: 'conflict', error: 'Na uređaju postoje različite sačuvane kopije dnevnika iz više kartica. Izvezi ili vrati sigurnosnu kopiju prije zamjene dnevnika.' });
    }
    if (action.scope.ownerId && navigator.onLine) {
      try {
        const cloud = await cloudCall('load_diary', {}, action.scope);
        if (!this.isActionCurrent(action)) return;
        if (cloud?.state) {
          const remote = { state: stateSchema.parse(cloud.state), revision: cloudRevision(cloud.revision), dirty: false };
          this.publish({ cloudAvailable: true });
          if (this.view.recovery === 'corrupt') return;
          if (local?.dirty && local.revision !== cloud.revision) {
            this.blocked = true;
            this.preserveRaw(raw!, 'conflict', action);
            if (!this.isActionCurrent(action)) return;
            this.publish({ recovery: 'conflict', error: conflictMessage });
          } else if (!local?.dirty && !this.blocked) local = remote;
        }
        if (this.view.recovery === 'corrupt') return;
        this.publish({ status: local?.dirty ? 'Čeka spremanje' : 'Sinkronizirano' });
      } catch (e) {
        if (!this.isActionCurrent(action)) return;
        if (e instanceof SessionExpiredError || e instanceof StaleSessionError) return;
        this.publish({ error: 'Oblak nije dostupan. Promjene ostaju na ovom uređaju.', status: 'Izvanmrežni način' });
      }
    } else this.publish({ status: action.scope.ownerId ? 'Izvanmrežni način' : 'Na ovom uređaju' });
    if (!this.isActionCurrent(action) || this.view.recovery === 'corrupt') return;
    this.install(local || { state: initialState(false), revision: 0, dirty: !!action.scope.ownerId }, action);
  };
  sync = async (action = this.captureAction(), pullClean = true): Promise<void> => {
    if (!this.isActionCurrent(action)) return;
    if (this.blocked) throw new Error('Najprije riješi sukob spremljenih podataka.');
    if (this.busy?.generation === action.generation) {
      await this.busy.promise;
      if (this.isActionCurrent(action) && this.record?.dirty) return this.sync(action, pullClean);
      return;
    }
    if (!navigator.onLine || !action.scope.ownerId || !this.record) return;
    if (!this.record.dirty) {
      try { if (pullClean) await this.pullCloud(action); }
      catch (e) {
        if (!this.isActionCurrent(action)) return;
        this.publish({ error: (e as Error).message, status: 'Spremljeno lokalno · čeka vezu' });
        throw e;
      }
      return;
    }
    const snapshot = this.record;
    const pending = { generation: action.generation, promise: Promise.resolve() };
    pending.promise = (async () => {
      try {
        this.publish({ status: 'Spremanje…' });
        const result = await cloudCall('save_diary', { document: snapshot.state, expected_revision: snapshot.revision }, action.scope);
        if (!this.isActionCurrent(action) || !this.record) return;
        const installed = this.install({ ...this.record, revision: cloudRevision(result.revision), dirty: this.record !== snapshot }, action);
        if (installed === 'conflict' || installed === 'stale' || !this.isActionCurrent(action)) return;
        if (installed === 'saved' && !this.record.dirty && this.isActionCurrent(action) && localStorage.getItem(this.localKey(action)) === this.storedRaw) {
          clearDiaryJournal(action.scope.ownerId, this.writerId);
          this.publish({ backups: getDiaryBackups(action.scope.ownerId) });
        }
        if (this.syncError !== null && this.view.error === this.syncError) this.publish({ error: '' });
        this.syncError = null;
        this.publish({ status: this.record.dirty ? 'Čeka spremanje' : 'Sinkronizirano' });
      } catch (e) {
        if (!this.isActionCurrent(action)) return;
        const message = e instanceof Error ? e.message : 'Spremanje nije uspjelo';
        if (message.includes('CONFLICT')) {
          this.blocked = true;
          this.backupCurrent('conflict', action);
          if (!this.isActionCurrent(action)) return;
          this.publish({ recovery: 'conflict', error: conflictMessage });
        }
        else { this.syncError = message; this.publish({ error: message }); }
        this.publish({ status: 'Spremljeno lokalno · čeka vezu' });
        throw e;
      } finally { if (this.busy === pending) this.busy = null; }
    })();
    this.busy = pending;
    await pending.promise;
  };
  private preserveRaw(raw: string, reason: string, action: DiaryAction) {
    if (!this.isActionCurrent(action)) return false;
    try {
      preserveDiaryBackup(action.scope.ownerId, raw, reason);
      if (!this.isActionCurrent(action)) return false;
      this.publish({ backups: getDiaryBackups(action.scope.ownerId) });
      return true;
    } catch {
      if (!this.isActionCurrent(action)) return false;
      this.publish({ error: 'Sigurnosnu kopiju nije moguće spremiti. Izvezi podatke i oslobodi prostor prije zamjene dnevnika.' });
      return false;
    }
  }
  backupCurrent = (reason: string, action = this.captureAction()) => {
    if (!this.isActionCurrent(action)) return false;
    const raw = this.record ? JSON.stringify(this.record) : localStorage.getItem(this.localKey(action));
    return raw === null || this.preserveRaw(raw, reason, action);
  };
  getBackups = (action = this.captureAction()) => this.isActionCurrent(action) ? getDiaryBackups(action.scope.ownerId) : [];
  getRecoveryExport = (backupId?: string, action = this.captureAction()): RecoveryExport | null =>
    this.isActionCurrent(action) ? getDiaryRecoveryExport(action.scope.ownerId, backupId) : null;
  restoreBackup = (backupId: string, action = this.captureAction()) => {
    if (!this.isActionCurrent(action)) return false;
    try {
      const backup = getDiaryBackupRecord(action.scope.ownerId, backupId);
      if (!this.backupCurrent('before-backup-restore', action)) return false;
      const latest = localStorage.getItem(this.localKey(action));
      if (latest !== this.storedRaw && latest !== null && !this.preserveRaw(latest, 'before-backup-restore', action)) return false;
      settleDiaryJournals(action.scope.ownerId, 'before-backup-restore');
      if (!this.isActionCurrent(action)) return false;
      // Keep the current cloud revision, so explicit restoring a previous State is
      // a new local edit and still observes the normal conflict checks.
      // Explicit recovery has preserved the current branch. Adopt the latest
      // main as the replacement baseline, but keep the revision conflict check.
      this.storedRaw = latest;
      const installed = this.install({ state: backup.state, revision: this.record?.revision ?? backup.revision, dirty: true }, action);
      if (installed === 'conflict' || installed === 'memory' || installed === 'stale') return false;
      this.blocked = false;
      this.publish({ error: '', recovery: null, status: action.scope.ownerId ? 'Čeka spremanje' : 'Spremljeno na uređaju' });
      return true;
    } catch (e) { this.setError((e as Error).message, action); return false; }
  };
  resetCorruptLocal = (action = this.captureAction()) => {
    if (!this.isActionCurrent(action) || this.view.recovery !== 'corrupt' || !this.backupCurrent('corrupt', action)) return false;
    try { settleDiaryJournals(action.scope.ownerId, 'corrupt'); }
    catch { this.setError('Sigurnosnu kopiju nije moguće spremiti. Izvezi podatke prije zamjene dnevnika.', action); return false; }
    if (!this.isActionCurrent(action)) return false;
    this.storedRaw = localStorage.getItem(this.localKey(action));
    const installed = this.install({ state: initialState(false), revision: 0, dirty: !!action.scope.ownerId }, action);
    if (installed === 'conflict' || installed === 'memory' || installed === 'stale') return false;
    this.blocked = false;
    this.publish({ error: '', recovery: null, status: 'Spremljeno na uređaju' });
    return true;
  };
  private pullCloud = async (action: DiaryAction) => {
    const result = await cloudCall('load_diary', {}, action.scope);
    if (!this.isActionCurrent(action) || !result?.state || !this.record) return;
    const remote = { state: stateSchema.parse(result.state), revision: cloudRevision(result.revision), dirty: false };
    if (this.record.dirty) {
      if (this.record.revision !== remote.revision) {
        this.blocked = true;
        this.backupCurrent('conflict', action);
        if (!this.isActionCurrent(action)) return;
        this.publish({ recovery: 'conflict', error: conflictMessage });
      }
      return;
    }
    if (remote.revision < this.record.revision) return;
    const installed = this.install(remote, action);
    if (installed === 'conflict' || installed === 'memory' || installed === 'stale') return;
    this.publish({ error: '', status: 'Sinkronizirano', cloudAvailable: true });
  };
  reloadCloud = async (action = this.captureAction()) => {
    if (!this.isActionCurrent(action) || !action.scope.ownerId) return;
    const before = this.record;
    try {
      const result = await cloudCall('load_diary', {}, action.scope);
      if (!this.isActionCurrent(action)) return;
      if (this.record !== before) throw new Error('Dnevnik je promijenjen tijekom učitavanja. Ponovi učitavanje oblaka.');
      if (!result?.state) throw new Error('Oblak još nema spremljen dnevnik.');
      const remote = { state: stateSchema.parse(result.state), revision: cloudRevision(result.revision), dirty: false };
      if (!this.backupCurrent(this.view.recovery === 'corrupt' ? 'corrupt' : 'before-cloud-reload', action)) return;
      // A different tab may have written during this request. Preserve its
      // latest main as well as the view being explicitly replaced.
      const latest = localStorage.getItem(this.localKey(action));
      if (latest !== this.storedRaw && latest !== null && !this.preserveRaw(latest, 'before-cloud-reload', action)) return;
      settleDiaryJournals(action.scope.ownerId, 'before-cloud-reload');
      if (!this.isActionCurrent(action)) return;
      this.storedRaw = latest;
      const installed = this.install(remote, action);
      if (installed === 'conflict' || installed === 'memory' || installed === 'stale') return;
      this.blocked = false;
      this.publish({ status: 'Sinkronizirano', error: '', recovery: null, cloudAvailable: true });
    } catch (e) { if (this.isActionCurrent(action)) this.publish({ error: (e as Error).message }); }
  };
}
