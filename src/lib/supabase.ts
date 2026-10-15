import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppDatabase, Assignment, Material, MaterialFile, PlannedSession, Student, Subject } from '../types';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './publicConfig';
import { decodeRecord, encodeRecord, type TableName } from './recordCodec';

let client: SupabaseClient | null = null;
export function requireSupabaseClient(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

const tables: TableName[] = ['subjects', 'students', 'materials', 'assignments', 'sessions'];
const bucket = 'material-files';

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Kunne ikke lese vedlegget.'));
    reader.readAsDataURL(blob);
  });
}

export class SupabaseSyncService {
  private static instance: SupabaseSyncService;
  static getInstance() { return this.instance ||= new SupabaseSyncService(); }
  isConfigured() { return true; }
  private pendingWrites = 0;
  private writeVersion = 0;
  private failedWrite = false;
  private refreshers = new Set<() => void>();
  hasUnsyncedChanges() { return this.failedWrite; }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingWrites++; this.writeVersion++;
    try { return await operation(); }
    catch (error) { this.failedWrite = true; throw error; }
    finally {
      this.pendingWrites--; this.writeVersion++;
      if (!this.pendingWrites && !this.failedWrite) for (const refresh of this.refreshers) refresh();
    }
  }

  private async user() {
    const { data, error } = await requireSupabaseClient().auth.getUser();
    if (error || !data.user?.email) throw new Error('Du må logge inn på nytt for å lagre.');
    return data.user;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.user();
      const { error } = await requireSupabaseClient().from('subjects').select('id').limit(1);
      if (error) throw error;
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }

  async loadAllData(): Promise<AppDatabase> {
    const user = await this.user();
    const result = await Promise.all(tables.map(async table => {
      const records = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await requireSupabaseClient().from(table).select('*').eq('owner_id', user.id).order('id').range(start, start + 499);
        if (error) throw error;
        records.push(...data.map(row => decodeRecord(table, row)));
        if (data.length < 500) break;
      }
      return records;
    }));
    const db = Object.fromEntries(tables.map((table, i) => [table, result[i]])) as unknown as AppDatabase;
    db.materials = await Promise.all(db.materials.map(async material => ({
      ...material,
      files: await Promise.all((material.files || []).map(async file => {
        if (!file.storagePath) return file;
        const { data, error } = await requireSupabaseClient().storage.from(bucket).download(file.storagePath);
        if (error) throw new Error('Kunne ikke laste ned vedlegg: ' + error.message);
        return { ...file, dataUrl: await asDataUrl(data) };
      })),
    })));
    db.lastUpdated = new Date().toISOString();
    return db;
  }

  subscribeToDatabase(onUpdate: (db: AppDatabase) => void, onError: (err: Error) => void): () => void {
    let active = true, running = false, again = false;
    const refresh = async () => {
      if (this.pendingWrites || this.failedWrite) return;
      if (running) { again = true; return; }
      running = true;
      do {
        again = false;
        const version = this.writeVersion;
        try {
          const db = await this.loadAllData();
          if (active && version === this.writeVersion && !this.pendingWrites && !this.failedWrite) onUpdate(db);
          else if (active && !this.pendingWrites && !this.failedWrite) again = true;
        }
        catch (error) { if (active) onError(error instanceof Error ? error : new Error(String(error))); }
      } while (active && again);
      running = false;
    };
    this.failedWrite = false;
    const trigger = () => { void refresh(); };
    this.refreshers.add(trigger);
    const channel = requireSupabaseClient().channel('metis-' + crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { void refresh(); })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void refresh();
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) onError(new Error('Sanntidstilkoblingen er brutt.'));
      });
    void refresh();
    const online = () => { void refresh(); };
    window.addEventListener('online', online);
    return () => { active = false; this.refreshers.delete(trigger); window.removeEventListener('online', online); void requireSupabaseClient().removeChannel(channel); };
  }

  private async save(table: TableName, item: Subject | Student | Material | Assignment | PlannedSession) {
    return this.write(async () => {
    const user = await this.user();
    const row = encodeRecord(table, item, user.id, user.email!);
    const { error } = await requireSupabaseClient().from(table).upsert(row);
    if (error) throw new Error('Lagring mislyktes: ' + error.message);
    });
  }

  private async remove(table: TableName, id: string) {
    return this.write(async () => {
    const user = await this.user();
    const { error } = await requireSupabaseClient().from(table).delete().eq('id', id).eq('owner_id', user.id);
    if (error) throw new Error('Sletting mislyktes: ' + error.message);
    });
  }

  saveStudent(item: Student) { return this.save('students', item); }
  deleteStudent(id: string) { return this.remove('students', id); }
  saveSubject(item: Subject) { return this.save('subjects', item); }
  deleteSubject(id: string) { return this.remove('subjects', id); }
  saveAssignment(item: Assignment) { return this.save('assignments', item); }
  deleteAssignment(id: string) { return this.remove('assignments', id); }
  saveSession(item: PlannedSession) { return this.save('sessions', item); }
  deleteSession(id: string) { return this.remove('sessions', id); }
  async saveAssignmentsBulk(items: Assignment[]) {
    for (const item of items) await this.saveAssignment(item);
  }

  async saveMaterial(material: Material) {
    return this.write(async () => {
    const user = await this.user();
    const files: MaterialFile[] = [];
    for (const file of material.files || []) {
      const storagePath = user.id + '/' + encodeURIComponent(material.id) + '/' + encodeURIComponent(file.id);
      if (file.dataUrl) {
        if (!file.dataUrl.startsWith('data:')) throw new Error('Vedlegget har ugyldig format.');
        const blob = await (await fetch(file.dataUrl)).blob();
        const { error } = await requireSupabaseClient().storage.from(bucket).upload(storagePath, blob, { upsert: true, contentType: file.type || blob.type });
        if (error) throw new Error('Kunne ikke lagre vedlegg: ' + error.message);
      } else if (!file.storagePath) {
        throw new Error('Vedlegget "' + file.name + '" mangler filinnhold. Legg til filen på nytt før overføring.');
      }
      files.push({ ...file, storagePath: file.dataUrl ? storagePath : file.storagePath, dataUrl: '' });
    }
    await this.save('materials', { ...material, files });
    });
  }
  deleteMaterial(id: string) { return this.remove('materials', id); }

  async importFullDatabase(db: AppDatabase) {
    return this.write(async () => {
    // Parents first; all errors propagate to the caller.
    for (const item of db.subjects) await this.saveSubject(item);
    for (const item of db.students) await this.saveStudent(item);
    for (const item of db.materials) await this.saveMaterial(item);
    for (const item of db.assignments) await this.saveAssignment(item);
    for (const item of db.sessions || []) await this.saveSession(item);
    this.failedWrite = false;
    });
  }
}
