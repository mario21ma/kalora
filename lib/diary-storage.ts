import { stateSchema, type State } from './domain.ts';
export type DiaryRecord = { state: State, revision: number, dirty: boolean };
export type DiaryBackup = { id: string, reason: string, savedAt: string, readable: boolean };
export type RecoveryExport = { filename: string, content: string, readable: boolean };
type SavedBackup = { format: 'kalora-local-backup-v1', ownerId: string | null, savedAt: string, reason: string, raw: string };
export const diaryStorageKey = (ownerId: string | null) => 'kalora-v1-' + (ownerId || 'guest');
export const diaryBackupPrefix = (ownerId: string | null) => 'kalora-backup-v1-' + encodeURIComponent(ownerId || 'guest') + '-';
const deletedAccountKey = (ownerId: string) => 'kalora-deleted-account-v1-' + encodeURIComponent(ownerId);
const rememberedDeletions = new WeakMap<object, Set<string>>();
export const isAccountDiaryDeleted = (ownerId: string | null) => ownerId !== null &&
  (rememberedDeletions.get(localStorage)?.has(ownerId) || localStorage.getItem(deletedAccountKey(ownerId)) === '1');
export function markAccountDiaryDeleted(ownerId: string) {
  // Cancel this tab's writers even when the durable marker cannot fit yet.
  let deleted = rememberedDeletions.get(localStorage);
  if (!deleted) { deleted = new Set(); rememberedDeletions.set(localStorage, deleted); }
  deleted.add(ownerId);
  localStorage.setItem(deletedAccountKey(ownerId), '1');
}
function assertDiaryWritable(ownerId: string | null) {
  if (isAccountDiaryDeleted(ownerId)) {
    clearAccountDiary(ownerId!);
    throw new Error('Račun je izbrisan. Lokalno spremanje je prekinuto.');
  }
}
function writeAccountDiaryValue(ownerId: string | null, key: string, value: string) {
  assertDiaryWritable(ownerId);
  localStorage.setItem(key, value);
  // A different tab can finish account deletion while setItem is in progress.
  // The tombstone survives cleanup and lets the late writer remove its artifacts.
  assertDiaryWritable(ownerId);
}
export function writeDiaryRecord(ownerId: string | null, raw: string) { writeAccountDiaryValue(ownerId, diaryStorageKey(ownerId), raw); }
export const diaryJournalKey = (ownerId: string | null, writerId: string) => diaryBackupPrefix(ownerId) + 'journal-' + writerId;
const journalResolutionKey = (ownerId: string | null, id: string) => diaryBackupPrefix(ownerId) + 'resolved-' + id.slice(diaryBackupPrefix(ownerId).length);
export function parseDiaryRecord(raw: string): DiaryRecord {
  const parsed = JSON.parse(raw);
  const revision = Number(parsed.revision) || 0;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Nevaljana lokalna revizija dnevnika.');
  return { state: stateSchema.parse(parsed.state), revision, dirty: !!parsed.dirty };
}
function readBackup(id: string, ownerId: string | null): SavedBackup | null {
  if (isAccountDiaryDeleted(ownerId) || !id.startsWith(diaryBackupPrefix(ownerId))) return null;
  try {
    const data = JSON.parse(localStorage.getItem(id) || 'null');
    return data?.format === 'kalora-local-backup-v1' && data.ownerId === ownerId && typeof data.raw === 'string' ? data : null;
  } catch { return null; }
}
export function getDiaryBackups(ownerId: string | null): DiaryBackup[] {
  if (isAccountDiaryDeleted(ownerId)) return [];
  const entries: DiaryBackup[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const id = localStorage.key(index);
    if (!id) continue;
    const data = readBackup(id, ownerId);
    if (!data) continue;
    let readable = false;
    try { parseDiaryRecord(data.raw); readable = true; } catch { /* Preserve raw data for manual recovery. */ }
    entries.push({ id, reason: data.reason, savedAt: data.savedAt, readable });
  }
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export function preserveDiaryBackup(ownerId: string | null, raw: string, reason: string) {
  assertDiaryWritable(ownerId);
  // Repeated boot/conflict retries retain one exact snapshot, without deleting any
  // earlier backup to make room. A full device aborts replacement instead.
  for (const entry of getDiaryBackups(ownerId)) {
    const existing = readBackup(entry.id, ownerId);
    if (existing?.raw === raw && existing.reason === reason && existing.reason !== 'pending-tab') { assertDiaryWritable(ownerId); return entry.id; }
  }
  const id = diaryBackupPrefix(ownerId) + (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const data: SavedBackup = { format: 'kalora-local-backup-v1', ownerId, savedAt: new Date().toISOString(), reason, raw };
  writeAccountDiaryValue(ownerId, id, JSON.stringify(data));
  return id;
}
// One write-ahead record per controller/account closes localStorage's cross-tab
// read/check/write race. It is a recoverable ordinary backup, never a full edit
// history. A branch from an earlier account incarnation is frozen before reuse.
export function writeDiaryJournal(ownerId: string | null, writerId: string, raw: string, predecessor: string | null) {
  assertDiaryWritable(ownerId);
  const id = diaryJournalKey(ownerId, writerId), existing = readBackup(id, ownerId);
  if (existing && existing.raw !== predecessor && existing.raw !== raw) preserveDiaryBackup(ownerId, existing.raw, 'tab-conflict');
  const data: SavedBackup = { format: 'kalora-local-backup-v1', ownerId, savedAt: new Date().toISOString(), reason: 'pending-tab', raw };
  writeAccountDiaryValue(ownerId, id, JSON.stringify(data));
  return id;
}
export function clearDiaryJournal(ownerId: string | null, writerId: string) {
  const id = diaryJournalKey(ownerId, writerId);
  if (readBackup(id, ownerId)?.reason === 'pending-tab') localStorage.removeItem(id);
  localStorage.removeItem(journalResolutionKey(ownerId, id));
}
export function isDiaryJournalUnresolved(ownerId: string | null, id: string) {
  const data = readBackup(id, ownerId);
  return data?.reason === 'pending-tab' && localStorage.getItem(journalResolutionKey(ownerId, id)) !== data.raw;
}
// Explicit recovery freezes all currently unresolved branches. A separate marker
// records the exact acknowledged raw value; never edit another writer's journal,
// because that tab may concurrently write a newer operation under the same key.
export function settleDiaryJournals(ownerId: string | null, reason: string) {
  for (const backup of getDiaryBackups(ownerId)) {
    if (!isDiaryJournalUnresolved(ownerId, backup.id)) continue;
    const data = readBackup(backup.id, ownerId);
    if (!data) continue;
    preserveDiaryBackup(ownerId, data.raw, reason);
    writeAccountDiaryValue(ownerId, journalResolutionKey(ownerId, backup.id), data.raw);
  }
}
export function getDiaryRecoveryExport(ownerId: string | null, backupId?: string): RecoveryExport | null {
  if (isAccountDiaryDeleted(ownerId)) return null;
  const raw = backupId ? readBackup(backupId, ownerId)?.raw : localStorage.getItem(diaryStorageKey(ownerId));
  if (raw == null) return null;
  try {
    const record = parseDiaryRecord(raw);
    // Ordinary imports expect State, rather than the internal revision wrapper.
    return { filename: 'kalora-oporavak.json', content: JSON.stringify(record.state, null, 2), readable: true };
  } catch { return { filename: 'kalora-necitljiva-kopija.json', content: raw, readable: false }; }
}
export function clearAccountDiary(ownerId: string) {
  const prefix = diaryBackupPrefix(ownerId), remove: string[] = [diaryStorageKey(ownerId)];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) remove.push(key);
  }
  remove.forEach(key => localStorage.removeItem(key));
}
export function getDiaryBackupRecord(ownerId: string | null, backupId: string): DiaryRecord {
  const data = readBackup(backupId, ownerId);
  if (!data) throw new Error('Sigurnosna kopija ne pripada ovom računu.');
  return parseDiaryRecord(data.raw);
}
