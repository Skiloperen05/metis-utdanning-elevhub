import type { AppDatabase, AssignmentStatus } from '../types';

export function emptyDatabase(): AppDatabase {
  return { subjects: [], students: [], materials: [], assignments: [], sessions: [], lastUpdated: new Date().toISOString() };
}
const storageKey = (uid: string) => 'metis_workspace_v3_' + uid;

export function loadDatabase(uid?: string): AppDatabase {
  if (!uid) return emptyDatabase();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? validateDatabase(JSON.parse(raw)) : emptyDatabase();
  } catch { return emptyDatabase(); }
}

export function saveDatabase(db: AppDatabase, uid: string): void {
  try {
    // Binary contents also live in private Supabase Storage.
    const cache = { ...db, materials: db.materials.map(material => ({
      ...material, files: (material.files || []).map(file => ({
        ...file, dataUrl: file.dataUrl?.length > 100 * 1024 ? '' : file.dataUrl,
      })),
    })) };
    localStorage.setItem(storageKey(uid), JSON.stringify(cache));
  } catch (error) { console.warn('Kunne ikke lagre lokal sikkerhetskopi:', error); }
}

export function validateDatabase(value: unknown): AppDatabase {
  if (!value || typeof value !== 'object') throw new Error('Ugyldig sikkerhetskopi.');
  const db = value as AppDatabase;
  for (const table of ['subjects', 'students', 'materials', 'assignments'] as const) {
    if (!Array.isArray(db[table])) throw new Error('Sikkerhetskopien mangler ' + table + '.');
  }
  db.sessions ||= [];
  if (!Array.isArray(db.sessions)) throw new Error('Ugyldige veiledningstimer.');
  for (const rows of [db.subjects, db.students, db.materials, db.assignments, db.sessions]) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Ugyldige eller dupliserte ID-er i sikkerhetskopien.');
      ids.add(row.id);
    }
  }
  for (const student of db.students) {
    if (!Array.isArray(student.notes) || !Array.isArray(student.enrolledSubjectIds)) throw new Error('Ugyldig elevkort i sikkerhetskopien.');
  }
  for (const session of db.sessions) {
    if (!Array.isArray(session.items) || typeof session.date !== 'string') throw new Error('Ugyldig timeplan i sikkerhetskopien.');
  }
  const subjects = new Set(db.subjects.map(row => row.id));
  const students = new Set(db.students.map(row => row.id));
  const materials = new Set(db.materials.map(row => row.id));
  if (db.materials.some(row => !subjects.has(row.subjectId)) ||
      db.assignments.some(row => !students.has(row.studentId) || !materials.has(row.materialId)) ||
      db.sessions.some(row => row.studentId && !students.has(row.studentId) || row.subjectId && !subjects.has(row.subjectId))) {
    throw new Error('Sikkerhetskopien mangler et fag, en elev eller et materiell som andre data viser til.');
  }
  return { ...db, lastUpdated: db.lastUpdated || new Date().toISOString() };
}

export function exportDatabaseAsJson(db: AppDatabase): void {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'metis_utdanning_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importDatabaseFromJson(file: File): Promise<AppDatabase> {
  return validateDatabase(JSON.parse(await file.text()));
}

export function getNextAssignmentStatus(current?: AssignmentStatus): AssignmentStatus {
  const statuses: AssignmentStatus[] = ['ikke_tildelt', 'tildelt', 'under_arbeid', 'gjennomgatt', 'levert'];
  return statuses[(statuses.indexOf(current || 'ikke_tildelt') + 1) % statuses.length];
}
